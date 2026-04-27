import { MagicRepository } from './magic.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { CastResult, AuraResult, SalvageResult, CharacterWithMagic } from './magic.types';

export class MagicService {
  constructor(private readonly magicRepo: MagicRepository) {}

  async castSpell(characterId: string, spellSlug: string, targetId?: string): Promise<CastResult> {
    const character = await this.magicRepo.getCharacterWithMagic(characterId);
    if (!character) throw new NotFoundError('Character');

    const spell = await this.magicRepo.findSpellBySlug(spellSlug);
    if (!spell) throw new NotFoundError('Spell');

    // 1. Mana & Overcasting Logic
    let manaToDeduct = spell.manaCost;
    let reagentsToConsume = 0;
    let drainTaken = 0;

    let availableMana = character.currentMana;
    let deficit = 0;

    if (availableMana >= manaToDeduct) {
      availableMana -= manaToDeduct;
    } else {
      deficit = manaToDeduct - availableMana;
      availableMana = 0;

      // Check for reagents in inventory
      const reagentEntry = character.inventory.find(i => i.item.slug === 'reagents');
      const reagentsAvailable = reagentEntry?.quantity || 0;

      if (reagentsAvailable >= deficit) {
        reagentsToConsume = deficit;
        await this.magicRepo.updateInventoryItem(reagentEntry!.id, reagentsAvailable - deficit);
      } else {
        // Use all available reagents
        reagentsToConsume = reagentsAvailable;
        if (reagentEntry) await this.magicRepo.updateInventoryItem(reagentEntry.id, 0);
        
        // Remaining deficit becomes Drain (HP Damage)
        drainTaken = deficit - reagentsToConsume;
      }
    }

    // 2. Apply Costs
    const newHp = Math.max(0, character.currentHp - drainTaken);
    await this.magicRepo.updateCharacterMagicState(characterId, {
      currentMana: availableMana,
      currentHp: newHp
    });

    // 3. Roll for Success (Traditional 1d20 + Magic vs Difficulty/Resist)
    // For now, we'll assume a success and return a placeholder value
    const success = true;
    const effectValue = character.magic ? character.magic + Math.floor(Math.random() * 20) + 1 : 0;

    let message = `You cast ${spell.name}. `;
    if (reagentsToConsume > 0) message += `Consumed ${reagentsToConsume} reagents to buffer the cost. `;
    if (drainTaken > 0) message += `Neural strain causes ${drainTaken} physical damage! `;
    if (newHp <= 0) message += `THE VOID CONSUMES YOU. `;

    return {
      success,
      message,
      manaSpent: spell.manaCost - deficit,
      reagentsConsumed: reagentsToConsume,
      drainTaken,
      effectValue,
      isDead: newHp <= 0
    };
  }

  async activateAura(characterId: string, auraSlug: string | null): Promise<AuraResult> {
    const character = await this.magicRepo.getCharacterWithMagic(characterId);
    if (!character) throw new NotFoundError('Character');

    if (auraSlug === null) {
      await this.magicRepo.updateCharacterMagicState(characterId, { activeAuraId: null });
      return { success: true, message: 'Aura deactivated.', activeAuraId: null };
    }

    const power = await this.magicRepo.findAdeptPowerBySlug(auraSlug);
    if (!power || power.type !== 'AURA') throw new ValidationError('Invalid Aura power');

    await this.magicRepo.updateCharacterMagicState(characterId, { activeAuraId: power.id });

    return {
      success: true,
      message: `Aura established: ${power.name}.`,
      activeAuraId: power.id
    };
  }

  async salvageItem(characterId: string, inventoryItemId: string): Promise<SalvageResult> {
    const character = await this.magicRepo.getCharacterWithMagic(characterId);
    if (!character) throw new NotFoundError('Character');

    const invItem = character.inventory.find(i => i.id === inventoryItemId);
    if (!invItem) throw new NotFoundError('Inventory item');

    // Salvage logic: Rarity based yield
    // Common: 1-2, Uncommon: 3-5, Rare: 10-15, Legendary: 25+
    let yieldAmount = 1;
    const rarity = (invItem.item.rarity || 'common').toLowerCase();
    
    if (rarity === 'common') yieldAmount = Math.floor(Math.random() * 2) + 1;
    else if (rarity === 'uncommon') yieldAmount = Math.floor(Math.random() * 3) + 3;
    else if (rarity === 'rare') yieldAmount = Math.floor(Math.random() * 6) + 10;
    else yieldAmount = 25;

    yieldAmount *= invItem.quantity;

    await this.magicRepo.updateInventoryItem(inventoryItemId, 0); // Delete item
    await this.magicRepo.addReagents(characterId, yieldAmount);

    return {
      success: true,
      message: `Salvaged ${invItem.item.name} for ${yieldAmount} reagents.`,
      reagentsGained: yieldAmount
    };
  }
}
