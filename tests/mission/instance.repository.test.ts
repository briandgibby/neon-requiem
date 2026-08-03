import { InstanceRepository } from '../../src/domains/mission/instance.repository';

describe('InstanceRepository', () => {
  function makeDb(overrides: any = {}) {
    return {
      zone: { upsert: jest.fn().mockResolvedValue({ id: 'zone-inst-1' }) },
      room: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: `room-${Math.random()}`, ...args.data })),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
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

    it('connects generated Mission Instance rooms into a traversable route', async () => {
      const db = makeDb();
      const repo = new InstanceRepository(db as any);

      const rooms = await repo.createInstanceRooms('inst-1', ['office-a', 'server-room']);

      expect(db.room.update).toHaveBeenNthCalledWith(1, {
        where: { id: rooms[0].id },
        data: { exits: { east: rooms[1].slug } },
      });
      expect(db.room.update).toHaveBeenNthCalledWith(2, {
        where: { id: rooms[1].id },
        data: { exits: { west: rooms[0].slug } },
      });
    });
  });

  describe('findInstanceByRoomId', () => {
    it('returns null when the room has no missionInstanceId', async () => {
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({ id: 'r-1', missionInstanceId: null });
      const repo = new InstanceRepository(db as any);

      await expect(repo.findInstanceByRoomId('r-1')).resolves.toBeNull();
    });

    it('returns the instance when the room has a missionInstanceId', async () => {
      const instance = { id: 'inst-1', status: 'PENDING', alertLevel: 'GREEN' };
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({ id: 'r-1', missionInstanceId: 'inst-1' });
      db.missionInstance.findUnique.mockResolvedValue(instance);
      const repo = new InstanceRepository(db as any);

      await expect(repo.findInstanceByRoomId('r-1')).resolves.toEqual(instance);
    });
  });

  describe('instance alert persistence', () => {
    it('atomically raises an active instance owned by the source room', async () => {
      const db = makeDb();
      db.missionInstance.updateMany.mockResolvedValue({ count: 1 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.raiseInstanceAlert('inst-1', 'RED', 'room-9', ['GREEN', 'YELLOW']))
        .resolves.toBe(true);
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

    it('atomically replaces a same-level live source', async () => {
      const db = makeDb();
      db.missionInstance.updateMany.mockResolvedValue({ count: 1 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.replaceInstanceAlertSource('inst-1', 'RED', 'room-9')).resolves.toBe(true);
      expect(db.missionInstance.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: 'RED',
          OR: [
            { alertSourceRoomId: null },
            { alertSourceRoomId: { not: 'room-9' } },
          ],
          rooms: { some: { id: 'room-9' } },
        },
        data: { alertSourceRoomId: 'room-9' },
      });
    });

    it('allows reconciliation to claim only a missing same-level source', async () => {
      const db = makeDb();
      db.missionInstance.updateMany.mockResolvedValue({ count: 1 });
      const repo = new InstanceRepository(db as any);

      await expect(repo.claimInstanceAlertSource('inst-1', 'YELLOW', 'room-9')).resolves.toBe(true);
      expect(db.missionInstance.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'inst-1',
          status: 'ACTIVE',
          alertLevel: 'YELLOW',
          alertSourceRoomId: null,
          rooms: { some: { id: 'room-9' } },
        },
        data: { alertSourceRoomId: 'room-9' },
      });
    });

    it('loads the compact alert record owned by a room', async () => {
      const alert = {
        id: 'inst-1', status: 'ACTIVE', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2',
      };
      const db = makeDb();
      db.room.findUnique.mockResolvedValue({ missionInstance: alert });
      const repo = new InstanceRepository(db as any);

      await expect(repo.findInstanceAlertForRoom('room-2')).resolves.toEqual(alert);
      expect(db.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-2' },
        select: {
          missionInstance: {
            select: { id: true, status: true, alertLevel: true, alertSourceRoomId: true },
          },
        },
      });
    });

    it('loads raw persisted sources only for active non-GREEN instances', async () => {
      const rows = [
        { id: 'inst-1', alertLevel: 'YELLOW', alertSourceRoomId: 'room-2' },
        { id: 'inst-2', alertLevel: 'RED', alertSourceRoomId: 'room-3' },
      ];
      const db = makeDb();
      db.missionInstance.findMany.mockResolvedValue(rows);
      const repo = new InstanceRepository(db as any);

      await expect(repo.findActiveInstanceAlerts()).resolves.toEqual(rows);
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
});
