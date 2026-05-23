import { InstanceCleanupSystem } from '../../src/engine/ecs/systems/instance-cleanup-system';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, PositionComponent, NpcIdComponent } from '../../src/engine/ecs/components';

describe('InstanceCleanupSystem', () => {
  afterEach(() => jest.restoreAllMocks());

  it('evicts NPC entities whose room belongs to a COMPLETED instance', async () => {
    const registry = new EcsRegistry();

    const npcId = registry.createEntity();
    registry.addComponent<NpcIdComponent>(npcId, ComponentTypes.NpcId, { mobId: npcId });
    registry.addComponent<PositionComponent>(npcId, ComponentTypes.Position, { roomId: 'iroom-1' });

    const instanceRepo = {
      findResolvedInstances: jest.fn().mockResolvedValue([
        { id: 'inst-1', rooms: [{ id: 'iroom-1' }] },
      ]),
      deleteInstanceRooms: jest.fn().mockResolvedValue(undefined),
      deleteInstance: jest.fn().mockResolvedValue(undefined),
    };

    const system = new InstanceCleanupSystem(registry, instanceRepo as any);

    await system.onTick(1);

    const entities = registry.getEntitiesWith([ComponentTypes.Position]);
    expect(entities).not.toContain(npcId);
    expect(instanceRepo.deleteInstanceRooms).toHaveBeenCalledWith('inst-1');
  });

  it('does nothing when there are no resolved instances', async () => {
    const registry = new EcsRegistry();
    const instanceRepo = {
      findResolvedInstances: jest.fn().mockResolvedValue([]),
      deleteInstanceRooms: jest.fn(),
      deleteInstance: jest.fn(),
    };

    const system = new InstanceCleanupSystem(registry, instanceRepo as any);

    await system.onTick(1);

    expect(instanceRepo.deleteInstanceRooms).not.toHaveBeenCalled();
  });
});
