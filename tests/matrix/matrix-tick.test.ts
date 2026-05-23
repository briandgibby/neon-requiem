import { MatrixTickSystem } from '../../src/engine/ecs/systems/matrix-tick-system';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, MatrixNodeComponent } from '../../src/engine/ecs/components';

describe('MatrixTickSystem', () => {
  afterEach(() => jest.restoreAllMocks());

  it('flushes alert decay to DB when a YELLOW node transitions to GREEN', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Math, 'random').mockReturnValue(0.05); // below 0.1 threshold → decay fires

    const system = new MatrixTickSystem(registry, matrixRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 2,
      alertLevel: 'YELLOW',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(matrixRepo.updateNodeAlert).toHaveBeenCalledWith('node-db-1', 'GREEN');
  });

  it('does NOT flush when the random roll does not trigger decay', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Math, 'random').mockReturnValue(0.9); // above threshold → no decay

    const system = new MatrixTickSystem(registry, matrixRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 2,
      alertLevel: 'YELLOW',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(matrixRepo.updateNodeAlert).not.toHaveBeenCalled();
  });

  it('does NOT flush RED nodes', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const system = new MatrixTickSystem(registry, matrixRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 4,
      alertLevel: 'RED',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(matrixRepo.updateNodeAlert).not.toHaveBeenCalled();
  });
});

describe('MatrixTickSystem — instance alert sync', () => {
  afterEach(() => jest.restoreAllMocks());

  it('syncs GREEN alert decay to the linked MissionInstance', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'YELLOW' }),
      updateInstanceAlertLevel: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Math, 'random').mockReturnValue(0.05); // triggers decay

    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 2,
      alertLevel: 'YELLOW',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(instanceRepo.findInstanceByRoomId).toHaveBeenCalledWith('room-1');
    expect(instanceRepo.updateInstanceAlertLevel).toHaveBeenCalledWith('inst-1', 'GREEN');
  });

  it('does NOT call updateInstanceAlertLevel when node has no linked instance', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue(null),
      updateInstanceAlertLevel: jest.fn(),
    };
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 2,
      alertLevel: 'YELLOW',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(instanceRepo.updateInstanceAlertLevel).not.toHaveBeenCalled();
  });
});
