import { EntityId } from '../../registry';
import { MoveExecutor, MoveContext, MoveExecutionResult } from '../move-dispatcher';
import { ComponentTypes, AttributesComponent, DeckerComponent, MatrixNodeComponent, IceComponent, HealthComponent } from '../../components';
import { CombatMove } from '../../../../shared/types';
import { ValidationError } from '../../../../shared/errors';

export class MatrixDataSpikeExecutor implements MoveExecutor {
  readonly type: CombatMove = 'data-spike';
  readonly apCost = 2;

  validate(actorId: EntityId, targetId: EntityId, context: MoveContext): void {
    const decker = context.registry.getComponent<DeckerComponent>(actorId, ComponentTypes.Decker);
    if (!decker) {
      throw new ValidationError('You are not currently jacked into the Matrix.');
    }
    const node = context.registry.getComponent<MatrixNodeComponent>(decker.activeNodeEntityId, ComponentTypes.MatrixNode);
    if (!node) {
      throw new ValidationError('Active Matrix Node not found.');
    }
    const targetIce = context.registry.getComponent<IceComponent>(targetId, ComponentTypes.Ice);
    const targetDecker = context.registry.getComponent<DeckerComponent>(targetId, ComponentTypes.Decker);
    if (!targetIce && !targetDecker) {
       throw new ValidationError('Target is not a valid Matrix entity (ICE or Decker).');
    }
  }

  async execute(actorId: EntityId, targetId: EntityId, context: MoveContext): Promise<MoveExecutionResult> {
    const { registry } = context;

    const actorAttrs = registry.getComponent<AttributesComponent>(actorId, ComponentTypes.Attributes);
    const decker = registry.getComponent<DeckerComponent>(actorId, ComponentTypes.Decker);
    const node = registry.getComponent<MatrixNodeComponent>(decker!.activeNodeEntityId, ComponentTypes.MatrixNode);

    if (!actorAttrs || !decker || !node) {
      throw new Error('Incomplete data for Data Spike resolution.');
    }

    const playerRoll = actorAttrs.logic + decker.attack + Math.floor(Math.random() * 20) + 1;
    
    // Resolve target defense
    let targetRoll = 0;
    let targetName = 'Target';
    
    const targetIce = registry.getComponent<IceComponent>(targetId, ComponentTypes.Ice);
    const targetDecker = registry.getComponent<DeckerComponent>(targetId, ComponentTypes.Decker);
    const targetHealth = registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
    
    if (targetIce) {
        targetRoll = targetIce.defense + 10 + Math.floor(Math.random() * 10);
        targetName = 'ICE';
    } else if (targetDecker) {
        const targetAttrs = registry.getComponent<AttributesComponent>(targetId, ComponentTypes.Attributes);
        targetRoll = (targetAttrs?.logic || 0) + targetDecker.firewall + Math.floor(Math.random() * 20) + 1;
        targetName = 'Decker';
    }
    
    const success = playerRoll >= targetRoll;
    let damageDealt = 0;

    if (success && targetHealth) {
      damageDealt = Math.max(5, playerRoll - targetRoll);
      targetHealth.current = Math.max(0, targetHealth.current - damageDealt);
    }

    // A data spike always alerts the node if not already red
    if (node.alertLevel !== 'RED') {
      node.alertLevel = 'RED';
    }

    return {
      success,
      message: success ? `Data Spike successful! ${targetName} integrity compromised for ${damageDealt} damage.` : `Data Spike resisted by ${targetName}.`,
      data: { playerRoll, targetRoll, damageDealt, newAlertLevel: 'RED' }
    };
  }
}
