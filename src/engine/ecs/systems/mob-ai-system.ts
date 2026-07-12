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
  NpcIdComponent,
  PlayerIdComponent,
  PositionComponent,
  SkillsComponent,
} from '../components';
import { RoomLookup, SafeZonePolicy } from '../../../domains/world/world.types';

interface MobAiWorldPolicy extends SafeZonePolicy, RoomLookup {}

export class MobAiSystem implements Tickable {
  readonly name = 'ecs_mob_ai_system';
  readonly frequency = 3;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
    private readonly worldPolicy: MobAiWorldPolicy,
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
        if (ai.targetEntityId && await this.tryPursueTarget(ai, position, ai.targetEntityId, safeZoneCache)) {
          continue;
        }
        ai.targetEntityId = undefined;
        continue;
      }

      ai.targetEntityId = targetId;
      const attackTargetId = this.findGuardForTarget(targetId, position.roomId) ?? targetId;

      try {
        await this.moveDispatcher.dispatch('attack', mobId, attackTargetId, { registry: this.registry });
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

    let canReachTarget = false;
    let nextRoomId = targetRoomId;
    try {
      const [currentRoom, targetRoom] = await Promise.all([
        this.worldPolicy.getRoom(mobPosition.roomId),
        this.worldPolicy.getRoom(targetRoomId),
      ]);
      const exits = currentRoom.exits ?? {};
      canReachTarget = Object.values(exits).includes(targetRoom.slug);
      nextRoomId = targetRoom.id;
    } catch (_err) {
      ai.targetEntityId = undefined;
      return true;
    }

    if (!canReachTarget) return false;

    mobPosition.roomId = nextRoomId;
    return true;
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
}
