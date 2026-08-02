import { PatrolDefinitionRepository } from '../../src/domains/world/patrol-definition.repository';

describe('PatrolDefinitionRepository', () => {
  it('loads enabled definitions with their start room and mob template', async () => {
    const db = {
      patrolDefinition: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'patrol-1',
          slug: 'arcology-sweep',
          routeRoomSlugs: ['room-one', 'room-two'],
          startRoom: { slug: 'room-one' },
          mobTemplate: { id: 'template-1', slug: 'security-guard', name: 'Security Guard' },
        }]),
      },
    };
    const repository = new PatrolDefinitionRepository(db as any);

    await expect(repository.listEnabled()).resolves.toEqual([{
      id: 'patrol-1',
      slug: 'arcology-sweep',
      routeRoomSlugs: ['room-one', 'room-two'],
      startRoomSlug: 'room-one',
      mobTemplate: { id: 'template-1', slug: 'security-guard', name: 'Security Guard' },
    }]);
    expect(db.patrolDefinition.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      include: { startRoom: true, mobTemplate: true },
      orderBy: { slug: 'asc' },
    });
  });
});
