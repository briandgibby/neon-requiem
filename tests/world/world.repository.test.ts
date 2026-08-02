import { WorldRepository } from '../../src/domains/world/world.repository';
import { ConflictError, ValidationError } from '../../src/shared/errors';

function eventRoom(id: string, overrideActive = false) {
  return {
    id,
    isSafeZone: true,
    safeZoneOverrideActive: overrideActive,
    missionInstanceId: null,
  };
}

describe('WorldRepository room views', () => {
  it('loads zone identity with rooms sent to clients', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'room-1',
      zoneId: 'zone-1',
      zone: { id: 'zone-1', slug: 'redmond-barrens', name: 'Redmond Barrens' },
    });
    const repository = new WorldRepository({
      room: { findUnique },
    } as any);

    await repository.findRoomById('room-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      include: { zone: true },
    });
  });

  it('loads the minimal room fields required for event eligibility', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new WorldRepository({ room: { findMany } } as any);

    await repository.findRoomsByIds(['room-1', 'room-2']);

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['room-1', 'room-2'] } },
      select: {
        id: true,
        isSafeZone: true,
        missionInstanceId: true,
      },
    });
  });

  it('atomically changes only eligible room overrides that need a transition', async () => {
    const findMany = jest.fn().mockResolvedValue([eventRoom('room-1'), eventRoom('room-2')]);
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const transaction = jest.fn(async (callback) => callback({ room: { findMany, updateMany } }));
    const repository = new WorldRepository({ $transaction: transaction } as any);

    await expect(repository.setSafeZoneOverride(['room-1', 'room-2'], true)).resolves.toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['room-1', 'room-2'] } },
      select: {
        id: true,
        isSafeZone: true,
        safeZoneOverrideActive: true,
        missionInstanceId: true,
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['room-1', 'room-2'] },
        isSafeZone: true,
        missionInstanceId: null,
        safeZoneOverrideActive: { not: true },
      },
      data: { safeZoneOverrideActive: true },
    });
  });

  it('rejects a room that becomes ineligible before the transactional write', async () => {
    const findMany = jest.fn().mockResolvedValue([
      eventRoom('room-1'),
      { ...eventRoom('room-2'), missionInstanceId: 'instance-1' },
    ]);
    const updateMany = jest.fn();
    const transaction = jest.fn(async (callback) => callback({ room: { findMany, updateMany } }));
    const repository = new WorldRepository({ $transaction: transaction } as any);

    await expect(repository.setSafeZoneOverride(['room-1', 'room-2'], true))
      .rejects.toBeInstanceOf(ValidationError);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rolls back when an eligibility change races the guarded update', async () => {
    const findMany = jest.fn().mockResolvedValue([eventRoom('room-1'), eventRoom('room-2')]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn(async (callback) => callback({ room: { findMany, updateMany } }));
    const repository = new WorldRepository({ $transaction: transaction } as any);

    await expect(repository.setSafeZoneOverride(['room-1', 'room-2'], true))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it('invalidates the room cache after changing an override', async () => {
    const roomFindMany = jest.fn()
      .mockResolvedValueOnce([{ id: 'room-1', safeZoneOverrideActive: false }])
      .mockResolvedValueOnce([{ id: 'room-1', safeZoneOverrideActive: true }]);
    const transactionRoom = {
      findMany: jest.fn().mockResolvedValue([eventRoom('room-1')]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const transaction = jest.fn(async (callback) => callback({ room: transactionRoom }));
    const repository = new WorldRepository({
      room: { findMany: roomFindMany },
      $transaction: transaction,
    } as any);

    await repository.getAllRooms();
    await repository.setSafeZoneOverride(['room-1'], true);
    await expect(repository.getAllRooms()).resolves.toEqual([
      { id: 'room-1', safeZoneOverrideActive: true },
    ]);
    expect(roomFindMany).toHaveBeenCalledTimes(2);
  });

  it('keeps the room cache when an override is already in the requested state', async () => {
    const cachedRooms = [{ id: 'room-1', safeZoneOverrideActive: true }];
    const roomFindMany = jest.fn().mockResolvedValue(cachedRooms);
    const transactionRoom = {
      findMany: jest.fn().mockResolvedValue([eventRoom('room-1', true)]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const transaction = jest.fn(async (callback) => callback({ room: transactionRoom }));
    const repository = new WorldRepository({
      room: { findMany: roomFindMany },
      $transaction: transaction,
    } as any);

    await repository.getAllRooms();
    await expect(repository.setSafeZoneOverride(['room-1'], true)).resolves.toBe(0);
    await expect(repository.getAllRooms()).resolves.toBe(cachedRooms);
    expect(roomFindMany).toHaveBeenCalledTimes(1);
  });

  it('does not cache a room query that started before an override changed', async () => {
    let finishFirstQuery!: (rooms: unknown[]) => void;
    const firstQuery = new Promise<unknown[]>((resolve) => {
      finishFirstQuery = resolve;
    });
    const currentRooms = [{ id: 'room-1', safeZoneOverrideActive: true }];
    const roomFindMany = jest.fn()
      .mockReturnValueOnce(firstQuery)
      .mockResolvedValueOnce(currentRooms);
    const transactionRoom = {
      findMany: jest.fn().mockResolvedValue([eventRoom('room-1')]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const transaction = jest.fn(async (callback) => callback({ room: transactionRoom }));
    const repository = new WorldRepository({
      room: { findMany: roomFindMany },
      $transaction: transaction,
    } as any);

    const staleRead = repository.getAllRooms();
    await repository.setSafeZoneOverride(['room-1'], true);
    finishFirstQuery([{ id: 'room-1', safeZoneOverrideActive: false }]);
    await staleRead;

    await expect(repository.getAllRooms()).resolves.toBe(currentRooms);
    expect(roomFindMany).toHaveBeenCalledTimes(2);
  });
});
