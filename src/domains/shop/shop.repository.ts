import { PrismaClient } from '@prisma/client';
import { ShopItemRecord } from './shop.types';

export class ShopRepository {
  constructor(private readonly db: PrismaClient) {}

  async findItemsByRoom(roomId: string): Promise<ShopItemRecord[]> {
    return this.db.shopItem.findMany({
      where: { roomId },
      include: { item: true }
    }) as unknown as ShopItemRecord[];
  }

  async findShopItem(roomId: string, itemId: string): Promise<ShopItemRecord | null> {
    return this.db.shopItem.findUnique({
      where: { roomId_itemId: { roomId, itemId } },
      include: { item: true }
    }) as unknown as ShopItemRecord | null;
  }

  async updateStock(shopItemId: string, delta: number): Promise<void> {
    const shopItem = await this.db.shopItem.findUnique({ where: { id: shopItemId } });
    if (!shopItem || shopItem.stock === -1) return;

    await this.db.shopItem.update({
      where: { id: shopItemId },
      data: { stock: shopItem.stock + delta }
    });
  }

  async addInventoryItem(characterId: string, itemId: string, quantity: number): Promise<void> {
    const existing = await this.db.inventoryItem.findFirst({
      where: { characterId, itemId, isEquipped: false }
    });

    if (existing) {
      await this.db.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      });
    } else {
      await this.db.inventoryItem.create({
        data: {
          characterId,
          itemId,
          quantity,
          isEquipped: false
        }
      });
    }
  }

  async deductNuyen(characterId: string, amount: number): Promise<number> {
    const char = await this.db.character.update({
      where: { id: characterId },
      data: { nuyen: { decrement: amount } }
    });
    return char.nuyen;
  }

  async logTransaction(characterId: string, message: string, metadata: any): Promise<void> {
    await this.db.auditLog.create({
      data: {
        characterId,
        category: 'TRANSACTION',
        severity: 'INFO',
        message,
        metadata
      }
    });
  }
}
