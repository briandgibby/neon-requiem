import { MissionRepository } from '../../src/domains/mission/mission.repository';

describe('MissionRepository.completeMission', () => {
  it('credits and finalizes only the caller that claims the active Mission', async () => {
    const tx = {
      activeMission: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      character: {
        update: jest.fn().mockResolvedValue({ nuyen: 3500 }),
        findUnique: jest.fn(),
      },
      missionInstance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const repo = new MissionRepository(db as any);

    await expect(repo.completeMission({
      missionId: 'mission-1',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      safeRoomId: 'safe-room',
      payout: 3000,
    })).resolves.toEqual({ completedNow: true, nuyenTotal: 3500 });

    expect(tx.character.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nuyen: { increment: 3000 },
        currentRoomId: 'safe-room',
      }),
    }));
    expect(tx.missionInstance.updateMany).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('does not credit or audit when another request already completed the Mission', async () => {
    const tx = {
      activeMission: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      character: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ nuyen: 3500 }),
      },
      missionInstance: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const repo = new MissionRepository(db as any);

    await expect(repo.completeMission({
      missionId: 'mission-1',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      safeRoomId: 'safe-room',
      payout: 3000,
    })).resolves.toEqual({ completedNow: false, nuyenTotal: 3500 });
    expect(tx.character.update).not.toHaveBeenCalled();
    expect(tx.missionInstance.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
