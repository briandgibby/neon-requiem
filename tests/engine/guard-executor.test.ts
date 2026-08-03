import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { GuardExecutor } from '../../src/engine/ecs/combat/moves/guard-executor';
import {
  ApComponent,
  CombatStatusComponent,
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  PositionComponent,
} from '../../src/engine/ecs/components';

function addCombatant(registry: EcsRegistry, roomId: string): string {
  const entityId = registry.createEntity();
  registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId });
  registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
    current: 100,
    max: 100,
    lastRegenAt: 0,
  });
  registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
    current: 6,
    max: 6,
    lastRegenAt: 0,
    recoveryTicks: 0,
  });
  registry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
    state: 'engaged',
    isPetActive: false,
  });
  return entityId;
}

describe('GuardExecutor', () => {
  it('marks the actor as guarding a target in the same room', async () => {
    const registry = new EcsRegistry();
    const dispatcher = new MoveDispatcher();
    dispatcher.register(new GuardExecutor());
    const actorId = addCombatant(registry, 'room-1');
    const targetId = addCombatant(registry, 'room-1');

    const result = await dispatcher.dispatch('guard', actorId, targetId, { registry });

    const status = registry.getComponent<CombatStatusComponent>(actorId, ComponentTypes.CombatStatus);
    expect(result.success).toBe(true);
    expect(status?.state).toBe('guarding');
    expect(status?.guardedEntityId).toBe(targetId);
  });

  it('rejects guarding a target in another physical room', async () => {
    const registry = new EcsRegistry();
    const dispatcher = new MoveDispatcher();
    dispatcher.register(new GuardExecutor());
    const actorId = addCombatant(registry, 'room-1');
    const targetId = addCombatant(registry, 'room-2');

    await expect(dispatcher.dispatch('guard', actorId, targetId, { registry }))
      .rejects.toThrow('same room');
  });

  it('allows guarding a jacked-in decker by the decker physical body room', async () => {
    const registry = new EcsRegistry();
    const dispatcher = new MoveDispatcher();
    dispatcher.register(new GuardExecutor());
    const actorId = addCombatant(registry, 'room-1');
    const deckerId = addCombatant(registry, 'matrix-node-1');
    registry.addComponent<DeckerComponent>(deckerId, ComponentTypes.Decker, {
      activeNodeEntityId: 'matrix-node-1',
      physicalRoomId: 'room-1',
      attack: 5,
      sleaze: 5,
      firewall: 5,
      biofeedbackBuffer: 5,
      overwatchScore: 0,
    });

    await dispatcher.dispatch('guard', actorId, deckerId, { registry });

    const status = registry.getComponent<CombatStatusComponent>(actorId, ComponentTypes.CombatStatus);
    expect(status?.state).toBe('guarding');
    expect(status?.guardedEntityId).toBe(deckerId);
  });
});
