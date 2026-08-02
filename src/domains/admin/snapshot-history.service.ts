import { z } from 'zod';
import { ForbiddenError } from '../../shared/errors';
import { SnapshotHistoryQuery } from './snapshot-history.repository';

const persistedSnapshotSchema = z.object({
  snapshot: z.object({
    hp: z.number().int(),
    stun: z.number().int(),
    mana: z.number().int(),
    roomId: z.string().min(1),
    timestamp: z.number().int().min(0).max(8_640_000_000_000_000),
  }),
});

const snapshotHistoryQuerySchema = z.object({
  characterId: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface SnapshotHistoryRow {
  id: string;
  timestamp: Date;
  characterId: string | null;
  character: { name: string } | null;
  metadata: unknown;
}

interface SnapshotHistoryStore {
  isAccountAdmin(accountId: string): Promise<boolean>;
  findSnapshots(query: SnapshotHistoryQuery): Promise<SnapshotHistoryRow[]>;
}

export class SnapshotHistoryService {
  constructor(private readonly repository: SnapshotHistoryStore) {}

  async listSnapshots(accountId: string, rawQuery: unknown) {
    if (!await this.repository.isAccountAdmin(accountId)) throw new ForbiddenError();

    const query = snapshotHistoryQuerySchema.parse(rawQuery);
    const rows = await this.repository.findSnapshots(query);
    const snapshots = rows.flatMap((row) => {
      const parsed = persistedSnapshotSchema.safeParse(row.metadata);
      if (!parsed.success || !row.characterId || !row.character) return [];

      const snapshot = parsed.data.snapshot;
      return [{
        id: row.id,
        recordedAt: row.timestamp.toISOString(),
        capturedAt: new Date(snapshot.timestamp).toISOString(),
        character: { id: row.characterId, name: row.character.name },
        state: {
          hp: snapshot.hp,
          stun: snapshot.stun,
          mana: snapshot.mana,
          roomId: snapshot.roomId,
        },
      }];
    });

    return { snapshots };
  }
}
