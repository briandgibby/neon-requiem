import { randomUUID } from 'crypto';

export type EntityId = string;
export type ComponentType = string;

export class EcsRegistry {
  private readonly entities = new Set<EntityId>();
  private readonly componentsByType = new Map<ComponentType, Map<EntityId, any>>();

  createEntity(): EntityId {
    const id = randomUUID();
    this.entities.add(id);
    return id;
  }

  destroyEntity(entityId: EntityId): void {
    if (!this.entities.has(entityId)) return;

    for (const componentMap of this.componentsByType.values()) {
      componentMap.delete(entityId);
    }
    this.entities.delete(entityId);
  }

  addComponent<T>(entityId: EntityId, type: ComponentType, data: T): void {
    if (!this.entities.has(entityId)) throw new Error(`Entity ${entityId} does not exist`);

    let componentMap = this.componentsByType.get(type);
    if (!componentMap) {
      componentMap = new Map<EntityId, any>();
      this.componentsByType.set(type, componentMap);
    }
    componentMap.set(entityId, data);
  }

  removeComponent(entityId: EntityId, type: ComponentType): void {
    this.componentsByType.get(type)?.delete(entityId);
  }

  getComponent<T>(entityId: EntityId, type: ComponentType): T | undefined {
    return this.componentsByType.get(type)?.get(entityId);
  }

  getEntitiesWith(types: ComponentType[]): EntityId[] {
    if (types.length === 0) return Array.from(this.entities);

    // Start with the smallest map to optimize intersection
    const maps = types
      .map(t => this.componentsByType.get(t))
      .filter((m): m is Map<EntityId, any> => !!m);

    if (maps.length < types.length) return []; // One or more components have no entities

    maps.sort((a, b) => a.size - b.size);

    const firstMap = maps[0];
    const results: EntityId[] = [];

    for (const entityId of firstMap.keys()) {
      let hasAll = true;
      for (let i = 1; i < maps.length; i++) {
        if (!maps[i].has(entityId)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) results.push(entityId);
    }

    return results;
  }

  get entityCount(): number {
    return this.entities.size;
  }

  getEntityByComponent<T>(type: ComponentType, predicate: (data: T) => boolean): EntityId | undefined {
    const componentMap = this.componentsByType.get(type);
    if (!componentMap) return undefined;

    for (const [entityId, data] of componentMap.entries()) {
      if (predicate(data)) return entityId;
    }
    return undefined;
  }
}
