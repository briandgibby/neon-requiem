import { MobAiSystem } from '../../src/engine/ecs/systems/mob-ai-system';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { AttackExecutor } from '../../src/engine/ecs/combat/moves/attack-executor';
import { CombatTickSystem } from '../../src/engine/ecs/systems/combat-tick-system';
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
} from '../../src/engine/ecs/components';

function createDispatcher(): MoveDispatcher {
  const dispatcher = new MoveDispatcher();
  dispatcher.register(new AttackExecutor());
  return dispatcher;
}

function addPhysicalPlayer(registry: EcsRegistry, roomId: string): string {
  const entityId = registry.createEntity();
  registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
    characterId: entityId,
    accountId: 'account-1',
  });
  registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId });
  registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
    current: 100,
    max: 100,
    lastRegenAt: 0,
  });
  registry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
    level: 1,
    body: 1,
    agility: 1,
    dexterity: 1,
    strength: 1,
    logic: 1,
    intuition: 1,
    willpower: 1,
    charisma: 1,
    luck: 1,
  });
  registry.addComponent<SkillsComponent>(entityId, ComponentTypes.Skills, {
    masteryCQC: 0,
    masteryPistol: 0,
    masteryRifle: 0,
    masteryAutomatic: 0,
    armorValue: 0,
  });
  return entityId;
}

function addHostileMob(registry: EcsRegistry, roomId: string): string {
  const entityId = registry.createEntity();
  registry.addComponent<NpcIdComponent>(entityId, ComponentTypes.NpcId, { mobId: entityId });
  registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId });
  registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
    current: 100,
    max: 100,
    lastRegenAt: 0,
  });
  registry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
    level: 1,
    body: 10,
    agility: 10,
    dexterity: 10,
    strength: 10,
    logic: 1,
    intuition: 10,
    willpower: 10,
    charisma: 1,
    luck: 1,
  });
  registry.addComponent<SkillsComponent>(entityId, ComponentTypes.Skills, {
    masteryCQC: 10,
    masteryPistol: 0,
    masteryRifle: 0,
    masteryAutomatic: 0,
    armorValue: 0,
  });
  registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
    current: 4,
    max: 6,
    lastRegenAt: 0,
    recoveryTicks: 0,
  });
  registry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
    state: 'engaged',
    isPetActive: false,
  });
  registry.addComponent<AiComponent>(entityId, ComponentTypes.Ai, {
    state: 'hostile',
  });
  return entityId;
}

describe('MobAiSystem', () => {
  afterEach(() => jest.restoreAllMocks());

  it('hostile mobs attack players in the same non-safe physical room', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const safeZonePolicy = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) };
    const system = new MobAiSystem(registry, createDispatcher(), safeZonePolicy);

    const playerId = addPhysicalPlayer(registry, 'room-1');
    const mobId = addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    expect(playerHealth?.current).toBeLessThan(100);
    expect(ai?.targetEntityId).toBe(playerId);
  });

  it('does not attack in an effective safe zone', async () => {
    const registry = new EcsRegistry();
    const safeZonePolicy = { isEffectiveSafeZone: jest.fn().mockResolvedValue(true) };
    const system = new MobAiSystem(registry, createDispatcher(), safeZonePolicy);

    const playerId = addPhysicalPlayer(registry, 'safe-room');
    addHostileMob(registry, 'safe-room');

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(playerHealth?.current).toBe(100);
  });

  it('targets a jacked-in decker by physical room instead of matrix position', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const safeZonePolicy = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) };
    const system = new MobAiSystem(registry, createDispatcher(), safeZonePolicy);

    const deckerId = addPhysicalPlayer(registry, 'matrix-node-1');
    registry.addComponent<DeckerComponent>(deckerId, ComponentTypes.Decker, {
      activeNodeEntityId: 'matrix-node-1',
      physicalRoomId: 'room-1',
      attack: 5,
      sleaze: 5,
      firewall: 5,
      biofeedbackBuffer: 5,
      overwatchScore: 0,
    });
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const deckerHealth = registry.getComponent<HealthComponent>(deckerId, ComponentTypes.Health);
    expect(deckerHealth?.current).toBeLessThan(100);
  });

  it('does not interrupt mob AP recovery when it cannot attack yet', async () => {
    const registry = new EcsRegistry();
    const safeZonePolicy = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) };
    const system = new MobAiSystem(registry, createDispatcher(), safeZonePolicy);

    const playerId = addPhysicalPlayer(registry, 'room-1');
    const mobId = addHostileMob(registry, 'room-1');
    const mobStatus = registry.getComponent<CombatStatusComponent>(mobId, ComponentTypes.CombatStatus);
    const mobAp = registry.getComponent<ApComponent>(mobId, ComponentTypes.Ap);
    if (mobStatus) mobStatus.state = 'recovering';
    if (mobAp) {
      mobAp.current = 0;
      mobAp.recoveryTicks = 2;
    }

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(playerHealth?.current).toBe(100);
    expect(mobStatus?.state).toBe('recovering');
    expect(mobAp?.recoveryTicks).toBe(2);
  });

  it('recovers AP-starved hostile mobs so they can keep attacking later', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const safeZonePolicy = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) };
    const system = new MobAiSystem(registry, createDispatcher(), safeZonePolicy);
    const combatTick = new CombatTickSystem(registry);

    const playerId = addPhysicalPlayer(registry, 'room-1');
    const mobId = addHostileMob(registry, 'room-1');
    const mobAp = registry.getComponent<ApComponent>(mobId, ComponentTypes.Ap);
    if (mobAp) mobAp.current = 6;

    await system.onTick(1);
    const healthAfterFirstAttack = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health)?.current ?? 100;

    await system.onTick(2);
    await combatTick.onTick(3);
    await system.onTick(4);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(healthAfterFirstAttack).toBeLessThan(100);
    expect(playerHealth?.current).toBeLessThan(healthAfterFirstAttack);
  });
});
