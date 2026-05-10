import { PlayerSyncCoordinator } from '../../src/engine/player-sync-coordinator';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import {
  ComponentTypes,
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
    createPlayer(registry);

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
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'TRANSACTION',
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
});
