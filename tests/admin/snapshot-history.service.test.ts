import { SnapshotHistoryService } from '../../src/domains/admin/snapshot-history.service';
import { ForbiddenError } from '../../src/shared/errors';

describe('SnapshotHistoryService', () => {
  it('rejects non-admin accounts before querying snapshot history', async () => {
    const repository = {
      isAccountAdmin: jest.fn().mockResolvedValue(false),
      findSnapshots: jest.fn(),
    };
    const service = new SnapshotHistoryService(repository);

    await expect(service.listSnapshots('account-1', { limit: 101 }))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.findSnapshots).not.toHaveBeenCalled();
  });

  it('validates query limits after authorizing an administrator', async () => {
    const repository = {
      isAccountAdmin: jest.fn().mockResolvedValue(true),
      findSnapshots: jest.fn(),
    };
    const service = new SnapshotHistoryService(repository);

    await expect(service.listSnapshots('admin-1', { limit: 101 })).rejects.toMatchObject({
      name: 'ZodError',
    });
    expect(repository.findSnapshots).not.toHaveBeenCalled();
  });

  it('returns only typed snapshot fields to administrators', async () => {
    const recordedAt = new Date('2026-08-02T15:00:00.000Z');
    const repository = {
      isAccountAdmin: jest.fn().mockResolvedValue(true),
      findSnapshots: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          timestamp: recordedAt,
          characterId: 'character-1',
          character: { name: 'Neon Fox' },
          metadata: {
            snapshot: { hp: 42, stun: 13, mana: 7, roomId: 'room-1', timestamp: 1_754_146_800_000 },
            internalNote: 'must not leak',
          },
        },
      ]),
    };
    const service = new SnapshotHistoryService(repository);

    await expect(service.listSnapshots('admin-1', { characterId: 'character-1', limit: 25 }))
      .resolves.toEqual({
        snapshots: [{
          id: 'audit-1',
          recordedAt: recordedAt.toISOString(),
          capturedAt: new Date(1_754_146_800_000).toISOString(),
          character: { id: 'character-1', name: 'Neon Fox' },
          state: { hp: 42, stun: 13, mana: 7, roomId: 'room-1' },
        }],
      });
    expect(repository.findSnapshots).toHaveBeenCalledWith({
      characterId: 'character-1',
      limit: 25,
    });
  });

  it('omits malformed historical audit metadata', async () => {
    const repository = {
      isAccountAdmin: jest.fn().mockResolvedValue(true),
      findSnapshots: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          timestamp: new Date(),
          characterId: 'character-1',
          character: { name: 'Neon Fox' },
          metadata: { snapshot: { hp: 'unknown' } },
        },
      ]),
    };
    const service = new SnapshotHistoryService(repository);

    await expect(service.listSnapshots('admin-1', { limit: 50 }))
      .resolves.toEqual({ snapshots: [] });
  });
});
