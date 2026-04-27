import { PrismaClient } from '@prisma/client';
import { CharacterWithMagic } from './magic.types';

export class MagicRepository {
  constructor(private readonly db: PrismaClient) {}

  async findSpellBySlug(slug: string) {
    return this.db.spell.findUnique({ where: { slug } });
  }

  async findAdeptPowerBySlug(slug: string) {
    return this.db.adeptPower.findUnique({ where: { slug } });
  }

  async getCharacterWithMagic(characterId: string): Promise<CharacterWithMagic | null> {
    return this.db.character.findUnique({
      where: { id: characterId },
      include: {
        inventory: {
          include: { item: true }
        },
        activeAura: true
      }
    }) as Promise<CharacterWithMagic | null>;
  }

  async updateCharacterMagicState(
    characterId: string, 
    data: { 
      currentMana?: number; 
      currentHp?: number; 
      activeAuraId?: string | null;
      manaRegenBuff?: number;
    }
  ) {
    return this.db.character.update({
      where: { id: characterId },
      data
    });
  }

  async updateInventoryItem(id: string, quantity: number) {
    if (quantity <= 0) {
      return this.db.inventoryItem.delete({ where: { id } });
    }
    return this.db.inventoryItem.update({
      where: { id },
      data: { quantity }
    });
  }

  async addReagents(characterId: string, amount: number) {
    const reagentItem = await this.db.item.findFirst({
      where: { slug: 'reagents' }
    });

    if (!reagentItem) return null;

    const existing = await this.db.inventoryItem.findFirst({
      where: { characterId, itemId: reagentItem.id }
    });

    if (existing) {
      return this.db.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + amount }
      });
    }

    return this.db.inventoryItem.create({
      data: {
        characterId,
        itemId: reagentItem.id,
        quantity: amount
      }
    });
  }
}
