import { ShopRepository } from '../../src/domains/shop/shop.repository';

describe('ShopRepository.purchase', () => {
  it('charges, stocks inventory, and audits in one serializable transaction', async () => {
    const item = {
      id: 'item-1',
      slug: 'trauma-patch',
      name: 'Trauma Patch',
      description: 'Emergency medicine.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1,
      equipSlot: null,
      stats: null,
    };
    const tx = {
      character: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'char-1',
          accountId: 'account-1',
          currentRoomId: 'shop-room',
          nuyen: 1000,
          maxInventorySlots: 10,
          inventory: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ nuyen: 750 }),
      },
      room: { findUnique: jest.fn().mockResolvedValue({ poiCategory: 'SHOP' }) },
      shopItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'shop-item-1',
          roomId: 'shop-room',
          itemId: 'item-1',
          price: 250,
          stock: 1,
          item,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const repo = new ShopRepository(db as any);

    await expect(repo.purchase({
      characterId: 'char-1',
      accountId: 'account-1',
      roomId: 'shop-room',
      itemId: 'item-1',
      quantity: 1,
    })).resolves.toMatchObject({
      item,
      nuyenRemaining: 750,
    });

    expect(tx.shopItem.updateMany).toHaveBeenCalled();
    expect(tx.character.updateMany).toHaveBeenCalled();
    expect(tx.inventoryItem.create).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('counts every unit already carried when checking inventory capacity', async () => {
    const item = {
      id: 'item-1',
      slug: 'trauma-kit',
      name: 'Trauma Kit',
      description: 'Emergency medicine.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 3,
      equipSlot: null,
      stats: null,
    };
    const tx = {
      character: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'char-1',
          accountId: 'account-1',
          currentRoomId: 'shop-room',
          nuyen: 1000,
          maxInventorySlots: 6,
          inventory: [{ quantity: 2, item }],
        }),
        updateMany: jest.fn(),
      },
      room: { findUnique: jest.fn().mockResolvedValue({ poiCategory: 'SHOP' }) },
      shopItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'shop-item-1',
          roomId: 'shop-room',
          itemId: 'item-1',
          price: 250,
          stock: -1,
          item,
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const repo = new ShopRepository(db as any);

    await expect(repo.purchase({
      characterId: 'char-1',
      accountId: 'account-1',
      roomId: 'shop-room',
      itemId: 'item-1',
      quantity: 1,
    })).rejects.toThrow('Not enough inventory space');
    expect(tx.character.updateMany).not.toHaveBeenCalled();
  });
});
