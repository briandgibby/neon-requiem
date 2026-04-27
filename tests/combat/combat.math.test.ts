import { calculateHitType, calculateAbsorbType, resolveHit } from '../../src/domains/combat/combat.math';
import { CombatParticipant } from '../../src/domains/combat/combat.types';

describe('CombatMath', () => {
  const mockAttacker: CombatParticipant = {
    id: '1', name: 'A', type: 'player', hp: 100, maxHp: 100, ap: 6, maxAp: 6, status: 'engaged', recoveryTicks: 0, isPetActive: false,
    level: 1, agility: 5, intuition: 5, strength: 5, body: 5, luck: 5, masteryCQC: 5, masteryPistol: 0, masteryRifle: 0, masteryAutomatic: 0, armorValue: 0
  };

  const mockDefender: CombatParticipant = {
    id: '2', name: 'D', type: 'npc', hp: 100, maxHp: 100, ap: 6, maxAp: 6, status: 'engaged', recoveryTicks: 0, isPetActive: false,
    level: 1, agility: 5, intuition: 5, strength: 5, body: 5, luck: 5, masteryCQC: 5, masteryPistol: 0, masteryRifle: 0, masteryAutomatic: 0, armorValue: 5
  };

  describe('calculateHitType', () => {
    it('returns a valid hit type', () => {
      const type = calculateHitType(mockAttacker, mockDefender, 'attack');
      expect(['crit', 'solid', 'glancing', 'dodge']).toContain(type);
    });
  });

  describe('calculateAbsorbType', () => {
    it('returns a valid absorb type', () => {
      const type = calculateAbsorbType(10, mockDefender);
      expect(['none', 'some', 'most']).toContain(type);
    });
  });

  describe('resolveHit', () => {
    it('calculates damage for solid hit', () => {
      const result = resolveHit('solid', 20, 'none');
      expect(result.finalDamage).toBeGreaterThanOrEqual(16); // 20 * 0.81
      expect(result.finalDamage).toBeLessThanOrEqual(20);
    });

    it('calculates damage for critical hit', () => {
      const result = resolveHit('crit', 20, 'none', 2);
      // Crit is 2x solid (min 16*2 = 32)
      expect(result.finalDamage).toBeGreaterThanOrEqual(32);
      expect(result.type).toBe('crit');
      expect(result.critMultiplier).toBe(2);
    });

    it('calculates zero damage for dodge', () => {
      const result = resolveHit('dodge', 20, 'none');
      expect(result.finalDamage).toBe(0);
    });

    it('applies absorption multiplier', () => {
      const result = resolveHit('solid', 100, 'most');
      // Most absorb is 0.3 - 0.5. Solid is 0.81 - 1.0.
      // Min: 100 * 0.81 * 0.3 = 24.3
      // Max: 100 * 1.0 * 0.5 = 50
      expect(result.finalDamage).toBeGreaterThanOrEqual(24);
      expect(result.finalDamage).toBeLessThanOrEqual(50);
    });
  });
});
