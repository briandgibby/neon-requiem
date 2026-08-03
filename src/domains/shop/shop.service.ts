import { ShopRepository } from './shop.repository';
import { WorldRepository } from '../world/world.repository';
import { ShopItemRecord, BuyItemResult, BuyItemInput } from './shop.types';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { z } from 'zod';

const buyItemInputSchema = z.object({
  characterId: z.string().min(1),
  accountId: z.string().min(1),
  roomId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepository,
    private readonly worldRepo: WorldRepository,
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
    const parsed = buyItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Quantity must be an integer between 1 and 99');
    }
    return this.shopRepo.purchase(parsed.data);
  }
}
