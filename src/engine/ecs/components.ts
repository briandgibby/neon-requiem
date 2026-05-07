export enum ComponentTypes {
  Identity = 'identity',
  Position = 'position',
  Health = 'health', // HP Pool
  Stun = 'stun',     // Stun Pool
  Mana = 'mana',     // Mana Pool
  Ap = 'ap',         // Action Point Pool
  Attributes = 'attributes', // Core Attributes (Body, Agility, etc.)
  Skills = 'skills',         // Combat Masteries
  CombatStatus = 'combat_status',
  Ai = 'ai',
}

export interface IdentityComponent {
  name: string;
  slug: string;
  description?: string;
}

export interface PositionComponent {
  roomId: string;
}

export interface PoolComponent {
  current: number;
  max: number;
  lastRegenAt: number;
}

// Re-using PoolComponent for Health, Stun, Mana, Ap
export type HealthComponent = PoolComponent;
export type StunComponent = PoolComponent;
export type ManaComponent = PoolComponent;

export interface ApComponent extends PoolComponent {
  recoveryTicks: number; // Ticks remaining until AP refresh
}

export interface AttributesComponent {
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
}

export interface SkillsComponent {
  masteryCQC: number;
  masteryPistol: number;
  masteryRifle: number;
  masteryAutomatic: number;
  armorValue: number;
}

export interface CombatStatusComponent {
  state: 'idle' | 'engaged' | 'recovering' | 'guarding';
  isPetActive: boolean;
}

export interface AiComponent {
  state: 'idle' | 'hostile' | 'patrol';
  targetEntityId?: string;
  patrolRoute?: string[];
}
