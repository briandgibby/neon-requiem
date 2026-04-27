import {
  SOLID_HIT_MIN_PERCENT,
  SOLID_HIT_MAX_PERCENT,
  GLANCING_HIT_MIN_PERCENT,
  GLANCING_HIT_MAX_PERCENT,
  ABSORB_SOME_MIN,
  ABSORB_SOME_MAX,
  ABSORB_MOST_MIN,
  ABSORB_MOST_MAX
} from '../../shared/constants';
import { CombatParticipant, HitType, AbsorbType, HitResult } from './combat.types';

export function calculateHitType(attacker: CombatParticipant, defender: CombatParticipant, move: string): HitType {
  // Accuracy = Agility + Mastery + 1d20
  // Evasion = Intuition + Agility + 1d20
  
  const mastery = move === 'attack' ? attacker.masteryCQC : attacker.masteryCQC; // Simplified for now
  const attackerRoll = attacker.agility + mastery + Math.floor(Math.random() * 20) + 1;
  const defenderRoll = defender.intuition + defender.agility + Math.floor(Math.random() * 20) + 1;

  const margin = attackerRoll - defenderRoll;

  if (margin >= 10) return 'crit';
  if (margin > 0) return 'solid';
  if (margin >= -5) return 'glancing';
  return 'dodge';
}

export function calculateAbsorbType(weaponPower: number, defender: CombatParticipant): AbsorbType {
  const roll = Math.random();
  // Heuristic: armorValue + Body determines absorption level
  const armorScore = defender.armorValue + Math.floor(defender.body / 2);
  const ratio = armorScore / (weaponPower || 1);

  if (ratio > 1.5) {
    if (roll < 0.4) return 'most';
    if (roll < 0.8) return 'some';
    return 'none';
  } else if (ratio > 0.7) {
    if (roll < 0.2) return 'most';
    if (roll < 0.6) return 'some';
    return 'none';
  } else {
    if (roll < 0.1) return 'most';
    if (roll < 0.3) return 'some';
    return 'none';
  }
}

export function getRandomMultiplier(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function resolveHit(
  type: HitType,
  baseDamage: number,
  absorbType: AbsorbType,
  critMultiplierMax: number = 2
): HitResult {
  let damage = baseDamage;
  let multiplier = 1;
  let absorbMultiplier = 1;

  if (type === 'dodge') {
    return { type: 'dodge', absorb: 'none', baseDamage, finalDamage: 0, message: 'Missed!' };
  }

  if (type === 'glancing') {
    multiplier = getRandomMultiplier(GLANCING_HIT_MIN_PERCENT, GLANCING_HIT_MAX_PERCENT);
    damage = baseDamage * multiplier;
    return {
      type: 'glancing',
      absorb: 'none',
      baseDamage,
      finalDamage: Math.floor(damage),
      message: `You land a glancing blow for ${Math.floor(damage)} damage!`
    };
  }

  // Solid or Crit
  multiplier = getRandomMultiplier(SOLID_HIT_MIN_PERCENT, SOLID_HIT_MAX_PERCENT);
  damage = baseDamage * multiplier;

  let critMult = 1;
  if (type === 'crit') {
    // Crit multipliers are clean integers: 2, 3, 4, 5
    critMult = Math.floor(Math.random() * (critMultiplierMax - 1)) + 2;
    damage *= critMult;
  }

  // Apply Absorption
  if (absorbType === 'some') {
    absorbMultiplier = getRandomMultiplier(ABSORB_SOME_MIN, ABSORB_SOME_MAX);
  } else if (absorbType === 'most') {
    absorbMultiplier = getRandomMultiplier(ABSORB_MOST_MIN, ABSORB_MOST_MAX);
  }
  
  const finalDamage = Math.floor(damage * absorbMultiplier);
  
  let message = `You hit for ${finalDamage} damage!`;
  if (type === 'crit') message = `CRITICAL HIT! ${message}`;
  if (absorbType === 'some') message += ' (Armor absorbs some of the blow)';
  if (absorbType === 'most') message += ' (Armor absorbs most of the blow)';

  return {
    type,
    absorb: absorbType,
    baseDamage,
    finalDamage,
    critMultiplier: type === 'crit' ? critMult : undefined,
    message
  };
}
