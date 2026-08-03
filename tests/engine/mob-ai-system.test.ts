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
  IdentityComponent,
  NpcIdComponent,
  PlayerIdComponent,
  PositionComponent,
  SkillsComponent,
} from '../../src/engine/ecs/components';

type TestRoom = {
  id: string;
  slug: string;
  factionOwner: string | null;
  exits: Record<string, string>;
};

function createDispatcher(): MoveDispatcher {
  const dispatcher = new MoveDispatcher();
  dispatcher.register(new AttackExecutor());
  return dispatcher;
}

function createWorldPolicy(safeRooms: string[] = [], roomOverrides: TestRoom[] = []) {
  const rooms = new Map<string, TestRoom>([
    ['room-1', { id: 'room-1', slug: 'room-one', factionOwner: null, exits: { east: 'room-two', north: 'safe-room' } }],
    ['room-2', { id: 'room-2', slug: 'room-two', factionOwner: null, exits: { west: 'room-one', east: 'room-three' } }],
    ['room-3', { id: 'room-3', slug: 'room-three', factionOwner: null, exits: { west: 'room-two' } }],
    ['room-4', { id: 'room-4', slug: 'room-four', factionOwner: null, exits: { west: 'safe-room' } }],
    ['safe-room', { id: 'safe-room', slug: 'safe-room', factionOwner: null, exits: { south: 'room-one', east: 'room-four' } }],
  ]);
  roomOverrides.forEach((room) => rooms.set(room.id, room));

  return {
    isEffectiveSafeZone: jest.fn((roomId: string) => Promise.resolve(safeRooms.includes(roomId))),
    getRoom: jest.fn((roomId: string) => {
      const room = rooms.get(roomId) ?? Array.from(rooms.values()).find((candidate) => candidate.slug === roomId);
      if (!room) throw new Error(`Missing test room ${roomId}`);
      return Promise.resolve(room);
    }),
  };
}

function createLinearWorldPolicy(roomCount: number) {
  const rooms = Array.from({ length: roomCount }, (_, index): TestRoom => {
    const roomNumber = index + 1;
    const exits: Record<string, string> = {};
    if (roomNumber > 1) exits.west = `linear-${roomNumber - 1}`;
    if (roomNumber < roomCount) exits.east = `linear-${roomNumber + 1}`;

    return {
      id: `linear-${roomNumber}`,
      slug: `linear-${roomNumber}`,
      factionOwner: null,
      exits,
    };
  });

  return createWorldPolicy([], rooms);
}

function addPhysicalPlayer(registry: EcsRegistry, roomId: string): string {
  const entityId = registry.createEntity();
  registry.addComponent<IdentityComponent>(entityId, ComponentTypes.Identity, {
    name: 'Runner',
    slug: 'runner',
  });
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

function addBodyGuard(registry: EcsRegistry, roomId: string, guardedEntityId: string): string {
  const entityId = addPhysicalPlayer(registry, roomId);
  registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
    current: 6,
    max: 6,
    lastRegenAt: 0,
    recoveryTicks: 0,
  });
  registry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
    state: 'guarding',
    isPetActive: false,
    guardedEntityId,
  });
  return entityId;
}

