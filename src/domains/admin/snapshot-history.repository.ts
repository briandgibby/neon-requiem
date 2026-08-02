import { PrismaClient } from '@prisma/client';

export interface SnapshotHistoryQuery {
  characterId?: string;
  limit: number;
}

export class SnapshotHistoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async isAccountAdmin(accountId: string): Promise<boolean> {
    const account = await this.db.account.findUnique({
      where: { id: accountId },
      select: { isAdmin: true },
    });
    return account?.isAdmin === true;
  }

  findSnapshots(query: SnapshotHistoryQuery) {
    return this.db.auditLog.findMany({
      where: {
        category: 'PLAYER_SNAPSHOT',
        ...(query.characterId ? { characterId: query.characterId } : {}),
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        timestamp: true,
        characterId: true,
        character: { select: { name: true } },
        metadata: true,
      },
    });
  }
}
