import { CombatStatus, CombatMove } from '../../shared/types';

export interface CombatParticipant {
  id: string; // characterId or mobId
  name: string;
  type: 'player' | 'npc';
  hp: number;
  maxHp: number;
  stun: number;
  maxStun: number;
  mana: number;
  maxMana: number;
  ap: number;
  maxAp: number;
  status: CombatStatus;
  recoveryTicks: number; // Ticks remaining until AP refresh
  isPetActive: boolean;

  // Stats for combat math
  level: number;
  body: number;
  agility: number;
  dexterity: number;
  strength: number;
  logic: number;
  intuition: number;
  willpower: number;
  charisma: number;
  luck: number;
  
  masteryCQC: number;
  masteryPistol: number;
  masteryRifle: number;
  masteryAutomatic: number;
  
  armorValue: number;
}

export interface CombatSession {
  id: string;
  roomId: string;
  securityRating: string;
  participants: Record<string, CombatParticipant>;
  tick: number;
  
  alarmState: 'GREEN' | 'YELLOW' | 'RED';
  turnsUntilReinforcements: number | null;
  backupCalled: boolean;
}

export type HitType = 'crit' | 'solid' | 'glancing' | 'dodge';
export type AbsorbType = 'none' | 'some' | 'most';

export interface HitResult {
  type: HitType;
  absorb: AbsorbType;
  baseDamage: number;
  finalDamage: number;
  critMultiplier?: number;
  message: string;
  counter?: HitResult | null;
}

export interface MoveInput {
  characterId: string;
  targetId: string;
  move: CombatMove;
  spellSlug?: string;
  matrixAction?: string;
}
