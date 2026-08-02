import { WorldEventService } from '../../src/domains/world/world-event.service';
import { WorldRepository } from '../../src/domains/world/world.repository';
import { NotFoundError, ValidationError } from '../../src/shared/errors';

function eligibleRoom(id: string, overrideActive = false) {
  return {
    id,
    isSafeZone: true,
    safeZoneOverrideActive: overrideActive,
    missionInstanceId: null,
  };
}

describe('WorldEventService', () => {
  it('starts a safe-zone override for a deduplicated room set', async () => {
    const rooms = {
      findRoomsByIds: jest.fn().mockResolvedValue([eligibleRoom('room-1'), eligibleRoom('room-2')]),
      setSafeZoneOverride: jest.fn().mockResolvedValue(2),
    };
    const service = new WorldEventService(rooms);

    await expect(service.startSafeZoneOverride(['room-1', 'room-2', 'room-1'])).resolves.toEqual({
      roomIds: ['room-1', 'room-2'],
      active: true,
      changedRoomCount: 2,
    });
    expect(rooms.setSafeZoneOverride).toHaveBeenCalledWith(['room-1', 'room-2'], true);
  });

  it('ends a safe-zone override idempotently', async () => {
    const rooms = {
      findRoomsByIds: jest.fn().mockResolvedValue([eligibleRoom('room-1', true)]),
      setSafeZoneOverride: jest.fn().mockResolvedValue(0),
    };
    const service = new WorldEventService(rooms);

    await expect(service.endSafeZoneOverride(['room-1'])).resolves.toEqual({
      roomIds: ['room-1'],
      active: false,
      changedRoomCount: 0,
    });
    expect(rooms.setSafeZoneOverride).toHaveBeenCalledWith(['room-1'], false);
  });

  it('rejects an empty event room set', async () => {
    const rooms = { findRoomsByIds: jest.fn(), setSafeZoneOverride: jest.fn() };
    const service = new WorldEventService(rooms);

    await expect(service.startSafeZoneOverride([])).rejects.toBeInstanceOf(ValidationError);
    expect(rooms.setSafeZoneOverride).not.toHaveBeenCalled();
  });

  it('rejects missing rooms before changing any override', async () => {
    const rooms = {
      findRoomsByIds: jest.fn().mockResolvedValue([eligibleRoom('room-1')]),
      setSafeZoneOverride: jest.fn(),
    };
    const service = new WorldEventService(rooms);

    await expect(service.startSafeZoneOverride(['room-1', 'missing-room']))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(rooms.setSafeZoneOverride).not.toHaveBeenCalled();
  });

  it.each([
    ['ordinary room', { ...eligibleRoom('room-1'), isSafeZone: false }],
    ['MissionInstance room', { ...eligibleRoom('room-1'), missionInstanceId: 'instance-1' }],
  ])('rejects an ineligible %s before changing any override', async (_label, room) => {
    const rooms = {
      findRoomsByIds: jest.fn().mockResolvedValue([room]),
      setSafeZoneOverride: jest.fn(),
    };
    const service = new WorldEventService(rooms);

    await expect(service.startSafeZoneOverride(['room-1'])).rejects.toBeInstanceOf(ValidationError);
    expect(rooms.setSafeZoneOverride).not.toHaveBeenCalled();
  });

  it('revalidates eligibility inside the repository transaction before changing rooms', async () => {
    const updateMany = jest.fn();
    const transactionRoom = {
      findMany: jest.fn().mockResolvedValue([
        eligibleRoom('room-1'),
        { ...eligibleRoom('room-2'), missionInstanceId: 'instance-1' },
      ]),
      updateMany,
    };
    const db = {
      room: {
        findMany: jest.fn().mockResolvedValue([eligibleRoom('room-1'), eligibleRoom('room-2')]),
      },
      $transaction: jest.fn(async (callback) => callback({ room: transactionRoom })),
    };
    const service = new WorldEventService(new WorldRepository(db as any));

    await expect(service.startSafeZoneOverride(['room-1', 'room-2']))
      .rejects.toBeInstanceOf(ValidationError);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
