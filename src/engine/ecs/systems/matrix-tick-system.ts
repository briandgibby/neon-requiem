import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, MatrixNodeComponent } from '../components';
import { MatrixRepository } from '../../../domains/matrix/matrix.repository';
import {
  instanceAlertPriority,
  type InstanceAlertSynchronization,
  type InstanceAlertView,
} from '../../../domains/mission/instance-alert.service';

export class MatrixTickSystem implements Tickable {
  readonly name = 'ecs_matrix_tick_system';
  readonly frequency = 10;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly matrixRepo: MatrixRepository,
    private readonly instanceAlerts?: InstanceAlertSynchronization,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    await this.reconcilePersistedInstanceNodes();
    const nodeIds = this.registry.getEntitiesWith([ComponentTypes.MatrixNode]);

    for (const nodeId of nodeIds) {
      const node = this.registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);
      if (!node) continue;

      const instance = await this.findLinkedInstance(node);
      if (instance === undefined) continue;
      if (instance) {
        const nodePriority = instanceAlertPriority(node.alertLevel);
        const instancePriority = instanceAlertPriority(instance.alertLevel);

        if (instancePriority > nodePriority) {
          try {
            await this.matrixRepo.updateNodeAlert(node.nodeId, instance.alertLevel);
            node.alertLevel = instance.alertLevel as MatrixNodeComponent['alertLevel'];
          } catch (_err) {
            // Keep the lower ECS value so the next tick retries the write.
          }
        } else if (
          node.linkedRoomId
          && node.alertLevel !== 'GREEN'
          && (nodePriority > instancePriority || (nodePriority > 0 && !instance.alertSourceRoomId))
        ) {
          try {
            await this.instanceAlerts!.ensureAlertFromRoom(node.linkedRoomId, node.alertLevel);
          } catch (_err) {
            // Non-fatal; the next tick retries synchronization.
          }
        }
        continue;
      }

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

  private async reconcilePersistedInstanceNodes(): Promise<void> {
    if (!this.instanceAlerts) return;

    let alerts: Array<{ instanceId: string; alarmState: 'YELLOW' | 'RED' }>;
    try {
      alerts = await this.instanceAlerts.findActiveInstanceAlertSources();
    } catch (_err) {
      return;
    }

    for (const alert of alerts) {
      try {
        await this.matrixRepo.escalateInstanceNodes(alert.instanceId, alert.alarmState);
      } catch (_err) {
        // The persisted MissionInstance source keeps this work retryable.
      }
    }
  }

  private async findLinkedInstance(
    node: MatrixNodeComponent,
  ): Promise<InstanceAlertView | null | undefined> {
    if (!this.instanceAlerts || !node.linkedRoomId) return null;
    try {
      return await this.instanceAlerts.findActiveAlertForRoom(node.linkedRoomId);
    } catch (_err) {
      return undefined;
    }
  }
}
