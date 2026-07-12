import { Tickable } from '../../heartbeat';
import { EcsRegistry } from '../registry';
import {
  AiComponent,
  CombatSessionComponent,
  ComponentTypes,
  HealthComponent,
  PositionComponent,
} from '../components';
import { RoomLookup, SafeZonePolicy } from '../../../domains/world/world.types';

interface AlertPatrolWorldPolicy extends SafeZonePolicy, RoomLookup {}
type AlertPatrolRoom = Awaited<ReturnType<RoomLookup['getRoom']>>;

type ActiveAlertSession = Pick<CombatSessionComponent, 'roomId' | 'alarmState'>;
interface AlertPatrolDiagnostics {
  warn(obj: unknown, msg: string): void;
}

const MAX_RED_PATROL_SEARCH_DEPTH = 8;

export class AlertPatrolSystem implements Tickable {
  readonly name = 'ecs_alert_patrol_system';
  readonly frequency = 1;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly worldPolicy: AlertPatrolWorldPolicy,
    private readonly diagnostics?: AlertPatrolDiagnostics,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const alertSessions = this.getActiveAlertSessions();
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

        await this.moveTowardFirstReachableAlert(ai, position, alertSessions, safeZoneCache);
      } catch (err) {
        this.reportLookupFailure(err, {
          patrolId,
          roomId: position.roomId,
        });
      }
    }
  }

  private getActiveAlertSessions(): ActiveAlertSession[] {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);
    const sessions = sessionIds
      .map((sessionId) => this.registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession))
      .filter((session): session is CombatSessionComponent => !!session && session.alarmState !== 'GREEN');

    return sessions.sort((a, b) => this.alertPriority(b.alarmState) - this.alertPriority(a.alarmState));
  }

  private alertPriority(alarmState: CombatSessionComponent['alarmState']): number {
    if (alarmState === 'RED') return 2;
    if (alarmState === 'YELLOW') return 1;
    return 0;
  }

  private async moveTowardFirstReachableAlert(
    ai: AiComponent,
    position: PositionComponent,
    alertSessions: ActiveAlertSession[],
    safeZoneCache: Map<string, boolean>,
  ): Promise<void> {
    for (const alertSession of alertSessions) {
      if (position.roomId === alertSession.roomId) {
        ai.state = 'hostile';
        return;
      }

      const nextRoomId = alertSession.alarmState === 'RED'
        ? await this.findNextGraphPatrolRoomId(position.roomId, alertSession.roomId, safeZoneCache)
        : await this.findNextRoutePatrolRoomId(ai.patrolRoute, position.roomId, alertSession.roomId, safeZoneCache);

      if (!nextRoomId) continue;

      position.roomId = nextRoomId;
      if (nextRoomId === alertSession.roomId) {
        ai.state = 'hostile';
      }
      return;
    }
  }

  private async findNextRoutePatrolRoomId(
    patrolRoute: string[] | undefined,
    currentRoomId: string,
    alertRoomId: string,
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

    const nextRoomSafeZone = await this.tryGetEffectiveSafeZone(nextRoom.id, safeZoneCache);
    if (nextRoomSafeZone !== false) return undefined;

    return nextRoom.id;
  }

  private async findNextGraphPatrolRoomId(
    startRoomId: string,
    alertRoomId: string,
    safeZoneCache: Map<string, boolean>,
  ): Promise<string | undefined> {
    const [startRoom, alertRoom] = await Promise.all([
      this.worldPolicy.getRoom(startRoomId),
      this.worldPolicy.getRoom(alertRoomId),
    ]);
    if (startRoom.id === alertRoom.id) return undefined;

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
}
