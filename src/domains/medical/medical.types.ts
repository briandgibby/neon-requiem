import { Character, Item, InventoryItem } from '@prisma/client';

export interface MedicalHealResult {
  success: boolean;
  message: string;
  hpRestored: number;
  stunRestored: number;
  resourceSpent: string;
}

export interface FieldTreatmentInput {
  doctorId: string;
  accountId: string;
  targetEntityId: string;
  roomId: string;
}

export interface TreatmentCommitInput {
  doctorId: string;
  accountId: string;
  targetCharacterId: string;
  roomId: string;
  expectedCurrentHp: number;
  targetNextHp: number;
  hpRestored: number;
  resource:
    | { type: 'mana'; amount: number }
    | { type: 'inventory'; inventoryItemId: string; quantity: number };
}

export interface TreatmentCommitResult {
  targetName: string;
  actorCurrentMana: number;
}

export interface FieldTreatmentResult {
  targetCharacterId: string;
  targetName: string;
  targetCurrentHp: number;
  targetMaxHp: number;
  actorCurrentMana: number;
  resourceSpent: 'MANA' | 'SUPPLIES';
  hpRestored: number;
}

export interface ReviveResult {
  success: boolean;
  message: string;
  hpRestored: number;
  luckSpent: number;
}

export interface InterrogationResult {
  success: boolean;
  message: string;
  yieldedKey?: string; // Information flag or physical item slug
}

export interface CharacterWithInventory extends Character {
  inventory: (InventoryItem & { item: Item })[];
}
