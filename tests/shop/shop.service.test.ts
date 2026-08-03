import { ShopService } from '../../src/domains/shop/shop.service';

describe('ShopService', () => {
  it('returns the committed purchase and post-purchase Nuyen balance', async () => {
    const shopRepo = {
      purchase: jest.fn().mockResolvedValue({
        success: true,
        message: 'Successfully purchased 1x Trauma Patch',
        item: { id: 'item-1', name: 'Trauma Patch' },
        nuyenRemaining: 750,
      }),
    };
    const service = new ShopService(shopRepo as any, {} as any);

    await expect(service.buyItem({
      characterId: 'char-1',
      accountId: 'account-1',
      roomId: 'shop-room',
      itemId: 'item-1',
      quantity: 1,
    })).resolves.toMatchObject({
      item: { id: 'item-1', name: 'Trauma Patch' },
      nuyenRemaining: 750,
    });
  });
});
