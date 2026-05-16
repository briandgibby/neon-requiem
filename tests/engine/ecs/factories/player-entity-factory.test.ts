import { EcsRegistry } from '../../../../src/engine/ecs/registry';
import { ComponentTypes } from '../../../../src/engine/ecs/components';
import { PlayerEntityFactory, PlayerCharacterData } from '../../../../src/engine/ecs/factories/player-entity-factory';

const MINIMAL_CHARACTER: PlayerCharacterData = {
  id: 'char-1',
  accountId: 'acc-1',
  name: 'Fox',
  className: 'decker',
  currentHp: 80,  maxHp: 100,
  currentStun: 60, maxStun: 80,
  currentMana: 0,  maxMana: 0,
  level: 5,
  body: 4, agility: 6, dexterity: 5, strength: 3,
  logic: 7, intuition: 6, willpower: 5, charisma: 4, luck: 3,
  masteryCQC: 2, masteryPistol: 3, masteryRifle: 1, masteryAutomatic: 1,
  armorValue: 8,
};

describe('PlayerEntityFactory.createFromRecord', () => {
  let registry: EcsRegistry;

  beforeEach(() => {
    registry = new EcsRegistry();
  });

  it('creates an entity with all 9 base components', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');

    expect(registry.getComponent(entityId, ComponentTypes.PlayerId)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Identity)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Position)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Health)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Stun)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Mana)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Attributes)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.Skills)).toBeDefined();
    expect(registry.getComponent(entityId, ComponentTypes.CharacterClass)).toBeDefined();
  });

  it('does NOT add combat-operational components (Ap, CombatStatus)', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');

    expect(registry.getComponent(entityId, ComponentTypes.Ap)).toBeUndefined();
    expect(registry.getComponent(entityId, ComponentTypes.CombatStatus)).toBeUndefined();
  });

  it('sets PlayerId from character record', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');
    const playerId = registry.getComponent<any>(entityId, ComponentTypes.PlayerId);

    expect(playerId.characterId).toBe('char-1');
    expect(playerId.accountId).toBe('acc-1');
  });

  it('sets Position to provided roomId', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-42');
    const pos = registry.getComponent<any>(entityId, ComponentTypes.Position);

    expect(pos.roomId).toBe('room-42');
  });

  it('sets Health from character current/max values', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');
    const health = registry.getComponent<any>(entityId, ComponentTypes.Health);

    expect(health.current).toBe(80);
    expect(health.max).toBe(100);
  });

  it('sets CharacterClass from character className', () => {
    const entityId = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');
    const cls = registry.getComponent<any>(entityId, ComponentTypes.CharacterClass);

    expect(cls.className).toBe('decker');
  });

  it('two calls produce distinct entities', () => {
    const a = PlayerEntityFactory.createFromRecord(registry, MINIMAL_CHARACTER, 'room-1');
    const b = PlayerEntityFactory.createFromRecord(registry, { ...MINIMAL_CHARACTER, id: 'char-2' }, 'room-1');

    expect(a).not.toBe(b);
    expect(registry.entityCount).toBe(2);
  });
});
