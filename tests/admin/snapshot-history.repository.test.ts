import { SnapshotHistoryRepository } from '../../src/domains/admin/snapshot-history.repository';

describe('SnapshotHistoryRepository', () => {
  it('checks current admin state in the database', async () => {
    const findUnique = jest.fn().mockResolvedValue({ isAdmin: true });
    const repository = new SnapshotHistoryRepository({ account: { findUnique } } as any);

    await expect(repository.isAccountAdmin('account-1')).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      select: { isAdmin: true },
    });
  });

  it('loads a bounded newest-first snapshot projection', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new SnapshotHistoryRepository({ auditLog: { findMany } } as any);

    await repository.findSnapshots({ characterId: 'character-1', limit: 25 });

    expect(findMany).toHaveBeenCalledWith({
      where: { category: 'PLAYER_SNAPSHOT', characterId: 'character-1' },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 25,
      select: {
        id: true,
        timestamp: true,
        characterId: true,
        character: { select: { name: true } },
        metadata: true,
      },
    });
  });
});
