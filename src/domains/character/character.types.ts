import { Faction, Race, ClassName, MentorSpirit, StreetDocPath } from '../../shared/types';

export interface CreateCharacterInput {
  accountId: string;
  name: string;
  faction: Faction;
  race: Race;
  className: ClassName;
  streetDocPath?: StreetDocPath;
  nuyen?: number;
  body: number;
  agility: number;
  dexterity: number;
  strength: number;
  logic: number;
  intuition: number;
  willpower: number;
  charisma: number;
  luck: number;
  mentorSpirit?: MentorSpirit;
}

export interface CharacterRecord {
  id: string;
  accountId: string;
  name: string;
  faction: string;
  race: string;
  className: string;
  streetDocPath: string | null;
  level: number;
  experiencePoints: number;
  nuyen: number;
  body: number;
  agility: number;
  dexterity: number;
  strength: number;
  logic: number;
  intuition: number;
  willpower: number;
  charisma: number;
  biosync: number;
  luck: number;
  luckPool: number;
  
  magic: number | null;
  resonance: number | null;
  
  resAttack: number | null;
  resSleaze: number | null;
  resDataProc: number | null;
  resFirewall: number | null;

  mentorSpirit: string | null;

  masteryCQC: number;
  masteryEdge: number;
  masteryImpact: number;
  masteryPistol: number;
  masteryRifle: number;
  masteryAutomatic: number;
  masteryRigging: number;
  masterySummoning: number;

  currentHp: number;
  maxHp: number;
  currentStun: number;
  maxStun: number;
  currentMana: number;
  maxMana: number;
  manaRegenRate: number;
  manaRegenBuff: number;
  armorValue: number;
  biofeedbackBuffer: number;
  deathSicknessUntil: Date | null;
  maxInventorySlots: number;

  hasValidSIN: boolean;
  disguiseIdentity: string | null;
  reputationCorp: number;
  reputationShadow: number;
  areaKnowledge: string[];

  isJackedIn: boolean;
  activeNodeId: string | null;
  equippedDeckId: string | null;
  activeAuraId: string | null;

  currentRoomId: string | null;
  isCreationComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}
