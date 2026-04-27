import { Character, Item, InventoryItem } from '@prisma/client';

export interface MedicalHealResult {
  success: boolean;
  message: string;
  hpRestored: number;
  stunRestored: number;
  resourceSpent: string; // 'MANA', 'SUPPLIES', or 'REAGENTS'
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
