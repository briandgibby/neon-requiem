import { PrismaClient } from '@prisma/client';

export class PatrolDefinitionRepository {
  constructor(private readonly db: PrismaClient) {}

  async listEnabled() {
    const definitions = await this.db.patrolDefinition.findMany({
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

    return definitions.map((definition) => ({
      id: definition.id,
      slug: definition.slug,
      startRoomSlug: definition.startRoom.slug,
      routeRoomSlugs: definition.routeRoomSlugs,
      mobTemplateId: definition.mobTemplateId,
    }));
  }
}
