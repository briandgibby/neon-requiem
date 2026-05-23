import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MissionSystem } from '../../src/engine/ecs/systems/mission-system';
import { ComponentTypes, MissionTargetComponent, HealthComponent, MatrixNodeComponent } from '../../src/engine/ecs/components';

describe('MissionSystem', () => {
  it('triggers callback when a KILL target dies', async () => {
    const registry = new EcsRegistry();
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    const system = new MissionSystem(registry, mockCallback);

    const targetId = registry.createEntity();
    registry.addComponent<MissionTargetComponent>(targetId, ComponentTypes.MissionTarget, {
      missionId: 'mission-1',
      objectiveIndex: 0,
      goalType: 'KILL',
      isCompleted: false
    });
    registry.addComponent<HealthComponent>(targetId, ComponentTypes.Health, {
      current: 10,
      max: 10,
      lastRegenAt: 0
    });

    await system.onTick(1);
    expect(mockCallback).not.toHaveBeenCalled();

    // Kill the target
    const health = registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
    health!.current = 0;

    await system.onTick(2);
    expect(mockCallback).toHaveBeenCalledWith('mission-1', 0);
    
    const target = registry.getComponent<MissionTargetComponent>(targetId, ComponentTypes.MissionTarget);
    expect(target?.isCompleted).toBe(true);
  });

  it('marks a HACK objective complete when breachProgress meets hackThreshold', async () => {
    const registry = new EcsRegistry();
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    const system = new MissionSystem(registry, mockCallback);

    const targetId = registry.createEntity();
    registry.addComponent<MissionTargetComponent>(targetId, ComponentTypes.MissionTarget, {
      missionId: 'mission-2',
      objectiveIndex: 1,
      goalType: 'HACK',
      hackThreshold: 3,
      isCompleted: false,
    });
    registry.addComponent<MatrixNodeComponent>(targetId, ComponentTypes.MatrixNode, {
      nodeId: 'node-1',
      securityLevel: 5,
      alertLevel: 'GREEN',
      linkedRoomId: null,
      breachProgress: 2,
    });

    await system.onTick(1);
    expect(mockCallback).not.toHaveBeenCalled();

    // Reach the threshold
    const node = registry.getComponent<MatrixNodeComponent>(targetId, ComponentTypes.MatrixNode);
    node!.breachProgress = 3;

    await system.onTick(2);
    expect(mockCallback).toHaveBeenCalledWith('mission-2', 1);
  });

  it('does NOT complete a HACK objective when breachProgress is below hackThreshold', async () => {
    const registry = new EcsRegistry();
    const mockCallback = jest.fn().mockResolvedValue(undefined);
    const system = new MissionSystem(registry, mockCallback);

    const targetId = registry.createEntity();
    registry.addComponent<MissionTargetComponent>(targetId, ComponentTypes.MissionTarget, {
      missionId: 'mission-3',
      objectiveIndex: 0,
      goalType: 'HACK',
      hackThreshold: 5,
      isCompleted: false,
    });
    registry.addComponent<MatrixNodeComponent>(targetId, ComponentTypes.MatrixNode, {
      nodeId: 'node-2',
      securityLevel: 3,
      alertLevel: 'RED',
      linkedRoomId: 'room-1',
      breachProgress: 1,
    });

    await system.onTick(1);
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
