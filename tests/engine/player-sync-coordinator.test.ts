import { PlayerSyncCoordinator } from '../../src/engine/player-sync-coordinator';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import {
  ComponentTypes,
  ApComponent,
  DeckerComponent,
  HealthComponent,
  ManaComponent,
  PlayerIdComponent,
  PositionComponent,
  StunComponent,
} from '../../src/engine/ecs/components';

describe('PlayerSyncCoordinator', () => {
  function createPlayer(registry: EcsRegistry) {
    const entityId = registry.createEntity();
    registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1',
      accountId: 'account-1',
    });
    registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
      current: 42,
      max: 100,
      lastRegenAt: 0,
    });
    registry.addComponent<StunComponent>(entityId, ComponentTypes.Stun, {
      current: 13,
      max: 80,
      lastRegenAt: 0,
    });
    registry.addComponent<ManaComponent>(entityId, ComponentTypes.Mana, {
      current: 7,
      max: 50,
      lastRegenAt: 0,
    });
    registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, {
      roomId: 'physical-room-1',
    });
    return entityId;
  }

  it('persists final snapshot and audit log in one transaction before destroying the entity', async () => {
    const registry = new EcsRegistry();
    const entityId = createPlayer(registry);
    registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
      current: 2,
      max: 6,
      lastRegenAt: 0,
      recoveryTicks: 3,
    });
    registry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: 'matrix-node-1',
      physicalRoomId: 'physical-room-1',
      attack: 5,
      sleaze: 4,
      firewall: 3,
      biofeedbackBuffer: 2,
      overwatchScore: 37,
    });

    const tx = {
      character: { update: jest.fn().mockResolvedValue(undefined) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const db = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const auditLogger = { log: jest.fn() };

    const coordinator = new PlayerSyncCoordinator(db as any, registry, auditLogger as any);

    await coordinator.handlePlayerDisconnect('char-1');

    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: 'char-1' },
      data: {
        currentHp: 42,
        currentStun: 13,
        currentMana: 7,
        currentRoomId: 'physical-room-1',
        currentAp: 2,
        apRecoveryTicks: 3,
        matrixOverwatchScore: 37,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'PLAYER_SNAPSHOT',
        characterId: 'char-1',
      }),
    }));
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(registry.entityCount).toBe(0);
  });

  it('keeps the entity in memory and writes an exploit audit if persistence fails', async () => {
    const registry = new EcsRegistry();
    createPlayer(registry);

    const db = {
      $transaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const coordinator = new PlayerSyncCoordinator(db as any, registry, auditLogger as any);

    await expect(coordinator.handlePlayerDisconnect('char-1')).rejects.toThrow('database unavailable');

    expect(registry.entityCount).toBe(1);
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      category: 'EXPLOIT_FLAG',
      severity: 'CRITICAL',
      characterId: 'char-1',
    }));
  });

  it('coalesces concurrent disconnects before a replacement session is restored', async () => {
    const registry = new EcsRegistry();
    createPlayer(registry);

    let releaseTransaction!: () => void;
    const transactionGate = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    const tx = {
      character: { update: jest.fn().mockResolvedValue(undefined) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => {
        await transactionGate;
        return callback(tx);
      }),
    };
    const coordinator = new PlayerSyncCoordinator(db as any, registry, { log: jest.fn() } as any);

    const first = coordinator.handlePlayerDisconnect('char-1');
    const replacementWait = coordinator.waitForPlayerDisconnect('char-1');

    expect(replacementWait).toBe(first);
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    releaseTransaction();
    await Promise.all([first, replacementWait]);

    expect(registry.entityCount).toBe(0);
  });

  it('does not start a disconnect when a selection only waits for prior persistence', async () => {
    const registry = new EcsRegistry();
    createPlayer(registry);
    const db = { $transaction: jest.fn() };
    const coordinator = new PlayerSyncCoordinator(db as any, registry, { log: jest.fn() } as any);

    await coordinator.waitForPlayerDisconnect('char-1');

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(registry.entityCount).toBe(1);
  });
});
