import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, MatrixNodeComponent } from '../components';
import { MatrixRepository } from '../../../domains/matrix/matrix.repository';

export class MatrixTickSystem implements Tickable {
  readonly name = 'ecs_matrix_tick_system';
  readonly frequency = 10;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly matrixRepo: MatrixRepository,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const nodeIds = this.registry.getEntitiesWith([ComponentTypes.MatrixNode]);

    for (const nodeId of nodeIds) {
      const node = this.registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      if (!node) continue;

      if (node.alertLevel === 'YELLOW' && Math.random() < 0.1) {
        node.alertLevel = 'GREEN';
        try {
          await this.matrixRepo.updateNodeAlert(node.nodeId, 'GREEN');
        } catch (_err) {
          // Non-fatal: ECS state is authoritative for the session
        }
      }
    }
  }
}
