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

  it('restores the authoritative MissionInstance alert to a linked node', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'YELLOW' }),
      escalateAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('unchanged'),
    };
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);

    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 2,
      alertLevel: 'GREEN',
      linkedRoomId: 'room-1',
      breachProgress: 0,
    });

    await system.onTick(1);

    expect(instanceRepo.findInstanceByRoomId).toHaveBeenCalledWith('room-1');
    expect(matrixRepo.updateNodeAlert).toHaveBeenCalledWith('node-db-1', 'YELLOW');
    expect(instanceRepo.escalateAlertFromRoom).not.toHaveBeenCalled();
  });

  it('retries an instance-to-node write after persistence fails', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = {
      updateNodeAlert: jest.fn()
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce(undefined),
    };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'YELLOW' }),
      escalateAlertFromRoom: jest.fn(),
      ensureAlertFromRoom: jest.fn(),
    };
    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);
    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1', securityLevel: 2, alertLevel: 'GREEN', linkedRoomId: 'room-1', breachProgress: 0,
    });

    await system.onTick(1);
    await system.onTick(2);

    expect(matrixRepo.updateNodeAlert).toHaveBeenCalledTimes(2);
    expect(registry.getComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode)?.alertLevel)
      .toBe('YELLOW');
  });

  it('escalates persisted instance nodes even when no ECS node has been materialized', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = {
      updateNodeAlert: jest.fn(),
      escalateInstanceNodes: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn(),
      escalateAlertFromRoom: jest.fn(),
      ensureAlertFromRoom: jest.fn(),
      findActiveInstanceAlertSources: jest.fn().mockResolvedValue([
        { instanceId: 'inst-1', roomId: 'room-1', alarmState: 'RED' },
      ]),
    };
    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);

    await system.onTick(1);

    expect(matrixRepo.escalateInstanceNodes).toHaveBeenCalledWith('inst-1', 'RED');
  });

  it('escalates the MissionInstance when a linked node has the higher alert', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'GREEN' }),
      escalateAlertFromRoom: jest.fn().mockResolvedValue('escalated'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('escalated'),
    };
    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);
    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1', securityLevel: 2, alertLevel: 'RED', linkedRoomId: 'room-1', breachProgress: 0,
    });

    await system.onTick(1);

    expect(instanceRepo.ensureAlertFromRoom).toHaveBeenCalledWith('room-1', 'RED');
  });

  it('repairs a missing alert source when node and MissionInstance levels match', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn() };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue({
        id: 'inst-1', alertLevel: 'YELLOW', alertSourceRoomId: null,
      }),
      escalateAlertFromRoom: jest.fn().mockResolvedValue('source-updated'),
      ensureAlertFromRoom: jest.fn().mockResolvedValue('source-updated'),
    };
    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);
    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1', securityLevel: 2, alertLevel: 'YELLOW', linkedRoomId: 'room-1', breachProgress: 0,
    });

    await system.onTick(1);

    expect(instanceRepo.ensureAlertFromRoom).toHaveBeenCalledWith('room-1', 'YELLOW');
  });

  it('does NOT call updateInstanceAlertLevel when node has no linked instance', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn().mockResolvedValue(undefined) };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockResolvedValue(null),
      escalateAlertFromRoom: jest.fn(),
      ensureAlertFromRoom: jest.fn(),
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

    expect(instanceRepo.ensureAlertFromRoom).not.toHaveBeenCalled();
  });

  it('does not decay a linked node when MissionInstance lookup fails', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = { updateNodeAlert: jest.fn() };
    const instanceRepo = {
      findInstanceByRoomId: jest.fn().mockRejectedValue(new Error('database unavailable')),
      escalateAlertFromRoom: jest.fn(),
      ensureAlertFromRoom: jest.fn(),
    };
    jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const system = new MatrixTickSystem(registry, matrixRepo as any, instanceRepo as any);
    const nodeEntityId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1', securityLevel: 2, alertLevel: 'YELLOW', linkedRoomId: 'room-1', breachProgress: 0,
    });

    await system.onTick(1);

    expect(matrixRepo.updateNodeAlert).not.toHaveBeenCalled();
  });
});
