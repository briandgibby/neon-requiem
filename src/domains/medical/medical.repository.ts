import { PrismaClient } from '@prisma/client';
import { CharacterWithInventory } from './medical.types';

export class MedicalRepository {
  constructor(private readonly db: PrismaClient) {}

  async findCharacterById(id: string): Promise<CharacterWithInventory | null> {
    return this.db.character.findUnique({
      where: { id },
      include: {
        inventory: {
          include: { item: true }
        }
      }
    }) as Promise<CharacterWithInventory | null>;
  }

  async updateCharacterVitals(
    id: string, 
    data: { 
      currentHp?: number; 
      currentStun?: number; 
      currentMana?: number;
      luck?: number;
      deathSicknessUntil?: Date | null;
    }
  ) {
    return this.db.character.update({
      where: { id },
      data
    });
  }

  async consumeInventoryItem(inventoryItemId: string, quantity: number = 1) {
    const item = await this.db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return;

    if (item.quantity <= quantity) {
      return this.db.inventoryItem.delete({ where: { id: inventoryItemId } });
    }

    return this.db.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { quantity: item.quantity - quantity }
    });
  }

  async findNPC(id: string) {
    // NPCs will be in the Character table for now, or a separate NPC table
    return this.db.character.findUnique({ where: { id } });
  }
}
