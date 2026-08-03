import { InstanceAlertService } from '../../src/domains/mission/instance-alert.service';
import { InstanceRepository } from '../../src/domains/mission/instance.repository';

describe('InstanceAlertService', () => {
  function makeDb() {
    return {
      room: { findUnique: jest.fn().mockResolvedValue(null) },
      missionInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  function makeService() {
    const db = makeDb();
    return { db, service: new InstanceAlertService(new InstanceRepository(db as any)) };
  }

  it('escalates an active instance and records the triggering room', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'GREEN', alertSourceRoomId: null,
      },
    });
    db.missionInstance.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.escalateAlertFromRoom('room-2', 'RED')).resolves.toBe('escalated');
  });

  it('moves a same-level Instance Alert Source to the latest live trigger', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'RED', alertSourceRoomId: 'room-1',
      },
    });
    db.missionInstance.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.escalateAlertFromRoom('room-2', 'RED')).resolves.toBe('source-updated');
  });

  it('lets a concurrent live trigger win after an earlier escalation read', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'GREEN', alertSourceRoomId: null,
      },
    });
    db.missionInstance.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(service.escalateAlertFromRoom('room-2', 'RED')).resolves.toBe('unchanged');
    expect(db.missionInstance.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not let reconciliation replace an existing same-level source', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'RED', alertSourceRoomId: 'newer-room',
      },
    });

    await expect(service.ensureAlertFromRoom('older-room', 'RED')).resolves.toBe('unchanged');
    expect(db.missionInstance.updateMany).not.toHaveBeenCalled();
  });

  it('lets reconciliation claim a missing same-level source', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'YELLOW', alertSourceRoomId: null,
      },
    });
    db.missionInstance.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.ensureAlertFromRoom('room-2', 'YELLOW')).resolves.toBe('source-updated');
  });

  it('does not downgrade an active instance', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'RED', alertSourceRoomId: 'room-2',
      },
    });

    await expect(service.escalateAlertFromRoom('room-2', 'YELLOW')).resolves.toBe('unchanged');
    expect(db.missionInstance.updateMany).not.toHaveBeenCalled();
  });

  it('distinguishes rooms outside an instance from inactive instances', async () => {
    const { db, service } = makeService();

    await expect(service.escalateAlertFromRoom('world-room', 'RED')).resolves.toBe('not-in-instance');

    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'COMPLETED', alertLevel: 'GREEN', alertSourceRoomId: null,
      },
    });
    await expect(service.escalateAlertFromRoom('resolved-room', 'RED')).resolves.toBe('inactive-instance');
  });

  it('returns only the active alert view needed by synchronization', async () => {
    const { db, service } = makeService();
    db.room.findUnique.mockResolvedValue({
      missionInstance: {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2',
      },
    });

    await expect(service.findActiveAlertForRoom('room-2')).resolves.toEqual({
      instanceId: 'inst-1', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2',
    });
  });

  it('normalizes persisted active sources behind the service interface', async () => {
    const { db, service } = makeService();
    db.missionInstance.findMany.mockResolvedValue([
      { id: 'inst-1', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2' },
      { id: 'inst-2', alertLevel: 'INVALID', alertSourceRoomId: 'room-3' },
      { id: 'inst-3', alertLevel: 'RED', alertSourceRoomId: null },
    ]);

    await expect(service.findActiveInstanceAlertSources()).resolves.toEqual([
      { instanceId: 'inst-1', roomId: 'room-2', alarmState: 'YELLOW' },
    ]);
  });
});
