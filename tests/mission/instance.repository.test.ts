import { InstanceRepository } from '../../src/domains/mission/instance.repository';

describe('InstanceRepository', () => {
  function makeDb(overrides: any = {}) {
    return {
      zone: { upsert: jest.fn().mockResolvedValue({ id: 'zone-inst-1' }) },
      room: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: `room-${Math.random()}`, ...args.data })),
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      missionInstance: {
        create: jest.fn().mockResolvedValue({ id: 'inst-1', status: 'PENDING', alertLevel: 'GREEN' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
  }

  describe('createInstance', () => {
    it('creates a MissionInstance record with PENDING status', async () => {
      const db = makeDb();
      const repo = new InstanceRepository(db as any);

      await repo.createInstance({ activeMissionId: 'mission-1', partyLeaderId: 'char-1' });

      expect(db.missionInstance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          activeMissionId: 'mission-1',
          partyLeaderId: 'char-1',
          status: 'PENDING',
          alertLevel: 'GREEN',
        }),
      });
    });
  });

  describe('createInstanceRooms', () => {
    it('upserts the _instances zone and creates one Room per slug', async () => {
      const db = makeDb();
      const repo = new InstanceRepository(db as any);

      const rooms = await repo.createInstanceRooms('inst-1', ['office-a', 'server-room']);

      expect(db.zone.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { slug: '_instances' },
      }));
      expect(db.room.create).toHaveBeenCalledTimes(2);
      expect(rooms).toHaveLength(2);
    });
  });

  describe('findInstanceByRoomId', () => {
    it('returns null when the room has no missionInstanceId', async () => {
      const db = makeDb({
        room: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'r-1', missionInstanceId: null }),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      const result = await repo.findInstanceByRoomId('r-1');

      expect(result).toBeNull();
    });

    it('returns the instance when the room has a missionInstanceId', async () => {
      const inst = { id: 'inst-1', status: 'PENDING', alertLevel: 'GREEN' };
      const db = makeDb({
        room: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'r-1', missionInstanceId: 'inst-1' }),
          updateMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        missionInstance: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(inst),
          findFirst: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      const result = await repo.findInstanceByRoomId('r-1');

      expect(result).toEqual(inst);
    });
  });

  describe('updateInstanceAlertLevel', () => {
    it('only escalates — does not downgrade alert level', async () => {
      const db = makeDb({
        missionInstance: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'YELLOW' }),
          findFirst: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      await repo.updateInstanceAlertLevel('inst-1', 'GREEN');

      expect(db.missionInstance.updateMany).not.toHaveBeenCalled();
    });

    it('escalates when the new level is higher', async () => {
      const db = makeDb({
        missionInstance: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'GREEN' }),
          findFirst: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      await repo.updateInstanceAlertLevel('inst-1', 'RED', 'room-9');

      expect(db.missionInstance.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: { in: ['GREEN', 'YELLOW'] },
          rooms: { some: { id: 'room-9' } },
        },
        data: { alertLevel: 'RED', alertSourceRoomId: 'room-9' },
      });
    });

    it('repairs a missing same-level source and reports the outcome', async () => {
      const db = makeDb();
      db.missionInstance.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.updateInstanceAlertLevel('inst-1', 'YELLOW', 'room-9'))
        .resolves.toBe('source-updated');

      expect(db.missionInstance.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: 'YELLOW',
          OR: [
            { alertSourceRoomId: null },
            { alertSourceRoomId: { not: 'room-9' } },
          ],
          rooms: { some: { id: 'room-9' } },
        },
        data: { alertSourceRoomId: 'room-9' },
      });
    });

    it('reports unchanged when the guarded room does not belong to the active instance', async () => {
      const db = makeDb();
      const repo = new InstanceRepository(db as any);

      await expect(repo.updateInstanceAlertLevel('inst-1', 'RED', 'wrong-room'))
        .resolves.toBe('unchanged');
    });
  });

  describe('findActiveInstanceAlertSources', () => {
    it('returns only persisted non-GREEN sources for active instances', async () => {
      const db = makeDb();
      db.missionInstance.findMany.mockResolvedValue([
        { id: 'inst-1', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2' },
        { id: 'inst-2', alertLevel: 'RED', alertSourceRoomId: 'room-3' },
      ]);
      const repo = new InstanceRepository(db as any);

      await expect(repo.findActiveInstanceAlertSources()).resolves.toEqual([
        { instanceId: 'inst-1', roomId: 'room-2', alarmState: 'YELLOW' },
        { instanceId: 'inst-2', roomId: 'room-3', alarmState: 'RED' },
      ]);
      expect(db.missionInstance.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          alertLevel: { in: ['YELLOW', 'RED'] },
          alertSourceRoomId: { not: null },
        },
        select: { id: true, alertLevel: true, alertSourceRoomId: true },
      });
    });
  });

  describe('escalateAlertFromRoom', () => {
    it('encapsulates room ownership and monotonic escalation', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({
        missionInstance: {
          id: 'inst-1', status: 'ACTIVE', alertLevel: 'GREEN', alertSourceRoomId: null,
        },
      });
      const repo = new InstanceRepository(db as any);
      const update = jest.spyOn(repo, 'updateInstanceAlertLevel').mockResolvedValue('escalated' as any);

      await expect(repo.escalateAlertFromRoom('room-2', 'RED')).resolves.toBe('escalated');
      expect(update).toHaveBeenCalledWith('inst-1', 'RED', 'room-2');
    });

    it('does not escalate rooms outside an active MissionInstance', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({
        missionInstance: {
          id: 'inst-1', status: 'COMPLETED', alertLevel: 'GREEN', alertSourceRoomId: null,
        },
      });
      const repo = new InstanceRepository(db as any);
      const update = jest.spyOn(repo, 'updateInstanceAlertLevel');

      await expect(repo.escalateAlertFromRoom('room-2', 'RED')).resolves.toBe('inactive-instance');
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('ensureAlertFromRoom', () => {
    it('does not let a same-level retry overwrite a newer persisted source', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({
        missionInstance: {
          id: 'inst-1', status: 'ACTIVE', alertLevel: 'RED', alertSourceRoomId: 'newer-room',
        },
      });
      const repo = new InstanceRepository(db as any);
      const update = jest.spyOn(repo, 'updateInstanceAlertLevel');

      await expect(repo.ensureAlertFromRoom('older-room', 'RED')).resolves.toBe('unchanged');
      expect(update).not.toHaveBeenCalled();
    });

    it('repairs a missing same-level source', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({
        missionInstance: {
          id: 'inst-1', status: 'ACTIVE', alertLevel: 'YELLOW', alertSourceRoomId: null,
        },
      });
      db.missionInstance.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.ensureAlertFromRoom('room-2', 'YELLOW')).resolves.toBe('source-updated');
      expect(db.missionInstance.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: 'YELLOW',
          alertSourceRoomId: null,
          rooms: { some: { id: 'room-2' } },
        },
        data: { alertSourceRoomId: 'room-2' },
      });
    });

    it('atomically preserves a live source that wins after the retry read', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({
        missionInstance: {
          id: 'inst-1', status: 'ACTIVE', alertLevel: 'GREEN', alertSourceRoomId: null,
        },
      });
      db.missionInstance.updateMany.mockResolvedValue({ count: 0 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.ensureAlertFromRoom('older-room', 'RED')).resolves.toBe('unchanged');

      expect(db.missionInstance.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: 'RED',
          alertSourceRoomId: null,
          rooms: { some: { id: 'older-room' } },
        },
        data: { alertSourceRoomId: 'older-room' },
      });
    });
  });
});
