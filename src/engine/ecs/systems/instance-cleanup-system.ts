import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, PositionComponent } from '../components';
import { InstanceRepository } from '../../../domains/mission/instance.repository';

export class InstanceCleanupSystem implements Tickable {
  readonly name = 'ecs_instance_cleanup_system';
  readonly frequency = 60;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly instanceRepo: InstanceRepository,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const resolved = await this.instanceRepo.findResolvedInstances();
    if (resolved.length === 0) return;

    for (const instance of resolved) {
      const instanceRoomIds = new Set((instance as any).rooms.map((r: any) => r.id));

      // Evict all ECS entities positioned in instance rooms
      const allPositioned = this.registry.getEntitiesWith([ComponentTypes.Position]);
      for (const entityId of allPositioned) {
        const pos = this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
        if (pos && instanceRoomIds.has(pos.roomId)) {
          this.registry.destroyEntity(entityId);
        }
      }

      // Clean up DB records
      try {
        await this.instanceRepo.deleteInstanceRooms(instance.id);
        await this.instanceRepo.deleteInstance(instance.id);
      } catch (_err) {
        // Non-fatal — will retry next tick
      }
    }
  }
}
