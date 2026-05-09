import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, MatrixNodeComponent } from '../components';

export class MatrixTickSystem implements Tickable {
  readonly name = 'ecs_matrix_tick_system';
  readonly frequency = 10; // Ticks every 10 heartbeats for alert decay

  constructor(private readonly registry: EcsRegistry) {}

  async onTick(_tickCount: number): Promise<void> {
    const nodeIds = this.registry.getEntitiesWith([ComponentTypes.MatrixNode]);

    for (const nodeId of nodeIds) {
      const node = this.registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      if (!node) continue;

      // Logic for Alert Decay:
      // If a node is YELLOW but no active hacks happen for a while, it could revert to GREEN.
      // For now, we simply simulate a slow decay mechanism by having a low chance to revert YELLOW to GREEN.
      // RED alerts require manual intervention or a full node reboot (which we might simulate as taking much longer).
      if (node.alertLevel === 'YELLOW' && Math.random() < 0.1) {
        node.alertLevel = 'GREEN';
      }
    }
  }
}
