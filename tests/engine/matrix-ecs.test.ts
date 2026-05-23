import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MatrixTickSystem } from '../../src/engine/ecs/systems/matrix-tick-system';
import { IceAiSystem } from '../../src/engine/ecs/systems/ice-ai-system';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { MatrixBruteExecutor } from '../../src/engine/ecs/combat/moves/matrix-brute-executor';
import { MatrixSleazeExecutor } from '../../src/engine/ecs/combat/moves/matrix-sleaze-executor';
import { MatrixDataSpikeExecutor } from '../../src/engine/ecs/combat/moves/matrix-data-spike-executor';
import { ComponentTypes, MatrixNodeComponent, IceComponent, DeckerComponent, AttributesComponent, HealthComponent, StunComponent, ApComponent, CombatStatusComponent } from '../../src/engine/ecs/components';

describe('Matrix ECS', () => {
  describe('MatrixTickSystem', () => {
    it('decays YELLOW alert to GREEN sometimes', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Will trigger decay (0.05 < 0.1)
      const registry = new EcsRegistry();
      const system = new MatrixTickSystem(registry, { updateNodeAlert: jest.fn().mockResolvedValue(undefined) } as any);

      const nodeId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
        nodeId: 'db-node-1',
        securityLevel: 5,
        alertLevel: 'YELLOW',
        linkedRoomId: null,
        breachProgress: 0,
      });

      await system.onTick(10);
      
      const node = registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      expect(node?.alertLevel).toBe('GREEN');

      jest.restoreAllMocks();
    });

    it('does not decay RED alerts', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.05);
      const registry = new EcsRegistry();
      const system = new MatrixTickSystem(registry, { updateNodeAlert: jest.fn().mockResolvedValue(undefined) } as any);

      const nodeId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
        nodeId: 'db-node-1',
        securityLevel: 5,
        alertLevel: 'RED',
        linkedRoomId: null,
        breachProgress: 0,
      });

      await system.onTick(10);
      
      const node = registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      expect(node?.alertLevel).toBe('RED');

      jest.restoreAllMocks();
    });
  });

  describe('Move Executors', () => {
    let registry: EcsRegistry;
    let dispatcher: MoveDispatcher;
    let deckerId: string;
    let nodeId: string;

    beforeEach(() => {
      registry = new EcsRegistry();
      dispatcher = new MoveDispatcher();
      dispatcher.register(new MatrixBruteExecutor());
      dispatcher.register(new MatrixSleazeExecutor());
      dispatcher.register(new MatrixDataSpikeExecutor());

      nodeId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
        nodeId: 'db-node-1',
        securityLevel: 5,
        alertLevel: 'GREEN',
        linkedRoomId: null,
        breachProgress: 0,
      });

      deckerId = registry.createEntity();
      registry.addComponent<DeckerComponent>(deckerId, ComponentTypes.Decker, {
        activeNodeEntityId: nodeId,
        physicalRoomId: '',
        attack: 5, sleaze: 5, firewall: 5, biofeedbackBuffer: 5, overwatchScore: 0,
      });
      registry.addComponent<AttributesComponent>(deckerId, ComponentTypes.Attributes, {
        level: 1, body: 5, agility: 5, dexterity: 5, strength: 5, logic: 5, intuition: 5, willpower: 5, charisma: 5, luck: 5
      });
      registry.addComponent<ApComponent>(deckerId, ComponentTypes.Ap, { current: 6, max: 6, lastRegenAt: 0, recoveryTicks: 0 });
      registry.addComponent<CombatStatusComponent>(deckerId, ComponentTypes.CombatStatus, { state: 'engaged', isPetActive: false });
    });

    it('Brute forces a node and alerts to RED', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // Ensure success
      const result = await dispatcher.dispatch('brute', deckerId, deckerId, { registry });
      expect(result.success).toBe(true);
      expect(result.data.newAlertLevel).toBe('RED');
      
      const node = registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      expect(node?.alertLevel).toBe('RED');

      jest.restoreAllMocks();
    });

    it('Sleazes a node silently', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // Ensure success
      const result = await dispatcher.dispatch('sleaze', deckerId, deckerId, { registry });
      expect(result.success).toBe(true);
      expect(result.data.newAlertLevel).toBe('GREEN');

      const node = registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      expect(node?.alertLevel).toBe('GREEN');

      jest.restoreAllMocks();
    });

    it('Sleaze failure alerts to YELLOW', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01); // Ensure failure
      const result = await dispatcher.dispatch('sleaze', deckerId, deckerId, { registry });
      expect(result.success).toBe(false);
      expect(result.data.newAlertLevel).toBe('YELLOW');

      const node = registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      expect(node?.alertLevel).toBe('YELLOW');

      jest.restoreAllMocks();
    });

    it('Data Spikes an ICE entity', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // Ensure success

      const iceId = registry.createEntity();
      registry.addComponent<IceComponent>(iceId, ComponentTypes.Ice, { type: 'WHITE', attack: 5, defense: 2 });
      registry.addComponent<HealthComponent>(iceId, ComponentTypes.Health, { current: 20, max: 20, lastRegenAt: 0 });

      const result = await dispatcher.dispatch('data-spike', deckerId, iceId, { registry });
      expect(result.success).toBe(true);
      expect(result.data.damageDealt).toBeGreaterThan(0);

      const iceHealth = registry.getComponent<HealthComponent>(iceId, ComponentTypes.Health);
      expect(iceHealth?.current).toBeLessThan(20);

      jest.restoreAllMocks();
    });
  });

  describe('IceAiSystem', () => {
    it('Attacks deckers in RED nodes', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // Force high rolls for damage
      
      const registry = new EcsRegistry();
      const system = new IceAiSystem(registry);

      const nodeId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
        nodeId: 'db-node-1', securityLevel: 5, alertLevel: 'RED', linkedRoomId: null, breachProgress: 0,
      });

      const deckerId = registry.createEntity();
      registry.addComponent<DeckerComponent>(deckerId, ComponentTypes.Decker, {
        activeNodeEntityId: nodeId, physicalRoomId: '', attack: 1, sleaze: 1, firewall: 1, biofeedbackBuffer: 1, overwatchScore: 0,
      });
      registry.addComponent<AttributesComponent>(deckerId, ComponentTypes.Attributes, {
        level: 1, body: 1, agility: 1, dexterity: 1, strength: 1, logic: 1, intuition: 1, willpower: 1, charisma: 1, luck: 1
      });
      registry.addComponent<HealthComponent>(deckerId, ComponentTypes.Health, { current: 100, max: 100, lastRegenAt: 0 });
      registry.addComponent<StunComponent>(deckerId, ComponentTypes.Stun, { current: 100, max: 100, lastRegenAt: 0 });

      const iceId = registry.createEntity();
      registry.addComponent<IceComponent>(iceId, ComponentTypes.Ice, { type: 'BLACK', attack: 15, defense: 5 });
      registry.addComponent<HealthComponent>(iceId, ComponentTypes.Health, { current: 20, max: 20, lastRegenAt: 0 });
      registry.addComponent<any>(iceId, ComponentTypes.Position, { roomId: nodeId }); // roomId acts as nodeEntityId

      await system.onTick(3);

      const deckerHealth = registry.getComponent<HealthComponent>(deckerId, ComponentTypes.Health);
      expect(deckerHealth?.current).toBeLessThan(100);

      jest.restoreAllMocks();
    });
  });
});
