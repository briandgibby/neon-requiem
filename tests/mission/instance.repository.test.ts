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
          findMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      await repo.updateInstanceAlertLevel('inst-1', 'GREEN');

      expect(db.missionInstance.update).not.toHaveBeenCalled();
    });

    it('escalates when the new level is higher', async () => {
      const db = makeDb({
        missionInstance: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', alertLevel: 'GREEN' }),
          findFirst: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn(),
        },
      });
      const repo = new InstanceRepository(db as any);

      await repo.updateInstanceAlertLevel('inst-1', 'RED');

      expect(db.missionInstance.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { alertLevel: 'RED' },
      });
    });
  });
});
