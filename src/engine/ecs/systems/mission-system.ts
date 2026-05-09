import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, MissionTargetComponent, HealthComponent, MatrixNodeComponent } from '../components';

export type ObjectiveCompleteCallback = (missionId: string, objectiveIndex: number) => Promise<void>;

export class MissionSystem implements Tickable {
  readonly name = 'ecs_mission_system';
  readonly frequency = 5; // Ticks every 5 heartbeats

  constructor(
    private readonly registry: EcsRegistry,
    private readonly onObjectiveComplete: ObjectiveCompleteCallback
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const targetIds = this.registry.getEntitiesWith([ComponentTypes.MissionTarget]);

    for (const targetId of targetIds) {
      const target = this.registry.getComponent<MissionTargetComponent>(targetId, ComponentTypes.MissionTarget);
      if (!target || target.isCompleted) continue;

      let isMet = false;

      if (target.goalType === 'KILL') {
        const health = this.registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
        if (health && health.current <= 0) {
          isMet = true;
        }
      } else if (target.goalType === 'HACK') {
        const node = this.registry.getComponent<MatrixNodeComponent>(targetId, ComponentTypes.MatrixNode);
        // Completion criteria for hack: Alert Level RED + something else? 
        // Or maybe a specific 'isHacked' flag we should add to MatrixNodeComponent.
        // For now, let's say alertLevel RED constitutes a successful breach for basic objectives.
        if (node && node.alertLevel === 'RED') {
          isMet = true;
        }
      }

      if (isMet) {
        target.isCompleted = true;
        await this.onObjectiveComplete(target.missionId, target.objectiveIndex);
      }
    }
  }
}
