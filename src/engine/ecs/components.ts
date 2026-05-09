import { EntityId } from './registry';

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
  CombatSession = 'combat_session',
  MobTemplate = 'mob_template',
  PlayerId = 'player_id',
  NpcId = 'npc_id',
  Ai = 'ai',
  MatrixNode = 'matrix_node',
  Ice = 'ice',
  Decker = 'decker',
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
  sessionId?: EntityId;
}

export interface CombatSessionComponent {
  roomId: string;
  securityRating: string;
  alarmState: 'GREEN' | 'YELLOW' | 'RED';
  turnsUntilReinforcements: number | null;
  backupCalled: boolean;
  tick: number;
}

export interface MobTemplateComponent {
  templateSlug: string;
}

export interface PlayerIdComponent {
  characterId: string;
  accountId: string;
}

export interface NpcIdComponent {
  mobId: string;
}

export interface AiComponent {
  state: 'idle' | 'hostile' | 'patrol';
  targetEntityId?: string;
  patrolRoute?: string[];
}

export interface MatrixNodeComponent {
  nodeId: string;
  securityLevel: number;
  alertLevel: 'GREEN' | 'YELLOW' | 'RED';
  linkedRoomId: string | null;
}

export interface IceComponent {
  type: 'WHITE' | 'GRAY' | 'BLACK';
  attack: number;
  defense: number;
}

export interface DeckerComponent {
  activeNodeEntityId: string;
  attack: number;
  sleaze: number;
  firewall: number;
  biofeedbackBuffer: number;
}
