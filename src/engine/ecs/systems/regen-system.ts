import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, HealthComponent, StunComponent, ManaComponent } from '../components';

export class RegenSystem implements Tickable {
  readonly name = 'ecs_regen_system';
  readonly frequency = 10; // Every 10 ticks

  constructor(private readonly registry: EcsRegistry) {}

  async onTick(_tickCount: number): Promise<void> {
    this.regenPool(ComponentTypes.Health);
    this.regenPool(ComponentTypes.Stun);
    this.regenPool(ComponentTypes.Mana);
  }

  private regenPool(type: string): void {
    const entities = this.registry.getEntitiesWith([type]);

    for (const entityId of entities) {
      const pool = this.registry.getComponent<any>(entityId, type);
      if (!pool) continue;

      if (type === ComponentTypes.Health && pool.current <= 0) continue;

      if (pool.current < pool.max) {
        pool.current = Math.min(pool.max, pool.current + 1);
        pool.lastRegenAt = Date.now();
      }
    }
  }
}
