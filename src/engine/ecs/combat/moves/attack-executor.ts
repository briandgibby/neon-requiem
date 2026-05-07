import { EntityId } from '../../registry';
import { MoveExecutor, MoveContext, MoveExecutionResult } from '../move-dispatcher';
import { ComponentTypes, HealthComponent, AttributesComponent, SkillsComponent, CombatStatusComponent } from '../../components';
import { CombatMove } from '../../../../shared/types';
import { ValidationError } from '../../../../shared/errors';
import { calculateHitType, calculateAbsorbType, resolveHit } from '../../../../domains/combat/combat.math';
import { BASE_WEAPON_POWER } from '../../../../shared/constants';

export class AttackExecutor implements MoveExecutor {
  readonly type: CombatMove = 'attack';
  readonly apCost = 4; // Standard attack cost

  validate(actorId: EntityId, targetId: EntityId, context: MoveContext): void {
    const targetHealth = context.registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
    if (!targetHealth) {
      throw new ValidationError('Target is not a valid combatant.');
    }
    if (targetHealth.current <= 0) {
      throw new ValidationError('Target is already incapacitated.');
    }
  }

  async execute(actorId: EntityId, targetId: EntityId, context: MoveContext): Promise<MoveExecutionResult> {
    const { registry } = context;

    const actorAttrs = registry.getComponent<AttributesComponent>(actorId, ComponentTypes.Attributes);
    const actorSkills = registry.getComponent<SkillsComponent>(actorId, ComponentTypes.Skills);
    const targetAttrs = registry.getComponent<AttributesComponent>(targetId, ComponentTypes.Attributes);
    const targetSkills = registry.getComponent<SkillsComponent>(targetId, ComponentTypes.Skills);
    const targetStatus = registry.getComponent<CombatStatusComponent>(targetId, ComponentTypes.CombatStatus);
    const targetHealth = registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);

    if (!actorAttrs || !actorSkills || !targetAttrs || !targetSkills || !targetHealth) {
      throw new Error('Incomplete data for attack resolution.');
    }

    // Map ECS components to the legacy Math interface for now to leverage existing logic
    // We can deepen combat.math.ts later
    const actorLegacy: any = { ...actorAttrs, ...actorSkills };
    const targetLegacy: any = { ...targetAttrs, ...targetSkills, status: targetStatus?.state };

    let hitType = calculateHitType(actorLegacy, targetLegacy, 'attack');
    
    // Guarding logic
    if (targetStatus?.state === 'guarding' && hitType === 'solid') {
      if (Math.random() < 0.5) hitType = 'glancing';
    }

    const weaponPower = BASE_WEAPON_POWER;
    const absorbType = calculateAbsorbType(weaponPower, targetLegacy);
    const result = resolveHit(hitType, 10 + actorAttrs.strength, absorbType);

    let finalDamage = result.finalDamage;
    if (targetStatus?.state === 'guarding') {
      finalDamage = Math.floor(finalDamage * 0.8);
    }

    targetHealth.current -= finalDamage;
    if (targetHealth.current < 0) targetHealth.current = 0;

    return {
      success: true,
      message: `You attack and deal ${finalDamage} damage (${hitType}).`,
      data: { ...result, finalDamage }
    };
  }
}
