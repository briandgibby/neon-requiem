import { AlertPatrolSystem } from '../../src/engine/ecs/systems/alert-patrol-system';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import {
  AiComponent,
  CombatSessionComponent,
  ComponentTypes,
  HealthComponent,
  NpcIdComponent,
  PositionComponent,
} from '../../src/engine/ecs/components';

type TestRoom = {
  id: string;
  slug: string;
  factionOwner: string | null;
  exits: Record<string, string>;
  missionInstanceId?: string | null;
};

function createWorldPolicy(safeRooms: string[] = []) {
  const rooms = new Map<string, TestRoom>([
    ['room-1', { id: 'room-1', slug: 'room-one', factionOwner: null, exits: { east: 'room-two', north: 'safe-room' } }],
    ['room-2', { id: 'room-2', slug: 'room-two', factionOwner: null, exits: { west: 'room-one', east: 'room-three' } }],
    ['room-3', { id: 'room-3', slug: 'room-three', factionOwner: null, exits: { west: 'room-two' } }],
    ['safe-room', { id: 'safe-room', slug: 'safe-room', factionOwner: null, exits: { south: 'room-one', east: 'room-three' } }],
  ]);

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

  const roomsById = new Map<string, TestRoom>(rooms.map((room) => [room.id, room]));
  return {
    isEffectiveSafeZone: jest.fn(() => Promise.resolve(false)),
    getRoom: jest.fn((roomId: string) => {
      const room = roomsById.get(roomId) ?? rooms.find((candidate) => candidate.slug === roomId);
      if (!room) throw new Error(`Missing test room ${roomId}`);
      return Promise.resolve(room);
    }),
  };
}

function withInstanceScopes<T extends ReturnType<typeof createWorldPolicy>>(
  worldPolicy: T,
  instanceByRoomId: Record<string, string | null>,
) {
  return {
    ...worldPolicy,
    getRoom: jest.fn(async (roomId: string) => {
      const room = await worldPolicy.getRoom(roomId);
      return {
        ...room,
        missionInstanceId: instanceByRoomId[room.id] ?? null,
      };
    }),
  };
}

function addPatrol(registry: EcsRegistry, roomId: string, patrolRoute?: string[]): string {
  const entityId = registry.createEntity();
  registry.addComponent<NpcIdComponent>(entityId, ComponentTypes.NpcId, { mobId: entityId });
  registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId });
  registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
    current: 100,
    max: 100,
    lastRegenAt: 0,
  });
  registry.addComponent<AiComponent>(entityId, ComponentTypes.Ai, {
    state: 'patrol',
    patrolRoute,
  });
  return entityId;
}

function addCombatSession(
  registry: EcsRegistry,
  roomId: string,
  alarmState: CombatSessionComponent['alarmState'],
): string {
  const entityId = registry.createEntity();
  registry.addComponent<CombatSessionComponent>(entityId, ComponentTypes.CombatSession, {
    roomId,
    securityRating: 'A',
    alarmState,
    turnsUntilReinforcements: null,
    backupCalled: false,
    tick: 0,
  });
  return entityId;
}

