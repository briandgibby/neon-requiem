import { EcsRegistry } from './registry';

export interface EcsSystem {
  update(registry: EcsRegistry, deltaTime: number): void;
}
