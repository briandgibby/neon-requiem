import { ShopRepository } from './shop.repository';
import { WorldRepository } from '../world/world.repository';
import { CharacterRepository } from '../character/character.repository';
import { ShopItemRecord, BuyItemResult, BuyItemInput } from './shop.types';
import { NotFoundError, ValidationError } from '../../shared/errors';

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepository,
    private readonly worldRepo: WorldRepository,
    private readonly charRepo: CharacterRepository
  ) {}

  async getShopInventory(roomId: string): Promise<ShopItemRecord[]> {
    const room = await this.worldRepo.findRoomById(roomId);
    if (!room) throw new NotFoundError('Room');
    if (room.poiCategory !== 'SHOP') {
      throw new ValidationError('This location is not a shop');
    }

    return this.shopRepo.findItemsByRoom(roomId);
  }

  async buyItem(input: BuyItemInput): Promise<BuyItemResult> {
    const { characterId, accountId, roomId, itemId, quantity } = input;

    // 1. Validate Character & Location
    const character = await this.charRepo.findByIdAndAccount(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    if (character.currentRoomId !== roomId) {
      throw new ValidationError('You must be at the shop to buy items');
    }

    const room = await this.worldRepo.findRoomById(roomId);
    if (!room || room.poiCategory !== 'SHOP') {
      throw new ValidationError('This location is not a shop');
    }

    // 2. Validate Item in Shop
    const shopItem = await this.shopRepo.findShopItem(roomId, itemId);
    if (!shopItem) {
      throw new ValidationError('Item not available in this shop');
    }

    if (shopItem.stock !== -1 && shopItem.stock < quantity) {
      throw new ValidationError('Not enough stock available');
    }

    // 3. Validate Funds & Inventory Space
    const totalCost = shopItem.price * quantity;
    if (character.nuyen < totalCost) {
      throw new ValidationError(`Not enough Nuyen. Required: ${totalCost}, Available: ${character.nuyen}`);
    }

    // Check inventory space (simplified: each unique item type takes a slot if not stackable, 
    // but here we just check total slots vs count)
    const currentInventory = await this.charRepo.findByIdWithInventory(characterId);
    const usedSlots = currentInventory.inventory.reduce((acc: number, item: any) => acc + item.item.slots, 0);
    const itemSlotsNeeded = shopItem.item.slots * quantity;

    if (usedSlots + itemSlotsNeeded > character.maxInventorySlots) {
      throw new ValidationError('Not enough inventory space');
    }

    // 4. Execute Transaction
    const nuyenRemaining = await this.shopRepo.deductNuyen(characterId, totalCost);
    await this.shopRepo.addInventoryItem(characterId, itemId, quantity);
    
    if (shopItem.stock !== -1) {
      await this.shopRepo.updateStock(shopItem.id, -quantity);
    }

    await this.shopRepo.logTransaction(characterId, `Purchased ${quantity}x ${shopItem.item.name} for ${totalCost} Nuyen`, {
      itemId,
      quantity,
      cost: totalCost,
      roomId
    });

    return {
      success: true,
      message: `Successfully purchased ${quantity}x ${shopItem.item.name}`,
      item: shopItem.item,
      nuyenRemaining
    };
  }
}
