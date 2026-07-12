import { EntityId } from '../../registry';
import { MoveContext, MoveExecutionResult, MoveExecutor } from '../move-dispatcher';
import { CombatMove } from '../../../../shared/types';
import { ValidationError } from '../../../../shared/errors';
import {
  CombatStatusComponent,
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  PositionComponent,
} from '../../components';

export class GuardExecutor implements MoveExecutor {
  readonly type: CombatMove = 'guard';
  readonly apCost = 1;

  validate(actorId: EntityId, targetId: EntityId, context: MoveContext): void {
    const actorPosition = context.registry.getComponent<PositionComponent>(actorId, ComponentTypes.Position);
    const targetRoomId = this.getTargetPhysicalRoomId(targetId, context);
    const targetHealth = context.registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);

    if (!actorPosition || !targetRoomId) {
      throw new ValidationError('Guarding requires both combatants to have physical positions.');
    }
    if (!targetHealth || targetHealth.current <= 0) {
      throw new ValidationError('Target is not a valid guard target.');
    }
    if (actorPosition.roomId !== targetRoomId) {
      throw new ValidationError('You must be in the same room to guard that target.');
    }
  }

  async execute(actorId: EntityId, targetId: EntityId, context: MoveContext): Promise<MoveExecutionResult> {
    const status = context.registry.getComponent<CombatStatusComponent>(actorId, ComponentTypes.CombatStatus);
    if (!status) throw new ValidationError('Entity is not in a combat-ready state.');

    status.state = 'guarding';
    status.guardedEntityId = targetId;

    return {
      success: true,
      message: 'You take up a defensive position.',
      data: { guardedEntityId: targetId },
    };
  }

  private getTargetPhysicalRoomId(targetId: EntityId, context: MoveContext): string | undefined {
    const targetPosition = context.registry.getComponent<PositionComponent>(targetId, ComponentTypes.Position);
    if (!targetPosition) return undefined;

    const decker = context.registry.getComponent<DeckerComponent>(targetId, ComponentTypes.Decker);
    return decker?.physicalRoomId || targetPosition.roomId;
  }
}
