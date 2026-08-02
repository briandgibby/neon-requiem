import { Tickable } from '../../heartbeat';
import { EcsRegistry } from '../registry';
import {
  AiComponent,
  CombatSessionComponent,
  ComponentTypes,
  HealthComponent,
  IdentityComponent,
  PositionComponent,
} from '../components';
import { RoomLookup, SafeZonePolicy } from '../../../domains/world/world.types';
import type { InstanceAlertAuthority } from '../../../domains/mission/instance-alert.service';
import { RoomEventPublisher } from '../../room-event-publisher';

interface AlertPatrolWorldPolicy extends SafeZonePolicy, RoomLookup {}
type AlertPatrolRoom = Awaited<ReturnType<RoomLookup['getRoom']>>;

type ActiveAlertSession = Pick<CombatSessionComponent, 'roomId' | 'alarmState'> & { instanceId?: string };
interface AlertPatrolDiagnostics {
  warn(obj: unknown, msg: string): void;
}
interface InstanceAlertSource extends InstanceAlertAuthority {
  findActiveInstanceAlertSources(): Promise<Array<ActiveAlertSession & { instanceId: string }>>;
}

const MAX_RED_PATROL_SEARCH_DEPTH = 8;

export class AlertPatrolSystem implements Tickable {
  readonly name = 'ecs_alert_patrol_system';
  readonly frequency = 1;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly worldPolicy: AlertPatrolWorldPolicy,
    private readonly diagnostics?: AlertPatrolDiagnostics,
    private readonly instanceAlerts?: InstanceAlertSource,
    private readonly roomEvents?: RoomEventPublisher,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const alertSessions = await this.getActiveAlertSessions();
    if (alertSessions.length === 0) return;

    const safeZoneCache = new Map<string, boolean>();
    const patrolIds = this.registry.getEntitiesWith([
      ComponentTypes.NpcId,
      ComponentTypes.Ai,
      ComponentTypes.Position,
      ComponentTypes.Health,
    ]);

