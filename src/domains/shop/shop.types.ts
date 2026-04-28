import { Item } from '@prisma/client';

export interface ShopItemRecord {
  id: string;
  roomId: string;
  itemId: string;
  price: number;
  stock: number;
  item: Item;
}

export interface BuyItemInput {
  characterId: string;
  accountId: string;
  roomId: string;
  itemId: string;
  quantity: number;
}

export interface BuyItemResult {
  success: boolean;
  message: string;
  item?: Item;
  nuyenRemaining?: number;
}
