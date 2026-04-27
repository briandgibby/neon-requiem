import { Character, Spell, AdeptPower, Item, InventoryItem } from '@prisma/client';

export type SpellType = 'COMBAT' | 'ILLUSION' | 'HEAL' | 'UTILITY';
export type Tradition = 'HERMETIC' | 'SHAMANIC' | 'ANY';

export interface SpellRecord extends Spell {}
export interface AdeptPowerRecord extends AdeptPower {}

export interface CastResult {
  success: boolean;
  message: string;
  manaSpent: number;
  reagentsConsumed: number;
  drainTaken: number;
  effectValue?: number;
  isDead: boolean;
}

export interface AuraResult {
  success: boolean;
  message: string;
  activeAuraId: string | null;
}

export interface SalvageResult {
  success: boolean;
  message: string;
  reagentsGained: number;
}

export interface CharacterWithMagic extends Character {
  inventory: (InventoryItem & { item: Item })[];
  activeAura: AdeptPower | null;
}
