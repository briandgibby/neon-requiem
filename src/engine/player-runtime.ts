import { MAX_AP } from '../shared/constants';
import {
  ApComponent,
  CombatStatusComponent,
  ComponentTypes,
  PlayerIdComponent,
  PositionComponent,
} from './ecs/components';
import { PlayerCharacterData, PlayerEntityFactory } from './ecs/factories/player-entity-factory';
import { EcsRegistry, EntityId } from './ecs/registry';

export type RuntimeCharacterData = PlayerCharacterData & {
  currentAp: number;
  apRecoveryTicks: number;
};

export class PlayerRuntime {
  constructor(private readonly registry: EcsRegistry) {}

  loadCharacter(character: RuntimeCharacterData, roomId: string): EntityId {
    let entityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === character.id,
    );

    if (!entityId) {
      entityId = PlayerEntityFactory.createFromRecord(this.registry, character, roomId);
      this.registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
        current: character.currentAp,
        max: MAX_AP,
        lastRegenAt: Date.now(),
        recoveryTicks: character.currentAp <= 0 ? Math.max(1, character.apRecoveryTicks) : 0,
      });
      this.registry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
        state: character.currentAp <= 0 ? 'recovering' : 'idle',
        isPetActive: false,
      });
      return entityId;
    }

    const player = this.registry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
    if (player?.accountId !== character.accountId) {
      throw new Error(`Character ${character.id} is already loaded for another account`);
    }

    const position = this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    if (position) position.roomId = roomId;
    else this.registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId });

    return entityId;
  }

  moveCharacter(characterId: string, roomId: string): void {
    const entityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === characterId,
    );
    if (!entityId) return;
    const position = this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    if (position) position.roomId = roomId;
  }
}