describe('AlertPatrolSystem', () => {
  it('moves patrols toward persisted MissionInstance alert sources', async () => {
    const registry = new EcsRegistry();
    const baseWorldPolicy = createWorldPolicy();
    const worldPolicy = {
      ...baseWorldPolicy,
      getRoom: jest.fn(async (roomId: string) => ({
        ...await baseWorldPolicy.getRoom(roomId),
        missionInstanceId: 'inst-1',
      })),
    };
    const instanceAlerts = {
      escalateAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
      findActiveInstanceAlertSources: jest.fn().mockResolvedValue([
        { instanceId: 'inst-1', roomId: 'room-3', alarmState: 'RED' },
      ]),
    };
    const system = new AlertPatrolSystem(registry, worldPolicy, undefined, instanceAlerts);

    const patrolId = addPatrol(registry, 'room-1');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-2');
  });

  it('does not pull patrols across MissionInstance boundaries', async () => {
    const registry = new EcsRegistry();
    const baseWorldPolicy = createWorldPolicy();
    const worldPolicy = {
      ...baseWorldPolicy,
      getRoom: jest.fn(async (roomId: string) => ({
        ...await baseWorldPolicy.getRoom(roomId),
        missionInstanceId: roomId === 'room-1' || roomId === 'room-one' ? 'inst-a' : 'inst-b',
      })),
    };
    const instanceAlerts = {
      escalateAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
      findActiveInstanceAlertSources: jest.fn().mockResolvedValue([
        { instanceId: 'inst-b', roomId: 'room-3', alarmState: 'RED' },
      ]),
    };
    const system = new AlertPatrolSystem(registry, worldPolicy, undefined, instanceAlerts);
    const patrolId = addPatrol(registry, 'room-1');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('retries CombatSession escalation through the instance alert authority', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const instanceAlerts = {
      escalateAlertFromRoom: jest.fn().mockResolvedValue('escalated'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('escalated'),
      findActiveInstanceAlertSources: jest.fn().mockResolvedValue([]),
    };
    const system = new AlertPatrolSystem(registry, worldPolicy, undefined, instanceAlerts);
    addCombatSession(registry, 'room-2', 'RED');

    await system.onTick(1);

    expect(instanceAlerts.ensureAlertFromRoom).toHaveBeenCalledWith('room-2', 'RED');
  });

  it('ignores lingering ECS alerts from inactive MissionInstances', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = withInstanceScopes(createWorldPolicy(), {
      'room-1': 'inst-1',
      'room-2': 'inst-1',
    });
    const instanceAlerts = {
      escalateAlertFromRoom: jest.fn(),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('inactive-instance'),
      findActiveInstanceAlertSources: jest.fn().mockResolvedValue([]),
    };
    const system = new AlertPatrolSystem(registry, worldPolicy, undefined, instanceAlerts);
    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-2', 'RED');

    await system.onTick(1);

    expect(registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position)?.roomId).toBe('room-1');
  });

  it('does not follow unscoped ECS alerts into another MissionInstance', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = withInstanceScopes(createWorldPolicy(), {
      'room-1': 'inst-a',
      'room-2': 'inst-a',
      'room-3': 'inst-b',
    });
    const system = new AlertPatrolSystem(registry, worldPolicy);
    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-3', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not cross a MissionInstance boundary in an authored YELLOW route', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = withInstanceScopes(createWorldPolicy(), {
      'room-1': 'inst-a',
      'room-2': 'inst-b',
      'room-3': 'inst-a',
    });
    const system = new AlertPatrolSystem(registry, worldPolicy);
    const patrolId = addPatrol(registry, 'room-1', ['room-1', 'room-2', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not cross a MissionInstance boundary during RED graph search', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = withInstanceScopes(createWorldPolicy(), {
      'room-1': 'inst-a',
      'room-2': 'inst-b',
      'room-3': 'inst-a',
    });
    const system = new AlertPatrolSystem(registry, worldPolicy);
    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-3', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not move patrols toward GREEN sessions', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1', ['room-1', 'room-2']);
    addCombatSession(registry, 'room-2', 'GREEN');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('moves YELLOW patrols one route step toward the alerted room', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1', ['room-1', 'room-2', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    const ai = registry.getComponent<AiComponent>(patrolId, ComponentTypes.Ai);
    expect(position?.roomId).toBe('room-2');
    expect(ai?.state).toBe('patrol');
  });

  it('moves RED patrols through connected non-safe rooms without an authored route', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-3', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-2');
  });

  it('does not path through safe-zone rooms', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['safe-room']);
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1', ['room-1', 'safe-room', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not path RED patrols through intermediate safe-zone rooms', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['room-2', 'safe-room']);
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-3', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not move patrols out of an effective safe-zone room', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['safe-room']);
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'safe-room', ['safe-room', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('safe-room');
  });

  it('does not skip non-adjacent rooms in authored YELLOW patrol routes', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1', ['room-1', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('does not traverse id-valued exits during RED patrol expansion', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    worldPolicy.getRoom.mockImplementation((roomId: string) => {
      const rooms = new Map<string, TestRoom>([
        ['room-1', { id: 'room-1', slug: 'room-one', factionOwner: null, exits: { east: 'room-2' } }],
        ['room-2', { id: 'room-2', slug: 'room-two', factionOwner: null, exits: { west: 'room-one' } }],
      ]);
      const room = rooms.get(roomId) ?? Array.from(rooms.values()).find((candidate) => candidate.slug === roomId);
      if (!room) throw new Error(`Missing test room ${roomId}`);
      return Promise.resolve(room);
    });
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-1');
    addCombatSession(registry, 'room-2', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('room-1');
  });

  it('drops RED alerts beyond the bounded patrol search range', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createLinearWorldPolicy(10);
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'linear-1');
    addCombatSession(registry, 'linear-10', 'RED');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    expect(position?.roomId).toBe('linear-1');
  });

  it('reports lookup failures without stopping other patrols', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    worldPolicy.getRoom.mockImplementation((roomId: string) => {
      if (roomId === 'missing-room') throw new Error('missing room');
      const rooms = new Map<string, TestRoom>([
        ['room-1', { id: 'room-1', slug: 'room-one', factionOwner: null, exits: { east: 'room-two' } }],
        ['room-2', { id: 'room-2', slug: 'room-two', factionOwner: null, exits: { west: 'room-one' } }],
      ]);
      const room = rooms.get(roomId) ?? Array.from(rooms.values()).find((candidate) => candidate.slug === roomId);
      if (!room) throw new Error(`Missing test room ${roomId}`);
      return Promise.resolve(room);
    });
    const diagnostics = { warn: jest.fn() };
    const system = new AlertPatrolSystem(registry, worldPolicy, diagnostics);

    const stalePatrolId = addPatrol(registry, 'room-1', ['room-1', 'missing-room']);
    const movingPatrolId = addPatrol(registry, 'room-1', ['room-1', 'room-2']);
    addCombatSession(registry, 'missing-room', 'YELLOW');
    addCombatSession(registry, 'room-2', 'YELLOW');

    await system.onTick(1);

    const stalePosition = registry.getComponent<PositionComponent>(stalePatrolId, ComponentTypes.Position);
    const movingPosition = registry.getComponent<PositionComponent>(movingPatrolId, ComponentTypes.Position);
    expect(stalePosition?.roomId).toBe('room-1');
    expect(movingPosition?.roomId).toBe('room-2');
    expect(diagnostics.warn).toHaveBeenCalledWith(
      expect.objectContaining({ patrolId: stalePatrolId }),
      'Alert patrol skipped movement due to room or safe-zone lookup failure',
    );
  });

  it('turns hostile when a patrol reaches the alerted room', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy();
    const system = new AlertPatrolSystem(registry, worldPolicy);

    const patrolId = addPatrol(registry, 'room-2', ['room-2', 'room-3']);
    addCombatSession(registry, 'room-3', 'YELLOW');

    await system.onTick(1);

    const position = registry.getComponent<PositionComponent>(patrolId, ComponentTypes.Position);
    const ai = registry.getComponent<AiComponent>(patrolId, ComponentTypes.Ai);
    expect(position?.roomId).toBe('room-3');
    expect(ai?.state).toBe('hostile');
  });
});
