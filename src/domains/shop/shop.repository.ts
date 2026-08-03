import { PrismaClient } from '@prisma/client';
import { BuyItemInput, BuyItemResult, ShopItemRecord } from './shop.types';
import { NotFoundError, ValidationError } from '../../shared/errors';

export class ShopRepository {
  constructor(private readonly db: PrismaClient) {}

  async findItemsByRoom(roomId: string): Promise<ShopItemRecord[]> {
    return this.db.shopItem.findMany({
      where: { roomId },
      include: { item: true }
    }) as unknown as ShopItemRecord[];
  }

  async purchase(input: BuyItemInput): Promise<BuyItemResult> {
    return this.db.$transaction(async (tx) => {
      const character = await tx.character.findFirst({
        where: { id: input.characterId, accountId: input.accountId },
        include: { inventory: { include: { item: true } } },
      });
      if (!character) throw new NotFoundError('Character');
      if (character.currentRoomId !== input.roomId) {
        throw new ValidationError('You must be at the shop to buy items');
      }

      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: { poiCategory: true },
      });
      if (room?.poiCategory !== 'SHOP') throw new ValidationError('This location is not a shop');

      const shopItem = await tx.shopItem.findUnique({
        where: { roomId_itemId: { roomId: input.roomId, itemId: input.itemId } },
        include: { item: true },
      });
      if (!shopItem) throw new ValidationError('Item not available in this shop');
      if (shopItem.stock !== -1 && shopItem.stock < input.quantity) {
        throw new ValidationError('Not enough stock available');
      }

      const totalCost = shopItem.price * input.quantity;
      if (character.nuyen < totalCost) {
        throw new ValidationError(`Not enough Nuyen. Required: ${totalCost}, Available: ${character.nuyen}`);
      }

      const usedSlots = character.inventory.reduce(
        (total, entry) => total + (entry.item.slots * entry.quantity),
        0,
      );
      if (usedSlots + (shopItem.item.slots * input.quantity) > character.maxInventorySlots) {
        throw new ValidationError('Not enough inventory space');
      }

      if (shopItem.stock !== -1) {
        const claimedStock = await tx.shopItem.updateMany({
          where: { id: shopItem.id, stock: { gte: input.quantity } },
          data: { stock: { decrement: input.quantity } },
        });
        if (claimedStock.count !== 1) throw new ValidationError('Not enough stock available');
      }

      const charged = await tx.character.updateMany({
        where: {
          id: input.characterId,
          accountId: input.accountId,
          currentRoomId: input.roomId,
          nuyen: { gte: totalCost },
        },
        data: { nuyen: { decrement: totalCost } },
      });
      if (charged.count !== 1) throw new ValidationError('Purchase state changed; try again');

      const existing = await tx.inventoryItem.findFirst({
        where: { characterId: input.characterId, itemId: input.itemId, isEquipped: false },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: input.quantity } },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            characterId: input.characterId,
            itemId: input.itemId,
            quantity: input.quantity,
            isEquipped: false,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          characterId: input.characterId,
          category: 'TRANSACTION',
          severity: 'INFO',
          message: `Purchased ${input.quantity}x ${shopItem.item.name} for ${totalCost} Nuyen`,
          metadata: {
            itemId: input.itemId,
            quantity: input.quantity,
            cost: totalCost,
            roomId: input.roomId,
          },
        },
      });

      const updatedCharacter = await tx.character.findUniqueOrThrow({
        where: { id: input.characterId },
        select: { nuyen: true },
      });
      return {
        success: true,
        message: `Successfully purchased ${input.quantity}x ${shopItem.item.name}`,
        item: shopItem.item,
        nuyenRemaining: updatedCharacter.nuyen,
      };
    }, { isolationLevel: 'Serializable' });
  }

}
