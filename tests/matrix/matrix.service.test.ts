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
});
