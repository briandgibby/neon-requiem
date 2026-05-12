import { EcsRegistry } from '../../src/engine/ecs/registry';
import { EntityCleanupSystem } from '../../src/engine/ecs/systems/entity-cleanup-system';
import { ComponentTypes, HealthComponent, NpcIdComponent, CombatSessionComponent, CombatStatusComponent, MatrixNodeComponent, DeckerComponent, IceComponent, PositionComponent } from '../../src/engine/ecs/components';

describe('EntityCleanupSystem', () => {
  let registry: EcsRegistry;
  let system: EntityCleanupSystem;

  beforeEach(() => {
    registry = new EcsRegistry();
    system = new EntityCleanupSystem(registry);
  });

  it('destroys dead NPCs', async () => {
    const npcId = registry.createEntity();
    registry.addComponent<NpcIdComponent>(npcId, ComponentTypes.NpcId, { mobId: 'mob-1' });
    registry.addComponent<HealthComponent>(npcId, ComponentTypes.Health, { current: 0, max: 10, lastRegenAt: 0 });

    expect(registry.entityCount).toBe(1);
    await system.onTick(20);
    expect(registry.entityCount).toBe(0);
  });

  it('destroys empty combat sessions', async () => {
    const sessionId = registry.createEntity();
    registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
      roomId: 'room-1', securityRating: 'C', alarmState: 'GREEN', turnsUntilReinforcements: null, backupCalled: false, tick: 0
    });

    // No participants
    expect(registry.entityCount).toBe(1);
    await system.onTick(20);
    expect(registry.entityCount).toBe(0);
  });

  it('keeps combat sessions with active participants', async () => {
    const sessionId = registry.createEntity();
    registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
       roomId: 'room-1', securityRating: 'C', alarmState: 'GREEN', turnsUntilReinforcements: null, backupCalled: false, tick: 0
    });

    const playerId = registry.createEntity();
    registry.addComponent<CombatStatusComponent>(playerId, ComponentTypes.CombatStatus, {
       state: 'engaged', isPetActive: false, sessionId
    });

    expect(registry.entityCount).toBe(2);
    await system.onTick(20);
    expect(registry.entityCount).toBe(2); // Kept session
  });

  it('destroys abandoned Matrix nodes and their ICE', async () => {
    const nodeId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
      nodeId: 'db-node', securityLevel: 5, alertLevel: 'GREEN', linkedRoomId: 'room-1', breachProgress: 0,
    });

    const iceId = registry.createEntity();
    registry.addComponent<IceComponent>(iceId, ComponentTypes.Ice, { type: 'WHITE', attack: 5, defense: 5 });
    registry.addComponent<PositionComponent>(iceId, ComponentTypes.Position, { roomId: nodeId }); // linked to node

    // No deckers jacked in
    expect(registry.entityCount).toBe(2);
    await system.onTick(20);
    expect(registry.entityCount).toBe(0);
  });
});
