import { EntityId } from '../../registry';
import { MoveExecutor, MoveContext, MoveExecutionResult } from '../move-dispatcher';
import { ComponentTypes, AttributesComponent, DeckerComponent, MatrixNodeComponent } from '../../components';
import { CombatMove } from '../../../../shared/types';
import { ValidationError } from '../../../../shared/errors';

export class MatrixBruteExecutor implements MoveExecutor {
  readonly type: CombatMove = 'brute';
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
  }

  async execute(actorId: EntityId, targetId: EntityId, context: MoveContext): Promise<MoveExecutionResult> {
    const { registry } = context;

    const actorAttrs = registry.getComponent<AttributesComponent>(actorId, ComponentTypes.Attributes);
    const decker = registry.getComponent<DeckerComponent>(actorId, ComponentTypes.Decker);
    const node = registry.getComponent<MatrixNodeComponent>(decker!.activeNodeEntityId, ComponentTypes.MatrixNode);

    if (!actorAttrs || !decker || !node) {
      throw new Error('Incomplete data for Brute Force resolution.');
    }

    const intM = actorAttrs.intuition + actorAttrs.logic;
    const stat = decker.attack;
    
    const playerRoll = intM + stat + Math.floor(Math.random() * 20) + 1;
    const nodeRoll = (node.securityLevel * 2) + 10 + Math.floor(Math.random() * 10);

    const success = playerRoll >= nodeRoll;
    node.alertLevel = 'RED'; // Brute force always triggers RED alert

    return {
      success,
      message: success ? 'Data-lock shattered. System access granted (Alert: RED).' : 'Node firewall holds firm. Alert triggered (Alert: RED).',
      data: { playerRoll, nodeRoll, newAlertLevel: 'RED' }
    };
  }
}
