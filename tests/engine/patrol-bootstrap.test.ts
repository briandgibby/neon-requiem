import { PatrolBootstrap } from '../../src/engine/patrol-bootstrap';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import {
  AiComponent,
  ComponentTypes,
  PatrolDefinitionComponent,
  PositionComponent,
} from '../../src/engine/ecs/components';
import { MobTemplateRecord } from '../../src/domains/combat/combat.types';

const template: MobTemplateRecord = {
  id: 'template-1',
  slug: 'security-guard',
  name: 'Corporate Security Guard',
  level: 5,
  body: 6,
  agility: 5,
  dexterity: 5,
  strength: 6,
  logic: 4,
  intuition: 4,
  willpower: 5,
  charisma: 4,
  maxHp: 80,
  maxAp: 6,
  armorValue: 5,
  masteryCQC: 4,
  masteryPistol: 4,
  masteryRifle: 0,
  masteryAutomatic: 0,
};

function createWorldPolicy(safeRoomIds: string[] = [], instanceRoomIds: string[] = []) {
  const rooms = new Map([
    ['room-one', {
      id: 'room-1', slug: 'room-one', factionOwner: null, missionInstanceId: null,
      exits: { east: 'room-two' },
    }],
    ['room-two', {
      id: 'room-2', slug: 'room-two', factionOwner: null, missionInstanceId: null,
      exits: { west: 'room-one', east: 'room-three' },
    }],
    ['room-three', {
      id: 'room-3', slug: 'room-three', factionOwner: null, missionInstanceId: null,
      exits: { west: 'room-two', east: 'room-four' },
    }],
    ['room-four', {
      id: 'room-4', slug: 'room-four', factionOwner: null, missionInstanceId: null,
      exits: { west: 'room-three' },
    }],
  ]);

  return {
    getRoom: jest.fn((slug: string) => {
      const room = rooms.get(slug);
      if (!room) throw new Error(`Missing room ${slug}`);
      return Promise.resolve({
        ...room,
        missionInstanceId: instanceRoomIds.includes(room.id) ? 'instance-1' : null,
      });
    }),
    isEffectiveSafeZone: jest.fn((roomId: string) => Promise.resolve(safeRoomIds.includes(roomId))),
  };
}

describe('PatrolBootstrap', () => {
  it('materializes an enabled persisted definition as a patrol-state ECS mob', async () => {
    const registry = new EcsRegistry();
    const definitions = {
      listEnabled: jest.fn().mockResolvedValue([{
        id: 'patrol-1',
        slug: 'arcology-sweep',
        startRoomSlug: 'room-one',
        routeRoomSlugs: ['room-one', 'room-two', 'room-three'],
        mobTemplate: template,
      }]),
    };
    const bootstrap = new PatrolBootstrap(registry, definitions, createWorldPolicy(), { warn: jest.fn() });

    await expect(bootstrap.load()).resolves.toBe(1);

    const patrolId = registry.getEntityByComponent<PatrolDefinitionComponent>(
      ComponentTypes.PatrolDefinition,
      (definition) => definition.definitionId === 'patrol-1',
    );
    expect(patrolId).toBeDefined();
    expect(registry.getComponent<PositionComponent>(patrolId!, ComponentTypes.Position)?.roomId).toBe('room-1');
    expect(registry.getComponent<AiComponent>(patrolId!, ComponentTypes.Ai)).toEqual({
      state: 'patrol',
      patrolRoute: ['room-1', 'room-2', 'room-3'],
    });
  });

  it('does not duplicate a living patrol when startup loading is repeated', async () => {
    const registry = new EcsRegistry();
    const definitions = {
      listEnabled: jest.fn().mockResolvedValue([{
        id: 'patrol-1', slug: 'arcology-sweep', startRoomSlug: 'room-one',
        routeRoomSlugs: ['room-one', 'room-two'], mobTemplate: template,
      }]),
    };
    const bootstrap = new PatrolBootstrap(registry, definitions, createWorldPolicy(), { warn: jest.fn() });

    await expect(bootstrap.load()).resolves.toBe(1);
    await expect(bootstrap.load()).resolves.toBe(0);
    expect(registry.getEntitiesWith([ComponentTypes.PatrolDefinition])).toHaveLength(1);
  });

  it('does not duplicate a patrol when startup loading overlaps', async () => {
    const registry = new EcsRegistry();
    const definitions = {
      listEnabled: jest.fn().mockResolvedValue([{
        id: 'patrol-1', slug: 'arcology-sweep', startRoomSlug: 'room-one',
        routeRoomSlugs: ['room-one', 'room-two'], mobTemplate: template,
      }]),
    };
    const bootstrap = new PatrolBootstrap(registry, definitions, createWorldPolicy(), { warn: jest.fn() });

    await expect(Promise.all([bootstrap.load(), bootstrap.load()])).resolves.toEqual([1, 0]);
    expect(registry.getEntitiesWith([ComponentTypes.PatrolDefinition])).toHaveLength(1);
  });

  it('isolates invalid, non-adjacent, safe-zone, and instance-scoped routes', async () => {
    const registry = new EcsRegistry();
    const worldPolicy = createWorldPolicy(['room-4'], ['room-2']);
    const definitions = {
      listEnabled: jest.fn().mockResolvedValue([
        {
          id: 'bad-json', slug: 'bad-json', startRoomSlug: 'room-one',
          routeRoomSlugs: 'room-one', mobTemplate: template,
        },
        {
          id: 'bad-start', slug: 'bad-start', startRoomSlug: 'room-two',
          routeRoomSlugs: ['room-one', 'room-two'], mobTemplate: template,
        },
        {
          id: 'safe-route', slug: 'safe-route', startRoomSlug: 'room-three',
          routeRoomSlugs: ['room-three', 'room-four'], mobTemplate: template,
        },
        {
          id: 'non-adjacent', slug: 'non-adjacent', startRoomSlug: 'room-one',
          routeRoomSlugs: ['room-one', 'room-three'], mobTemplate: template,
        },
        {
          id: 'instance-route', slug: 'instance-route', startRoomSlug: 'room-one',
          routeRoomSlugs: ['room-one', 'room-two'], mobTemplate: template,
        },
        {
          id: 'repeated-room', slug: 'repeated-room', startRoomSlug: 'room-one',
          routeRoomSlugs: ['room-one', 'room-two', 'room-one'], mobTemplate: template,
        },
      ]),
    };
    const diagnostics = { warn: jest.fn() };
    const bootstrap = new PatrolBootstrap(registry, definitions, worldPolicy, diagnostics);

    await expect(bootstrap.load()).resolves.toBe(0);
    expect(diagnostics.warn).toHaveBeenCalledTimes(6);
    expect(registry.getEntitiesWith([ComponentTypes.PatrolDefinition])).toHaveLength(0);
  });
});
