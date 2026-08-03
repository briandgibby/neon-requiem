import { ShopService } from '../../domains/shop/shop.service';
import { CommandContext, CommandHandler } from '../command-registry';

export class ShopListHandler implements CommandHandler {
  readonly aliases = ['shop'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Shop';
  readonly description = 'List items sold at the current location';

  constructor(private readonly shopService: ShopService) {}

  async execute(context: CommandContext): Promise<void> {
    const inventory = await this.shopService.getShopInventory(context.roomId);
    if (inventory.length === 0) {
      context.message('This shop has no stock.');
      return;
    }
    context.message(inventory
      .map((entry) => (
        entry.item.id + ': ' + entry.item.name + ' — ' + entry.price + '¥'
        + (entry.stock === -1 ? '' : ' (' + entry.stock + ' left)')
      ))
      .join('\n'));
    context.output.emit('shop_items', inventory);
  }
}

export class BuyItemHandler implements CommandHandler {
  readonly aliases = ['buy'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Buy';
  readonly description = 'Buy an item from the current shop';
  readonly usage = '<item> [quantity]';
  readonly argumentSource = 'shop-item' as const;

  constructor(private readonly shopService: ShopService) {}

  async execute(context: CommandContext): Promise<void> {
    const itemId = context.args[0];
    if (!itemId) {
      context.message('Usage: buy <item> [quantity]', 'error');
      return;
    }
    const quantity = context.args[1] === undefined ? 1 : Number(context.args[1]);
    const result = await this.shopService.buyItem({
      characterId: context.characterId,
      accountId: context.accountId,
      roomId: context.roomId,
      itemId,
      quantity,
    });
    context.message(result.message, 'success');
    if (result.nuyenRemaining !== undefined) {
      context.output.emit('character_update', { nuyen: result.nuyenRemaining });
    }
    context.output.emit('shop_items', await this.shopService.getShopInventory(context.roomId));
  }
}
