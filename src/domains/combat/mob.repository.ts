import { PrismaClient } from '@prisma/client';
import { MobTemplateRecord } from './combat.types';

export class MobRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<MobTemplateRecord | null> {
    return this.db.mobTemplate.findUnique({
      where: { id },
    }) as unknown as MobTemplateRecord | null;
  }

  async findBySlug(slug: string): Promise<MobTemplateRecord | null> {
    return this.db.mobTemplate.findUnique({
      where: { slug },
    }) as unknown as MobTemplateRecord | null;
  }

  async findEliteByCorporation(corporationId: string): Promise<MobTemplateRecord | null> {
    return this.db.mobTemplate.findFirst({
      where: {
        eliteOnly: true,
        corporationId,
      },
    }) as unknown as MobTemplateRecord | null;
  }

  async listAll(): Promise<MobTemplateRecord[]> {
    return this.db.mobTemplate.findMany() as unknown as MobTemplateRecord[];
  }
}
