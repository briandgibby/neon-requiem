import { EcsRegistry, EntityId } from '../registry';
import { Tickable } from '../../heartbeat';
import { MoveDispatcher } from '../combat/move-dispatcher';
import {
  AiComponent,
  ApComponent,
  AttributesComponent,
  CombatStatusComponent,
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  IdentityComponent,
  NpcIdComponent,
  PlayerIdComponent,
  PositionComponent,
  SkillsComponent,
} from '../components';
import { RoomLookup, SafeZonePolicy } from '../../../domains/world/world.types';
import { RoomEventPublisher } from '../../room-event-publisher';

interface MobAiWorldPolicy extends SafeZonePolicy, RoomLookup {}
type MobAiRoom = Awaited<ReturnType<RoomLookup['getRoom']>>;

// Keep heartbeat work bounded; targets beyond this range are treated as lost scent.
const MAX_PURSUIT_SEARCH_DEPTH = 8;

export class MobAiSystem implements Tickable {
  readonly name = 'ecs_mob_ai_system';
  readonly frequency = 3;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
    private readonly worldPolicy: MobAiWorldPolicy,
    private readonly roomEvents?: RoomEventPublisher,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const safeZoneCache = new Map<string, boolean>();
    const mobIds = this.registry.getEntitiesWith([
      ComponentTypes.NpcId,
      ComponentTypes.Ai,
      ComponentTypes.Position,
      ComponentTypes.Health,
      ComponentTypes.CombatStatus,
    ]);

