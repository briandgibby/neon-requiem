import { PrismaClient } from '@prisma/client';
import { MobTemplateRecord } from '../combat/combat.types';

export interface PersistedPatrolDefinition {
  id: string;
  slug: string;
  startRoomSlug: string;
  routeRoomSlugs: unknown;
  mobTemplate: MobTemplateRecord;
}

export interface PatrolDefinitionSource {
  listEnabled(): Promise<PersistedPatrolDefinition[]>;
}

export class PatrolDefinitionRepository implements PatrolDefinitionSource {
  constructor(private readonly db: PrismaClient) {}

  async listEnabled(): Promise<PersistedPatrolDefinition[]> {
    const definitions = await this.db.patrolDefinition.findMany({
      where: { enabled: true },
      include: { startRoom: true, mobTemplate: true },
      orderBy: { slug: 'asc' },
    });

    return definitions.map((definition) => ({
      id: definition.id,
      slug: definition.slug,
      startRoomSlug: definition.startRoom.slug,
      routeRoomSlugs: definition.routeRoomSlugs,
      mobTemplate: definition.mobTemplate as MobTemplateRecord,
    }));
  }
}
