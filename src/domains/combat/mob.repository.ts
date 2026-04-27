import { PrismaClient } from '@prisma/client';

export interface MobTemplateRecord {
  id: string;
  slug: string;
  name: string;
  level: number;
  body: number;
  agility: number;
  dexterity: number;
  strength: number;
  logic: number;
  intuition: number;
  willpower: number;
  charisma: number;
  maxHp: number;
  maxAp: number;
  armorValue: number;
  masteryCQC: number;
  masteryPistol: number;
  masteryRifle: number;
  masteryAutomatic: number;
}

export class MobRepository {
  constructor(private readonly db: PrismaClient) {}

  async findBySlug(slug: string): Promise<MobTemplateRecord | null> {
    return this.db.mobTemplate.findUnique({
      where: { slug },
    }) as unknown as MobTemplateRecord | null;
  }

  async listAll(): Promise<MobTemplateRecord[]> {
    return this.db.mobTemplate.findMany() as unknown as MobTemplateRecord[];
  }
}