    for (const mobId of mobIds) {
      const ai = this.registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
      const position = this.registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
      const health = this.registry.getComponent<HealthComponent>(mobId, ComponentTypes.Health);
      const status = this.registry.getComponent<CombatStatusComponent>(mobId, ComponentTypes.CombatStatus);

      if (!ai || !position || !health || !status) continue;
      if (health.current <= 0 || ai.state !== 'hostile') continue;

      const currentRoomSafeZone = await this.tryGetEffectiveSafeZone(position.roomId, safeZoneCache);
      if (currentRoomSafeZone === undefined) {
        ai.targetEntityId = undefined;
        continue;
      }

      if (currentRoomSafeZone) {
        ai.targetEntityId = undefined;
        continue;
      }

      const targetId = this.findTargetInRoom(position.roomId, ai.targetEntityId);
      if (!targetId) {
        if (ai.targetEntityId && await this.tryPursueTarget(mobId, ai, position, ai.targetEntityId, safeZoneCache)) {
          continue;
        }
        ai.targetEntityId = undefined;
        continue;
      }

      ai.targetEntityId = targetId;
      const attackTargetId = this.findGuardForTarget(targetId, position.roomId) ?? targetId;

      try {
        const result = await this.moveDispatcher.dispatch('attack', mobId, attackTargetId, { registry: this.registry });
        const damage = typeof result.data?.finalDamage === 'number' ? result.data.finalDamage : 0;
        const mobName = this.getEntityName(mobId, 'A hostile');
        const targetName = this.getEntityName(targetId, 'a runner');
        const text = attackTargetId === targetId
          ? `${mobName} attacks ${targetName} for ${damage} damage.`
          : `${mobName} attacks ${targetName}, but ${this.getEntityName(attackTargetId, 'a body guard')} intercepts the blow for ${damage} damage.`;
        this.publishRoomEvent(position.roomId, { text, type: 'combat' });
      } catch (_err) {
        this.startRecoveryIfSpent(status, mobId);
        // AI action failures should not stop the rest of the heartbeat.
      }
    }
  }

  private async tryGetEffectiveSafeZone(roomId: string, cache: Map<string, boolean>): Promise<boolean | undefined> {
    const cached = cache.get(roomId);
    if (cached !== undefined) return cached;

    try {
      const result = await this.worldPolicy.isEffectiveSafeZone(roomId);
      cache.set(roomId, result);
      return result;
    } catch (_err) {
      return undefined;
    }
  }

  private async tryPursueTarget(
    mobId: EntityId,
    ai: AiComponent,
    mobPosition: PositionComponent,
    targetId: EntityId,
    safeZoneCache: Map<string, boolean>,
  ): Promise<boolean> {
    const targetRoomId = this.getTargetPhysicalRoomId(targetId);
    if (!targetRoomId) return false;

    const targetRoomSafeZone = await this.tryGetEffectiveSafeZone(targetRoomId, safeZoneCache);
    if (targetRoomSafeZone === undefined) {
      ai.targetEntityId = undefined;
      return true;
    }

    if (targetRoomSafeZone) {
      ai.targetEntityId = undefined;
      return true;
    }

    try {
      const nextRoomId = await this.findNextPursuitRoomId(mobPosition.roomId, targetRoomId, safeZoneCache);
      if (!nextRoomId) return false;

      const previousRoomId = mobPosition.roomId;
      mobPosition.roomId = nextRoomId;
      const mobName = this.getEntityName(mobId, 'A hostile');
      const targetName = this.getEntityName(targetId, 'a runner');
      this.publishRoomEvent(previousRoomId, {
        text: `${mobName} races after ${targetName}.`,
        type: 'info',
      });
      this.publishRoomEvent(nextRoomId, {
        text: `${mobName} arrives in pursuit of ${targetName}.`,
        type: 'info',
      });
      return true;
    } catch (_err) {
      ai.targetEntityId = undefined;
      return true;
    }
  }

  private async findNextPursuitRoomId(
    startRoomId: string,
    targetRoomId: string,
    safeZoneCache: Map<string, boolean>,
  ): Promise<string | undefined> {
    const [startRoom, targetRoom] = await Promise.all([
      this.worldPolicy.getRoom(startRoomId),
      this.worldPolicy.getRoom(targetRoomId),
    ]);
    if (startRoom.id === targetRoom.id) return undefined;

    const queue: Array<{ room: MobAiRoom; depth: number; firstStepRoomId?: string }> = [
      { room: startRoom, depth: 0 },
    ];
    const visitedRoomIds = new Set<string>([startRoom.id]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= MAX_PURSUIT_SEARCH_DEPTH) continue;

      const exits = current.room.exits ?? {};
      for (const exitRoomSlug of Object.values(exits)) {
        if (!exitRoomSlug) continue;

        const nextRoom = await this.worldPolicy.getRoom(exitRoomSlug);
        if (nextRoom.slug !== exitRoomSlug) continue;
        if (visitedRoomIds.has(nextRoom.id)) continue;
        visitedRoomIds.add(nextRoom.id);

        const nextRoomSafeZone = await this.tryGetEffectiveSafeZone(nextRoom.id, safeZoneCache);
        if (nextRoomSafeZone === undefined) {
          throw new Error('Unable to resolve pursuit safe-zone state');
        }
        if (nextRoomSafeZone) continue;

        const firstStepRoomId = current.firstStepRoomId ?? nextRoom.id;
        if (nextRoom.id === targetRoom.id) {
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

  private findTargetInRoom(roomId: string, preferredTargetId?: EntityId): EntityId | undefined {
    if (preferredTargetId && this.isValidTargetInRoom(preferredTargetId, roomId)) {
      return preferredTargetId;
    }

    const playerIds = this.registry.getEntitiesWith([
      ComponentTypes.PlayerId,
      ComponentTypes.Position,
      ComponentTypes.Health,
      ComponentTypes.Attributes,
      ComponentTypes.Skills,
    ]);

    return playerIds.find((playerId) => this.isValidTargetInRoom(playerId, roomId));
  }

  private isValidTargetInRoom(entityId: EntityId, roomId: string): boolean {
    const player = this.registry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
    const position = this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    const health = this.registry.getComponent<HealthComponent>(entityId, ComponentTypes.Health);
    const attributes = this.registry.getComponent<AttributesComponent>(entityId, ComponentTypes.Attributes);
    const skills = this.registry.getComponent<SkillsComponent>(entityId, ComponentTypes.Skills);

    if (!player || !position || !health || !attributes || !skills) return false;
    if (health.current <= 0) return false;

    return this.getTargetPhysicalRoomId(entityId, position) === roomId;
  }

  private getTargetPhysicalRoomId(entityId: EntityId, knownPosition?: PositionComponent): string | undefined {
    const position = knownPosition ?? this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    if (!position) return undefined;

    const decker = this.registry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
    return decker?.physicalRoomId || position.roomId;
  }

  private findGuardForTarget(targetId: EntityId, roomId: string): EntityId | undefined {
    const targetDecker = this.registry.getComponent<DeckerComponent>(targetId, ComponentTypes.Decker);
    if (!targetDecker) return undefined;

    const guardIds = this.registry.getEntitiesWith([
      ComponentTypes.PlayerId,
      ComponentTypes.Position,
      ComponentTypes.Health,
      ComponentTypes.CombatStatus,
    ]);

    return guardIds.find((guardId) => {
      if (guardId === targetId) return false;

      const status = this.registry.getComponent<CombatStatusComponent>(guardId, ComponentTypes.CombatStatus);
      const health = this.registry.getComponent<HealthComponent>(guardId, ComponentTypes.Health);
      const guardRoomId = this.getTargetPhysicalRoomId(guardId);

      return status?.state === 'guarding'
        && status.guardedEntityId === targetId
        && !!health
        && health.current > 0
        && guardRoomId === roomId;
    });
  }

  private startRecoveryIfSpent(status: CombatStatusComponent, mobId: EntityId): void {
    if (status.state === 'recovering') return;

    const ap = this.registry.getComponent<ApComponent>(mobId, ComponentTypes.Ap);
    if (!ap || ap.current >= ap.max) return;

    status.state = 'recovering';
    ap.recoveryTicks = Math.max(ap.recoveryTicks, 1);
  }

  private getEntityName(entityId: EntityId, fallback: string): string {
    return this.registry.getComponent<IdentityComponent>(entityId, ComponentTypes.Identity)?.name ?? fallback;
  }

  private publishRoomEvent(roomId: string, event: { text: string; type: 'info' | 'combat' }): void {
    try {
      this.roomEvents?.publish(roomId, event);
    } catch (_err) {
      // Realtime output must not interrupt autonomous actions.
    }
  }
}
