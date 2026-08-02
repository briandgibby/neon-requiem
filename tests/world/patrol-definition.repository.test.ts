import { PatrolDefinitionRepository } from '../../src/domains/world/patrol-definition.repository';

describe('PatrolDefinitionRepository', () => {
  it('loads enabled definitions with their start room and mob template reference', async () => {
    const db = {
      patrolDefinition: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'patrol-1',
          slug: 'arcology-sweep',
          mobTemplateId: 'template-1',
          routeRoomSlugs: ['room-one', 'room-two'],
          startRoom: { slug: 'room-one' },
        }]),
      },
    };
    const repository = new PatrolDefinitionRepository(db as any);

    await expect(repository.listEnabled()).resolves.toEqual([{
      id: 'patrol-1',
      slug: 'arcology-sweep',
      routeRoomSlugs: ['room-one', 'room-two'],
      startRoomSlug: 'room-one',
      mobTemplateId: 'template-1',
    }]);
    expect(db.patrolDefinition.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      select: {
        id: true,
        slug: true,
        mobTemplateId: true,
        routeRoomSlugs: true,
        startRoom: { select: { slug: true } },
      },
      orderBy: { slug: 'asc' },
    });
  });
});
