import { ComponentTypes } from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import type { PlayerCharacterData } from '../../src/engine/ecs/factories/player-entity-factory';
import { PlayerRuntime } from '../../src/engine/player-runtime';

const CHARACTER: PlayerCharacterData & { currentAp: number; apRecoveryTicks: number } = {
  id: 'char-1',
  accountId: 'acc-1',
  name: 'Chrome Fox',
  className: 'street-samurai',
  currentHp: 80,
  maxHp: 100,
  currentStun: 60,
  maxStun: 80,
  currentMana: 0,
  maxMana: 0,
  currentAp: 7,
  apRecoveryTicks: 0,
  level: 5,
  body: 4,
  agility: 6,
  dexterity: 5,
  strength: 3,
  logic: 4,
  intuition: 6,
  willpower: 5,
  charisma: 4,
  luck: 3,
  masteryCQC: 2,
  masteryPistol: 3,
  masteryRifle: 1,
  masteryAutomatic: 1,
  armorValue: 8,
};

describe('PlayerRuntime', () => {
  it('loads a selected physical Character into one combat-ready ECS entity', () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);

    const firstId = runtime.loadCharacter(CHARACTER, 'room-1');
    const secondId = runtime.loadCharacter(CHARACTER, 'room-2');

    expect(secondId).toBe(firstId);
    expect(registry.entityCount).toBe(1);
    expect(registry.getComponent<any>(firstId, ComponentTypes.Position)?.roomId).toBe('room-2');
    expect(registry.getComponent<any>(firstId, ComponentTypes.Ap)?.current).toBe(7);
    expect(registry.getComponent<any>(firstId, ComponentTypes.CombatStatus)?.state).toBe('idle');
  });
});
