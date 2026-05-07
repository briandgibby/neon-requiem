import { EcsRegistry, EntityId } from '../registry';
import { ComponentTypes, ApComponent, CombatStatusComponent } from '../components';
import { CombatMove } from '../../../shared/types';
import { ValidationError } from '../../../shared/errors';

export interface MoveContext {
  registry: EcsRegistry;
  // We can add WorldService, MagicService etc here as needed
  [key: string]: any;
}

export interface MoveExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface MoveExecutor {
  readonly type: CombatMove;
  readonly apCost: number;
  
  validate(actorId: EntityId, targetId: EntityId, context: MoveContext): void;
  execute(actorId: EntityId, targetId: EntityId, context: MoveContext): Promise<MoveExecutionResult>;
}

export class MoveDispatcher {
  private executors = new Map<CombatMove, MoveExecutor>();

  register(executor: MoveExecutor): void {
    this.executors.set(executor.type, executor);
  }

  async dispatch(
    moveType: CombatMove,
    actorId: EntityId,
    targetId: EntityId,
    context: MoveContext
  ): Promise<MoveExecutionResult> {
    const executor = this.executors.get(moveType);
    if (!executor) {
      throw new ValidationError(`Unknown move: ${moveType}`);
    }

    // 1. Core ECS Validations (AP and Status)
    this.performCoreValidations(actorId, executor, context.registry);

    // 2. Move-specific Validations
    executor.validate(actorId, targetId, context);

    // 3. Deduct Costs
    this.deductCosts(actorId, executor, context.registry);

    // 4. Execute
    return executor.execute(actorId, targetId, context);
  }

  private performCoreValidations(actorId: EntityId, executor: MoveExecutor, registry: EcsRegistry): void {
    const status = registry.getComponent<CombatStatusComponent>(actorId, ComponentTypes.CombatStatus);
    const ap = registry.getComponent<ApComponent>(actorId, ComponentTypes.Ap);

    if (!status || !ap) {
      throw new ValidationError('Entity is not in a combat-ready state.');
    }

    if (status.state === 'recovering' && executor.type !== 'consume') {
      throw new ValidationError('Cannot perform actions while recovering.');
    }

    if (ap.current < executor.apCost) {
      throw new ValidationError(`Not enough Action Points (Need ${executor.apCost}, have ${ap.current})`);
    }
  }

  private deductCosts(actorId: EntityId, executor: MoveExecutor, registry: EcsRegistry): void {
    const ap = registry.getComponent<ApComponent>(actorId, ComponentTypes.Ap);
    const status = registry.getComponent<CombatStatusComponent>(actorId, ComponentTypes.CombatStatus);
    
    if (ap) {
      ap.current -= executor.apCost;
      if (ap.current <= 0 && status) {
        status.state = 'recovering';
        // Recovery ticks logic can stay here or move to a system
        ap.recoveryTicks = 5; 
      }
    }
  }
}
