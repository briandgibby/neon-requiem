import { PrismaClient } from '@prisma/client';
import { RoomRecord, ZoneRecord } from './world.types';

export class WorldRepository {
  private roomsCache: RoomRecord[] | null = null;
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(private readonly db: PrismaClient) {}

  async getAllRooms(): Promise<RoomRecord[]> {
    const now = Date.now();
    if (this.roomsCache && (now - this.lastCacheUpdate < this.CACHE_TTL)) {
      return this.roomsCache;
    }

    const rooms = await this.db.room.findMany() as unknown as RoomRecord[];
    this.roomsCache = rooms;
    this.lastCacheUpdate = now;
    return rooms;
  }

  async findRoomBySlug(slug: string): Promise<RoomRecord | null> {
    return this.db.room.findUnique({
      where: { slug },
    }) as unknown as RoomRecord | null;
  }

  async findRoomById(id: string): Promise<RoomRecord | null> {
    return this.db.room.findUnique({
      where: { id },
    }) as unknown as RoomRecord | null;
  }

  async findZoneBySlug(slug: string): Promise<ZoneRecord | null> {
    return this.db.zone.findUnique({
      where: { slug },
    }) as unknown as ZoneRecord | null;
  }

  async findZoneById(id: string): Promise<ZoneRecord | null> {
    return this.db.zone.findUnique({
      where: { id },
    }) as unknown as ZoneRecord | null;
  }

  async updateRoom(id: string, data: Partial<RoomRecord>): Promise<RoomRecord> {
    return this.db.room.update({
      where: { id },
      data,
    }) as unknown as RoomRecord;
  }

  async updateCharacterLocation(characterId: string, roomId: string): Promise<void> {
    await this.db.character.update({
      where: { id: characterId },
      data: { currentRoomId: roomId },
    });
  }
}
