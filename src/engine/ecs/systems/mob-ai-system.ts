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
import { SafeZonePolicy } from '../../../domains/world/world.types';

export class MobAiSystem implements Tickable {
  readonly name = 'ecs_mob_ai_system';
  readonly frequency = 3;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
    private readonly safeZonePolicy: SafeZonePolicy,
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

      if (await this.isEffectiveSafeZone(position.roomId, safeZoneCache)) {
        ai.targetEntityId = undefined;
        continue;
      }

      const targetId = this.findTargetInRoom(position.roomId, ai.targetEntityId);
      if (!targetId) {
        ai.targetEntityId = undefined;
        continue;
      }

      ai.targetEntityId = targetId;

      try {
        await this.moveDispatcher.dispatch('attack', mobId, targetId, { registry: this.registry });
      } catch (_err) {
        this.startRecoveryIfSpent(status, mobId);
        // AI action failures should not stop the rest of the heartbeat.
      }
    }
  }

  private async isEffectiveSafeZone(roomId: string, cache: Map<string, boolean>): Promise<boolean> {
    const cached = cache.get(roomId);
    if (cached !== undefined) return cached;

    const result = await this.safeZonePolicy.isEffectiveSafeZone(roomId);
    cache.set(roomId, result);
    return result;
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

    return this.getPhysicalRoomId(entityId, position) === roomId;
  }

  private getPhysicalRoomId(entityId: EntityId, position: PositionComponent): string {
    const decker = this.registry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
    return decker?.physicalRoomId || position.roomId;
  }

  private startRecoveryIfSpent(status: CombatStatusComponent, mobId: EntityId): void {
    if (status.state === 'recovering') return;

    const ap = this.registry.getComponent<ApComponent>(mobId, ComponentTypes.Ap);
    if (!ap || ap.current >= ap.max) return;

    status.state = 'recovering';
    ap.recoveryTicks = Math.max(ap.recoveryTicks, 1);
  }
}
