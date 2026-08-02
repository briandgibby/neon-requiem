import { WorldRepository } from '../../src/domains/world/world.repository';

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
});