function addHostileMob(registry: EcsRegistry, roomId: string): string {
  const entityId = registry.createEntity();
  registry.addComponent<IdentityComponent>(entityId, ComponentTypes.Identity, {
    name: 'Hostile Guard',
    slug: 'hostile-guard',
  });
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
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-1');
    const mobId = addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    expect(playerHealth?.current).toBeLessThan(100);
    expect(ai?.targetEntityId).toBe(playerId);
  });

  it('publishes autonomous attacks to the physical room combat log', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn() };
    const system = new MobAiSystem(registry, createDispatcher(), createWorldPolicy(), roomEvents);
    addPhysicalPlayer(registry, 'room-1');
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    expect(roomEvents.publish).toHaveBeenCalledWith('room-1', {
      text: expect.stringMatching(/^Hostile Guard attacks Runner for \d+ damage\.$/),
      type: 'combat',
    });
  });

  it('publishes updated health to the player hit by an autonomous attack', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn() };
    const characterUpdates = { publish: jest.fn() };
    const system = new (MobAiSystem as any)(
      registry,
      createDispatcher(),
      createWorldPolicy(),
      roomEvents,
      characterUpdates,
    );
    const playerId = addPhysicalPlayer(registry, 'room-1');
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const health = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(characterUpdates.publish).toHaveBeenCalledWith(playerId, {
      currentHp: health?.current,
      maxHp: 100,
    });
  });

  it('does not interrupt an autonomous attack when room output fails', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn(() => { throw new Error('socket unavailable'); }) };
    const system = new MobAiSystem(registry, createDispatcher(), createWorldPolicy(), roomEvents);
    const playerId = addPhysicalPlayer(registry, 'room-1');
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    expect(registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health)?.current).toBeLessThan(100);
  });

  it('does not attack in an effective safe zone', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['safe-room']);
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'safe-room');
    addHostileMob(registry, 'safe-room');

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(playerHealth?.current).toBe(100);
  });

  it('targets a jacked-in decker by physical room instead of matrix position', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

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

  it('redirects attacks on a jacked-in decker body to a body guard in the same physical room', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

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
    const guardId = addBodyGuard(registry, 'room-1', deckerId);
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const deckerHealth = registry.getComponent<HealthComponent>(deckerId, ComponentTypes.Health);
    const guardHealth = registry.getComponent<HealthComponent>(guardId, ComponentTypes.Health);
    expect(deckerHealth?.current).toBe(100);
    expect(guardHealth?.current).toBeLessThan(100);
  });

  it('publishes body-guard interception to the room combat log', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn() };
    const system = new MobAiSystem(registry, createDispatcher(), createWorldPolicy(), roomEvents);
    const deckerId = addPhysicalPlayer(registry, 'matrix-node-1');
    registry.addComponent<DeckerComponent>(deckerId, ComponentTypes.Decker, {
      activeNodeEntityId: 'matrix-node-1', physicalRoomId: 'room-1', attack: 5, sleaze: 5,
      firewall: 5, biofeedbackBuffer: 5, overwatchScore: 0,
    });
    const guardId = addBodyGuard(registry, 'room-1', deckerId);
    registry.addComponent<IdentityComponent>(guardId, ComponentTypes.Identity, {
      name: 'Body Guard', slug: 'body-guard',
    });
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    expect(roomEvents.publish).toHaveBeenCalledWith('room-1', {
      text: expect.stringMatching(/^Hostile Guard attacks Runner, but Body Guard intercepts the blow for \d+ damage\.$/),
      type: 'combat',
    });
  });

  it('does not interrupt mob AP recovery when it cannot attack yet', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

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
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);
    const combatTick = new CombatTickSystem(registry);

    const playerId = addPhysicalPlayer(registry, 'room-1');
    const mobId = addHostileMob(registry, 'room-1');
    const mobAp = registry.getComponent<ApComponent>(mobId, ComponentTypes.Ap);
    if (mobAp) mobAp.current = 6;

    await system.onTick(1);
    const healthAfterFirstAttack = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health)?.current ?? 100;

    await system.onTick(2);
    for (let tick = 3; tick <= 7; tick++) {
      await combatTick.onTick(tick);
    }
    await system.onTick(8);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(healthAfterFirstAttack).toBeLessThan(100);
    expect(playerHealth?.current).toBeLessThan(healthAfterFirstAttack);
  });

  it('follows an existing target into an adjacent non-safe room', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-2');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(mobPosition?.roomId).toBe('room-2');
    expect(playerHealth?.current).toBe(100);
    expect(ai?.targetEntityId).toBe(playerId);
  });

  it('publishes pursuit departure and arrival to the affected rooms', async () => {
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn() };
    const system = new MobAiSystem(registry, createDispatcher(), createWorldPolicy(), roomEvents);
    const playerId = addPhysicalPlayer(registry, 'room-2');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    expect(roomEvents.publish).toHaveBeenNthCalledWith(1, 'room-1', {
      text: 'Hostile Guard races after Runner.', type: 'info',
    });
    expect(roomEvents.publish).toHaveBeenNthCalledWith(2, 'room-2', {
      text: 'Hostile Guard arrives in pursuit of Runner.', type: 'info',
    });
  });

  it('does not interrupt pursuit when room output fails', async () => {
    const registry = new EcsRegistry();
    const roomEvents = { publish: jest.fn(() => { throw new Error('socket unavailable'); }) };
    const system = new MobAiSystem(registry, createDispatcher(), createWorldPolicy(), roomEvents);
    const playerId = addPhysicalPlayer(registry, 'room-2');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    expect(registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position)?.roomId).toBe('room-2');
    expect(roomEvents.publish).toHaveBeenCalledTimes(2);
  });

  it('moves one room along a path toward an existing target multiple rooms away', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-3');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(mobPosition?.roomId).toBe('room-2');
    expect(playerHealth?.current).toBe(100);
    expect(ai?.targetEntityId).toBe(playerId);
  });

  it('drops its target instead of following across a safe-zone boundary', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['safe-room']);
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'safe-room');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    expect(mobPosition?.roomId).toBe('room-1');
    expect(ai?.targetEntityId).toBeUndefined();
  });

  it('does not path through an intermediate safe-zone room during pursuit', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['safe-room']);
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-4');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    expect(mobPosition?.roomId).toBe('room-1');
    expect(ai?.targetEntityId).toBeUndefined();
  });

  it('drops a target beyond the bounded pursuit search range', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createLinearWorldPolicy(10);
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'linear-10');
    const mobId = addHostileMob(registry, 'linear-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    expect(mobPosition?.roomId).toBe('linear-1');
    expect(ai?.targetEntityId).toBeUndefined();
  });

  it('does not pursue through exits that only resolve as room ids', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy([], [
      { id: 'room-1', slug: 'room-one', factionOwner: null, exits: { east: 'room-2' } },
    ]);
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-2');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    const mobPosition = registry.getComponent<PositionComponent>(mobId, ComponentTypes.Position);
    expect(mobPosition?.roomId).toBe('room-1');
    expect(ai?.targetEntityId).toBeUndefined();
  });

  it('drops a stale target when pursuit room lookup fails', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    worldPolicy.getRoom.mockRejectedValue(new Error('missing room'));
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    const playerId = addPhysicalPlayer(registry, 'room-2');
    const mobId = addHostileMob(registry, 'room-1');
    const ai = registry.getComponent<AiComponent>(mobId, ComponentTypes.Ai);
    if (ai) ai.targetEntityId = playerId;

    await system.onTick(1);

    expect(ai?.targetEntityId).toBeUndefined();
  });

  it('isolates stale safe-zone lookups to the affected mob', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    worldPolicy.isEffectiveSafeZone.mockImplementation((roomId: string) => {
      if (roomId === 'missing-room') return Promise.reject(new Error('missing room'));
      return Promise.resolve(false);
    });
    const system = new MobAiSystem(registry, createDispatcher(), worldPolicy);

    addHostileMob(registry, 'missing-room');
    const playerId = addPhysicalPlayer(registry, 'room-1');
    addHostileMob(registry, 'room-1');

    await system.onTick(1);

    const playerHealth = registry.getComponent<HealthComponent>(playerId, ComponentTypes.Health);
    expect(playerHealth?.current).toBeLessThan(100);
  });
});
