import { PrismaClient } from '@prisma/client';
import { CharacterRecord } from './character.types';

export class CharacterRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: Omit<CharacterRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharacterRecord> {
    return this.db.character.create({ data }) as unknown as CharacterRecord;
  }

  async findById(id: string): Promise<CharacterRecord | null> {
    return this.db.character.findUnique({ where: { id } }) as unknown as CharacterRecord | null;
  }

  async findByIdAndAccount(id: string, accountId: string): Promise<CharacterRecord | null> {
    return this.db.character.findFirst({
      where: { id, accountId },
    }) as unknown as CharacterRecord | null;
  }

  async findByAccountId(accountId: string): Promise<CharacterRecord[]> {
    return this.db.character.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as CharacterRecord[];
  }

  async findByAccountAndName(accountId: string, name: string): Promise<CharacterRecord | null> {
    return this.db.character.findUnique({
      where: { accountId_name: { accountId, name } },
    }) as unknown as CharacterRecord | null;
  }

  async updateCharacter(id: string, data: Partial<CharacterRecord>): Promise<CharacterRecord> {
    return this.db.character.update({
      where: { id },
      data,
    }) as unknown as CharacterRecord;
  }

  async findByIdWithInventory(id: string, accountId?: string): Promise<any> {
    return this.db.character.findFirst({
      where: accountId ? { id, accountId } : { id },
      include: {
        inventory: {
          include: { item: true }
        }
      }
    });
  }

  async getInventoryItem(id: string): Promise<any> {
    return this.db.inventoryItem.findUnique({
      where: { id },
      include: { item: true }
    });
  }

  async updateInventoryItem(id: string, quantityDelta: number): Promise<void> {
    const item = await this.db.inventoryItem.findUnique({ where: { id } });
    if (!item) return;

    const newQuantity = item.quantity + quantityDelta;
    if (newQuantity <= 0) {
      await this.db.inventoryItem.delete({ where: { id } });
    } else {
      await this.db.inventoryItem.update({
        where: { id },
        data: { quantity: newQuantity }
      });
    }
  }
}