    for (const patrolId of patrolIds) {
      const ai = this.registry.getComponent<AiComponent>(patrolId, ComponentTypes.Ai);
      const position = this.registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
      const health = this.registry.getComponent<HealthComponent>(patrolId, ComponentTypes.Health);

      if (!ai || !position || !health) continue;
      if (ai.state !== 'patrol' || health.current <= 0) continue;

      try {
        const currentRoomSafeZone = await this.tryGetEffectiveSafeZone(position.roomId, safeZoneCache);
        if (currentRoomSafeZone !== false) continue;

        await this.moveTowardFirstReachableAlert(patrolId, ai, position, alertSessions, safeZoneCache);
      } catch (err) {
        this.reportLookupFailure(err, {
          patrolId,
          roomId: position.roomId,
        });
      }
    }
  }

  private async getActiveAlertSessions(): Promise<ActiveAlertSession[]> {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);
    const ecsSessions: ActiveAlertSession[] = sessionIds
      .map((sessionId) => this.registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession))
      .filter((session): session is CombatSessionComponent => !!session && session.alarmState !== 'GREEN')
      .map((session) => ({ roomId: session.roomId, alarmState: session.alarmState }));
    const sessions: ActiveAlertSession[] = [];

    if (this.instanceAlerts) {
      for (const session of ecsSessions) {
        try {
          const outcome = await this.instanceAlerts.ensureAlertFromRoom(session.roomId, session.alarmState);
          if (outcome === 'inactive-instance') continue;
        } catch (err) {
          this.diagnostics?.warn({ err, roomId: session.roomId }, 'Alert patrol could not persist combat alert');
        }
        sessions.push(session);
      }

      try {
        sessions.push(...await this.instanceAlerts.findActiveInstanceAlertSources());
      } catch (err) {
        this.diagnostics?.warn({ err }, 'Alert patrol could not load MissionInstance alert sources');
      }
    } else {
      sessions.push(...ecsSessions);
    }

    const strongestByRoom = new Map<string, ActiveAlertSession>();
    for (const session of sessions) {
      const current = strongestByRoom.get(session.roomId);
      const sessionPriority = this.alertPriority(session.alarmState);
      const currentPriority = current ? this.alertPriority(current.alarmState) : -1;
      if (
        !current
        || sessionPriority > currentPriority
        || (sessionPriority === currentPriority && session.instanceId && !current.instanceId)
      ) {
        strongestByRoom.set(session.roomId, session);
      }
    }

    return [...strongestByRoom.values()]
      .sort((a, b) => this.alertPriority(b.alarmState) - this.alertPriority(a.alarmState));
  }

  private alertPriority(alarmState: CombatSessionComponent['alarmState']): number {
    if (alarmState === 'RED') return 2;
    if (alarmState === 'YELLOW') return 1;
    return 0;
  }

  private async moveTowardFirstReachableAlert(
    patrolId: string,
    ai: AiComponent,
    position: PositionComponent,
    alertSessions: ActiveAlertSession[],
    safeZoneCache: Map<string, boolean>,
  ): Promise<void> {
    const currentRoom = await this.worldPolicy.getRoom(position.roomId);
    const patrolScope = currentRoom.missionInstanceId ?? null;
    for (const alertSession of alertSessions) {
      let alertRoom: AlertPatrolRoom;
      try {
        alertRoom = await this.worldPolicy.getRoom(alertSession.roomId);
      } catch (err) {
        this.reportLookupFailure(err, { patrolId, roomId: alertSession.roomId });
        continue;
      }
      const alertScope = alertRoom.missionInstanceId ?? null;
      if (alertScope !== patrolScope) continue;
      if (alertSession.instanceId && alertSession.instanceId !== alertScope) continue;

      if (position.roomId === alertSession.roomId) {
        ai.state = 'hostile';
        return;
      }

      const nextRoomId = alertSession.alarmState === 'RED'
        ? await this.findNextGraphPatrolRoomId(position.roomId, alertSession.roomId, patrolScope, safeZoneCache)
        : await this.findNextRoutePatrolRoomId(
          ai.patrolRoute,
          position.roomId,
          alertSession.roomId,
          patrolScope,
          safeZoneCache,
        );

      if (!nextRoomId) continue;

      const previousRoomId = position.roomId;
      position.roomId = nextRoomId;
      if (nextRoomId === alertSession.roomId) {
        ai.state = 'hostile';
      }
      const patrolName = this.registry.getComponent<IdentityComponent>(patrolId, ComponentTypes.Identity)?.name
        ?? 'A security patrol';
      this.publishRoomEvent(previousRoomId, {
        text: `${patrolName} departs to investigate an alarm.`,
        type: 'info',
      });
      this.publishRoomEvent(nextRoomId, ai.state === 'hostile'
        ? { text: `${patrolName} arrives and engages the room.`, type: 'combat' }
        : { text: `${patrolName} arrives while sweeping for the alarm source.`, type: 'info' });
      return;
    }
  }

  private async findNextRoutePatrolRoomId(
    patrolRoute: string[] | undefined,
    currentRoomId: string,
    alertRoomId: string,
    patrolScope: string | null,
    safeZoneCache: Map<string, boolean>,
  ): Promise<string | undefined> {
    if (!patrolRoute || patrolRoute.length < 2) return undefined;

    const currentIndex = patrolRoute.indexOf(currentRoomId);
    const alertIndex = patrolRoute.indexOf(alertRoomId);
    if (currentIndex === -1 || alertIndex === -1 || currentIndex === alertIndex) return undefined;

    const nextRouteEntry = patrolRoute[currentIndex + Math.sign(alertIndex - currentIndex)];
    const [currentRoom, nextRoom] = await Promise.all([
      this.worldPolicy.getRoom(currentRoomId),
      this.worldPolicy.getRoom(nextRouteEntry),
    ]);
    if (!Object.values(currentRoom.exits ?? {}).includes(nextRoom.slug)) return undefined;
    if ((currentRoom.missionInstanceId ?? null) !== patrolScope) return undefined;
    if ((nextRoom.missionInstanceId ?? null) !== patrolScope) return undefined;

    const nextRoomSafeZone = await this.tryGetEffectiveSafeZone(nextRoom.id, safeZoneCache);
    if (nextRoomSafeZone !== false) return undefined;

    return nextRoom.id;
  }

  private async findNextGraphPatrolRoomId(
    startRoomId: string,
    alertRoomId: string,
    patrolScope: string | null,
    safeZoneCache: Map<string, boolean>,
  ): Promise<string | undefined> {
    const [startRoom, alertRoom] = await Promise.all([
      this.worldPolicy.getRoom(startRoomId),
      this.worldPolicy.getRoom(alertRoomId),
    ]);
    if (startRoom.id === alertRoom.id) return undefined;
    if ((startRoom.missionInstanceId ?? null) !== patrolScope) return undefined;
    if ((alertRoom.missionInstanceId ?? null) !== patrolScope) return undefined;

    const queue: Array<{ room: AlertPatrolRoom; depth: number; firstStepRoomId?: string }> = [
      { room: startRoom, depth: 0 },
    ];
    const visitedRoomIds = new Set<string>([startRoom.id]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= MAX_RED_PATROL_SEARCH_DEPTH) continue;

      const exits = current.room.exits ?? {};
      for (const exitRoomSlug of Object.values(exits)) {
        if (!exitRoomSlug) continue;

        const nextRoom = await this.worldPolicy.getRoom(exitRoomSlug);
        if (nextRoom.slug !== exitRoomSlug) continue;
        if (visitedRoomIds.has(nextRoom.id)) continue;
        visitedRoomIds.add(nextRoom.id);
        if ((nextRoom.missionInstanceId ?? null) !== patrolScope) continue;

        const nextRoomSafeZone = await this.tryGetEffectiveSafeZone(nextRoom.id, safeZoneCache);
        if (nextRoomSafeZone !== false) continue;

        const firstStepRoomId = current.firstStepRoomId ?? nextRoom.id;
        if (nextRoom.id === alertRoom.id) {
          return firstStepRoomId;
        }

        queue.push({
          room: nextRoom,
          depth: current.depth + 1,
          firstStepRoomId,
        });
      }
    }

    return undefined;
  }

  private async tryGetEffectiveSafeZone(roomId: string, cache: Map<string, boolean>): Promise<boolean | undefined> {
    const cached = cache.get(roomId);
    if (cached !== undefined) return cached;

    try {
      const result = await this.worldPolicy.isEffectiveSafeZone(roomId);
      cache.set(roomId, result);
      return result;
    } catch (err) {
      this.reportLookupFailure(err, { roomId });
      return undefined;
    }
  }

  private reportLookupFailure(err: unknown, context: Record<string, unknown>): void {
    this.diagnostics?.warn(
      { err, ...context },
      'Alert patrol skipped movement due to room or safe-zone lookup failure',
    );
  }

  private publishRoomEvent(roomId: string, event: { text: string; type: 'info' | 'combat' }): void {
    try {
      this.roomEvents?.publish(roomId, event);
    } catch (err) {
      this.diagnostics?.warn({ err, roomId }, 'Alert patrol could not publish room activity');
    }
  }
}
