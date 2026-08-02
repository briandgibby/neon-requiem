import { PatrolDefinitionRepository } from './patrol-definition.repository';

export interface PersistedPatrolDefinition {
  id: string;
  slug: string;
  startRoomSlug: string;
  routeRoomSlugs: unknown;
  mobTemplateId: string;
}

export interface PatrolDefinitionSource {
  listEnabled(): Promise<PersistedPatrolDefinition[]>;
}

export class PatrolDefinitionService implements PatrolDefinitionSource {
  constructor(private readonly repository: PatrolDefinitionRepository) {}

  listEnabled(): Promise<PersistedPatrolDefinition[]> {
    return this.repository.listEnabled();
  }
}
