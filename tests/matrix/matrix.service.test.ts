import { MatrixService } from '../../src/domains/matrix/matrix.service';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import {
  ApComponent,
  AttributesComponent,
  CombatStatusComponent,
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  IceComponent,
  MatrixNodeComponent,
  PlayerIdComponent,
  PositionComponent,
  StunComponent,
} from '../../src/engine/ecs/components';
import { NotFoundError } from '../../src/shared/errors';
import { MatrixDataSpikeExecutor } from '../../src/engine/ecs/combat/moves/matrix-data-spike-executor';

describe('MatrixService', () => {
  const character = {
    id: 'char-1',
    accountId: 'account-1',
    name: 'Chrome Fox',
    className: 'decker',
    currentHp: 80,
    maxHp: 100,
    currentStun: 60,
    maxStun: 80,
    level: 1,
    body: 3,
    agility: 4,
    dexterity: 4,
    strength: 3,
    logic: 6,
    intuition: 5,
    willpower: 4,
    charisma: 2,
    luck: 3,
    inventory: [
      {
        isEquipped: true,
        item: {
          type: 'DECK',
          stats: {
            attack: 6,
            sleaze: 5,
            firewall: 4,
            biofeedbackBuffer: 3,
          },
        },
      },
    ],
  };

  it('links the DB node and preserves physical position when jacking in', async () => {
    const registry = new EcsRegistry();
    const matrixRepo = {
      getCharacterWithEquipment: jest.fn().mockResolvedValue(character),
      findNodeByRoomId: jest.fn().mockResolvedValue({
        id: 'node-db-1',
        name: 'Blue Static Host',
        slug: 'blue-static-host',
        securityLevel: 4,
        alertLevel: 'GREEN',
        activeIC: [
          {
            id: 'ice-db-1',
            name: 'Patrol IC',
            slug: 'patrol-ic',
            type: 'WHITE',
            currentHp: 20,
            hp: 20,
            attack: 5,
            defense: 2,
          },
        ],
      }),
      updateCharacterLink: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MatrixService(matrixRepo as any, registry, new MoveDispatcher());

    const result = await service.jackIn('char-1', 'account-1', 'physical-room-1');

    expect(matrixRepo.updateCharacterLink).toHaveBeenCalledWith('char-1', 'node-db-1', true);
    expect(result.node).toMatchObject({
      id: 'node-db-1',
      nodeId: 'node-db-1',
      name: 'Blue Static Host',
      slug: 'blue-static-host',
      securityLevel: 4,
      alertLevel: 'GREEN',
      activeIC: [
        {
          id: 'ice-db-1',
          name: 'Patrol IC',
          slug: 'patrol-ic',
          type: 'WHITE',
          currentHp: 20,
          maxHp: 20,
        },
      ],
    });

    const entityId = registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === 'char-1'
    );
    expect(entityId).toBeDefined();
    expect(registry.getComponent<PositionComponent>(entityId!, ComponentTypes.Position)).toEqual({
      roomId: 'physical-room-1',
    });

    const decker = registry.getComponent<DeckerComponent>(entityId!, ComponentTypes.Decker);
    expect(decker?.activeNodeEntityId).toBeDefined();
    expect(registry.getComponent<MatrixNodeComponent>(decker!.activeNodeEntityId, ComponentTypes.MatrixNode))
      .toMatchObject({ nodeId: 'node-db-1' });

    const iceEntityId = registry.getEntityByComponent<IceComponent>(
      ComponentTypes.Ice,
      (ice) => ice.iceId === 'ice-db-1'
    );
    expect(iceEntityId).toBeDefined();
    expect(registry.getComponent<PositionComponent>(iceEntityId!, ComponentTypes.Position)).toEqual({
      roomId: decker!.activeNodeEntityId,
    });
    expect(registry.getComponent<HealthComponent>(iceEntityId!, ComponentTypes.Health)).toEqual({
      current: 20,
      max: 20,
      lastRegenAt: expect.any(Number),
    });
  });

  it('resolves DB ICE ids to spawned ECS ICE for data spike', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9);

    const registry = new EcsRegistry();
    const matrixRepo = {
      getCharacterWithEquipment: jest.fn().mockResolvedValue(character),
      findNodeByRoomId: jest.fn().mockResolvedValue({
        id: 'node-db-1',
        name: 'Blue Static Host',
        slug: 'blue-static-host',
        securityLevel: 4,
        alertLevel: 'GREEN',
        activeIC: [
          {
            id: 'ice-db-1',
            name: 'Patrol IC',
            slug: 'patrol-ic',
            type: 'WHITE',
            currentHp: 20,
            hp: 20,
            attack: 5,
            defense: 2,
          },
        ],
      }),
      updateCharacterLink: jest.fn().mockResolvedValue(undefined),
    };

    const dispatcher = new MoveDispatcher();
    dispatcher.register(new MatrixDataSpikeExecutor());
    const service = new MatrixService(matrixRepo as any, registry, dispatcher);

    await service.jackIn('char-1', 'account-1', 'physical-room-1');
    const result = await service.dataSpike('char-1', 'account-1', 'ice-db-1');

    expect(result.success).toBe(true);
    expect(result.damageDealt).toBeGreaterThan(0);

    const iceEntityId = registry.getEntityByComponent<IceComponent>(
      ComponentTypes.Ice,
      (ice) => ice.iceId === 'ice-db-1'
    );
    const health = registry.getComponent<HealthComponent>(iceEntityId!, ComponentTypes.Health);
    expect(health?.current).toBeLessThan(20);

    jest.restoreAllMocks();
  });

  it('does not allow an account to drive another account-owned ECS decker', async () => {
    const registry = new EcsRegistry();
    const nodeId = registry.createEntity();
    registry.addComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode, {
      nodeId: 'node-db-1',
      securityLevel: 4,
      alertLevel: 'GREEN',
      linkedRoomId: 'physical-room-1',
      breachProgress: 0,
    });

    const entityId = registry.createEntity();
    registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1',
      accountId: 'owner-account',
    });
    registry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: nodeId,
      attack: 5,
      sleaze: 5,
      firewall: 5,
      biofeedbackBuffer: 5,
      overwatchScore: 0,
    });
    registry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
      level: 1,
      body: 3,
      agility: 3,
      dexterity: 3,
      strength: 3,
      logic: 5,
      intuition: 5,
      willpower: 3,
      charisma: 3,
      luck: 3,
    });
    registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
      current: 100,
      max: 100,
      lastRegenAt: 0,
    });
    registry.addComponent<StunComponent>(entityId, ComponentTypes.Stun, {
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

    const service = new MatrixService({} as any, registry, new MoveDispatcher());

    await expect(service.performHacking('char-1', 'intruder-account', 'brute'))
      .rejects.toThrow(NotFoundError);
  });

  describe('dataSpike', () => {
    function buildDataSpikeEnv() {
      const registry = new EcsRegistry();

      const nodeEntityId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
        nodeId: 'node-db-1',
        securityLevel: 3,
        alertLevel: 'GREEN',
        linkedRoomId: 'room-1',
        breachProgress: 0,
      });

      const deckerEntityId = registry.createEntity();
      registry.addComponent<PlayerIdComponent>(deckerEntityId, ComponentTypes.PlayerId, {
        characterId: 'char-1',
        accountId: 'account-1',
      });
      registry.addComponent<DeckerComponent>(deckerEntityId, ComponentTypes.Decker, {
        activeNodeEntityId: nodeEntityId,
        attack: 6, sleaze: 5, firewall: 4, biofeedbackBuffer: 3, overwatchScore: 0,
      });
      registry.addComponent<AttributesComponent>(deckerEntityId, ComponentTypes.Attributes, {
        level: 1, body: 3, agility: 4, dexterity: 4, strength: 3,
        logic: 6, intuition: 5, willpower: 4, charisma: 2, luck: 3,
      });
      registry.addComponent<ApComponent>(deckerEntityId, ComponentTypes.Ap, {
        current: 10, max: 10, lastRegenAt: Date.now(), recoveryTicks: 0,
      });
      registry.addComponent<CombatStatusComponent>(deckerEntityId, ComponentTypes.CombatStatus, {
        state: 'engaged', isPetActive: false,
      });

      const iceEntityId = registry.createEntity();
      registry.addComponent<IceComponent>(iceEntityId, ComponentTypes.Ice, {
        iceId: 'ice-db-1', type: 'WHITE', attack: 3, defense: 2,
      });
      registry.addComponent<HealthComponent>(iceEntityId, ComponentTypes.Health, {
        current: 20, max: 20, lastRegenAt: Date.now(),
      });
      registry.addComponent<PositionComponent>(iceEntityId, ComponentTypes.Position, {
        roomId: nodeEntityId,
      });

      const matrixRepo = {
        updateIceHp: jest.fn().mockResolvedValue(undefined),
        updateNodeAlert: jest.fn().mockResolvedValue(undefined),
        getCharacterWithEquipment: jest.fn(),
        findNodeByRoomId: jest.fn(),
        updateCharacterLink: jest.fn(),
      };
      const dispatcher = new MoveDispatcher();
      dispatcher.register(new MatrixDataSpikeExecutor());

      const service = new MatrixService(matrixRepo as any, registry, dispatcher);

      return { service, registry, matrixRepo, deckerEntityId, iceEntityId, nodeEntityId };
    }

    it('flushes ICE HP to DB after a data spike', async () => {
      const { service, matrixRepo, iceEntityId, registry } = buildDataSpikeEnv();

      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      await service.dataSpike('char-1', 'account-1', 'ice-db-1');
      jest.restoreAllMocks();

      const health = registry.getComponent<HealthComponent>(iceEntityId, ComponentTypes.Health);
      expect(matrixRepo.updateIceHp).toHaveBeenCalledWith('ice-db-1', health!.current);
    });

    it('increments overwatchScore on the decker after a data spike', async () => {
      const { service, registry, deckerEntityId } = buildDataSpikeEnv();

      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      await service.dataSpike('char-1', 'account-1', 'ice-db-1');
      jest.restoreAllMocks();

      const decker = registry.getComponent<DeckerComponent>(deckerEntityId, ComponentTypes.Decker);
      expect(decker!.overwatchScore).toBe(1);
    });
  });

  describe('getOrCreateEcsNode — onNodeCreated callback', () => {
    it('calls onNodeCreated with roomId and the new node entityId', async () => {
      const registry = new EcsRegistry();
      const onNodeCreated = jest.fn().mockResolvedValue(undefined);

      const matrixRepo = {
        findNodeByRoomId: jest.fn().mockResolvedValue({
          id: 'node-db-1',
          name: 'Corp Host',
          slug: 'corp-host',
          securityLevel: 3,
          alertLevel: 'GREEN',
          activeIC: [],
        }),
        updateIceHp: jest.fn(),
        updateNodeAlert: jest.fn(),
        getCharacterWithEquipment: jest.fn(),
        updateCharacterLink: jest.fn(),
      };

      const dispatcher = new MoveDispatcher();
      const service = new MatrixService(matrixRepo as any, registry, dispatcher, onNodeCreated);

      await service.getOrCreateEcsNode('room-uuid-1');

      expect(onNodeCreated).toHaveBeenCalledWith('room-uuid-1', expect.any(String));
    });

    it('does NOT call onNodeCreated when the node entity already exists', async () => {
      const registry = new EcsRegistry();
      const onNodeCreated = jest.fn().mockResolvedValue(undefined);

      const matrixRepo = {
        findNodeByRoomId: jest.fn().mockResolvedValue({
          id: 'node-db-1', name: 'Corp Host', slug: 'corp-host',
          securityLevel: 3, alertLevel: 'GREEN', activeIC: [],
        }),
        updateIceHp: jest.fn(),
        updateNodeAlert: jest.fn(),
        getCharacterWithEquipment: jest.fn(),
        updateCharacterLink: jest.fn(),
      };

      const dispatcher = new MoveDispatcher();
      const service = new MatrixService(matrixRepo as any, registry, dispatcher, onNodeCreated);

      await service.getOrCreateEcsNode('room-uuid-1');
      onNodeCreated.mockClear();

      await service.getOrCreateEcsNode('room-uuid-1');

      expect(onNodeCreated).not.toHaveBeenCalled();
    });
  });

  describe('performHacking', () => {
    function buildHackingEnv(dispatchSuccess: boolean = true) {
      const registry = new EcsRegistry();

      const nodeEntityId = registry.createEntity();
      registry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
        nodeId: 'node-db-1',
        securityLevel: 2,
        alertLevel: 'GREEN',
        linkedRoomId: 'room-1',
        breachProgress: 0,
      });

      const deckerEntityId = registry.createEntity();
      registry.addComponent<PlayerIdComponent>(deckerEntityId, ComponentTypes.PlayerId, {
        characterId: 'char-1', accountId: 'account-1',
      });
      registry.addComponent<DeckerComponent>(deckerEntityId, ComponentTypes.Decker, {
        activeNodeEntityId: nodeEntityId,
        attack: 8, sleaze: 5, firewall: 4, biofeedbackBuffer: 3, overwatchScore: 0,
      });

      const matrixRepo = {
        updateNodeAlert: jest.fn().mockResolvedValue(undefined),
        updateIceHp: jest.fn().mockResolvedValue(undefined),
        getCharacterWithEquipment: jest.fn(),
        findNodeByRoomId: jest.fn(),
        updateCharacterLink: jest.fn(),
      };

      const mockResult = {
        success: dispatchSuccess,
        message: dispatchSuccess ? 'Hack succeeded' : 'Resisted',
        data: { newAlertLevel: 'RED' },
      };
      // Simulate the real executor: mutate node.alertLevel in ECS then return the result
      const dispatcher = {
        dispatch: jest.fn().mockImplementation(async () => {
          const node = registry.getComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode);
          if (node) node.alertLevel = 'RED';
          return mockResult;
        }),
      } as any;

      const service = new MatrixService(matrixRepo as any, registry, dispatcher);

      return { service, registry, matrixRepo, deckerEntityId, nodeEntityId };
    }

    it('flushes alert level to DB after brute/sleaze regardless of success', async () => {
      const { service, matrixRepo } = buildHackingEnv(true);

      await service.performHacking('char-1', 'account-1', 'brute');

      expect(matrixRepo.updateNodeAlert).toHaveBeenCalledWith('node-db-1', 'RED');
    });

    it('flushes alert level to DB even when hack fails', async () => {
      const { service, matrixRepo } = buildHackingEnv(false);

      await service.performHacking('char-1', 'account-1', 'brute');

      expect(matrixRepo.updateNodeAlert).toHaveBeenCalledWith('node-db-1', 'RED');
    });

    it('increments breachProgress on the node when hack succeeds', async () => {
      const { service, registry, nodeEntityId } = buildHackingEnv(true);

      await service.performHacking('char-1', 'account-1', 'brute');

      const node = registry.getComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode);
      expect(node!.breachProgress).toBe(1);
    });

    it('does NOT increment breachProgress when hack fails', async () => {
      const { service, registry, nodeEntityId } = buildHackingEnv(false);

      await service.performHacking('char-1', 'account-1', 'brute');

      const node = registry.getComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode);
      expect(node!.breachProgress).toBe(0);
    });

    it('increments overwatchScore on the decker', async () => {
      const { service, registry, deckerEntityId } = buildHackingEnv(true);

      await service.performHacking('char-1', 'account-1', 'brute');

      const decker = registry.getComponent<DeckerComponent>(deckerEntityId, ComponentTypes.Decker);
      expect(decker!.overwatchScore).toBe(1);
    });
  });
});
