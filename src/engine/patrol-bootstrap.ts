import { PatrolDefinitionSource, PersistedPatrolDefinition } from '../domains/world/patrol-definition.repository';
import { RoomLookup, SafeZonePolicy } from '../domains/world/world.types';
import { AiComponent, ComponentTypes, PatrolDefinitionComponent } from './ecs/components';
import { MobFactory } from './ecs/factories/mob-factory';
import { EcsRegistry } from './ecs/registry';

interface PatrolWorldPolicy extends RoomLookup, SafeZonePolicy {}
type PatrolRoom = Awaited<ReturnType<RoomLookup['getRoom']>>;

interface PatrolBootstrapDiagnostics {
  warn(obj: unknown, msg: string): void;
}

export class PatrolBootstrap {
  private readonly loadingDefinitionIds = new Set<string>();

  constructor(
    private readonly registry: EcsRegistry,
    private readonly definitions: PatrolDefinitionSource,
    private readonly worldPolicy: PatrolWorldPolicy,
    private readonly diagnostics: PatrolBootstrapDiagnostics,
  ) {}

  async load(): Promise<number> {
    const definitions = await this.definitions.listEnabled();
    let loaded = 0;

    for (const definition of definitions) {
      if (this.hasMaterializedPatrol(definition.id) || this.loadingDefinitionIds.has(definition.id)) continue;
      this.loadingDefinitionIds.add(definition.id);

      try {
        const route = await this.resolveRoute(definition);
        const entityId = MobFactory.createFromTemplate(
          this.registry,
          definition.mobTemplate,
          route[0].id,
          'patrol',
        );
        const ai = this.registry.getComponent<AiComponent>(entityId, ComponentTypes.Ai);
        if (!ai) {
          this.registry.destroyEntity(entityId);
          throw new Error('Patrol mob is missing its AI component');
        }
        ai.patrolRoute = route.map((room) => room.id);
        this.registry.addComponent<PatrolDefinitionComponent>(
          entityId,
          ComponentTypes.PatrolDefinition,
          { definitionId: definition.id },
        );
        loaded += 1;
      } catch (err) {
        this.diagnostics.warn(
          { err, patrolDefinitionId: definition.id, patrolDefinitionSlug: definition.slug },
          'Skipped invalid patrol definition',
        );
      } finally {
        this.loadingDefinitionIds.delete(definition.id);
      }
    }

    return loaded;
  }

  private hasMaterializedPatrol(definitionId: string): boolean {
    return !!this.registry.getEntityByComponent<PatrolDefinitionComponent>(
      ComponentTypes.PatrolDefinition,
      (definition) => definition.definitionId === definitionId,
    );
  }

  private async resolveRoute(definition: PersistedPatrolDefinition): Promise<PatrolRoom[]> {
    const routeSlugs = definition.routeRoomSlugs;
    if (
      !Array.isArray(routeSlugs)
      || routeSlugs.length < 2
      || routeSlugs.some((slug) => typeof slug !== 'string' || slug.length === 0)
    ) {
      throw new Error('Patrol route must contain at least two room slugs');
    }
    if (new Set(routeSlugs).size !== routeSlugs.length) {
      throw new Error('Patrol routes cannot repeat rooms');
    }
    if (routeSlugs[0] !== definition.startRoomSlug) {
      throw new Error('Patrol route must begin in its configured start room');
    }

    const rooms = await Promise.all(routeSlugs.map((slug) => this.worldPolicy.getRoom(slug)));
    for (let index = 0; index < rooms.length; index += 1) {
      const room = rooms[index];
      if (room.slug !== routeSlugs[index]) throw new Error('Patrol routes must use stable room slugs');
      if (room.missionInstanceId) throw new Error('Persisted patrols cannot target MissionInstance rooms');
      if (await this.worldPolicy.isEffectiveSafeZone(room.id)) {
        throw new Error('Persisted patrol routes cannot enter effective safe zones');
      }

      const nextRoom = rooms[index + 1];
      if (nextRoom && !Object.values(room.exits ?? {}).includes(nextRoom.slug)) {
        throw new Error('Patrol route contains non-adjacent rooms');
      }
    }

    return rooms;
  }
}
