import { Prisma, PrismaClient } from '@prisma/client';
import { RoomRecord, ZoneRecord } from './world.types';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

export class WorldRepository {
  private roomsCache: RoomRecord[] | null = null;
  private lastCacheUpdate = 0;
  private roomsCacheGeneration = 0;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(private readonly db: PrismaClient) {}

  async getAllRooms(): Promise<RoomRecord[]> {
    const now = Date.now();
    if (this.roomsCache && (now - this.lastCacheUpdate < this.CACHE_TTL)) {
      return this.roomsCache;
    }

    const cacheGeneration = this.roomsCacheGeneration;
    const rooms = await this.db.room.findMany() as unknown as RoomRecord[];
    if (cacheGeneration === this.roomsCacheGeneration) {
      this.roomsCache = rooms;
      this.lastCacheUpdate = now;
    }
    return rooms;
  }

  async findRoomBySlug(slug: string): Promise<RoomRecord | null> {
    return this.db.room.findUnique({
      where: { slug },
      include: { zone: true },
    }) as unknown as RoomRecord | null;
  }

  async findRoomById(id: string): Promise<RoomRecord | null> {
    return this.db.room.findUnique({
      where: { id },
      include: { zone: true },
    }) as unknown as RoomRecord | null;
  }

  async findRoomsByIds(ids: string[]) {
    return this.db.room.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        isSafeZone: true,
        missionInstanceId: true,
      },
    });
  }

  async setSafeZoneOverride(roomIds: string[], active: boolean): Promise<number> {
    const changedRoomCount = await this.db.$transaction(async (tx) => {
      const rooms = await tx.room.findMany({
        where: { id: { in: roomIds } },
        select: {
          id: true,
          isSafeZone: true,
          safeZoneOverrideActive: true,
          missionInstanceId: true,
        },
      });
      if (rooms.length !== roomIds.length) throw new NotFoundError('Room');
      if (rooms.some((room) => !room.isSafeZone)) {
        throw new ValidationError('World event overrides can only target configured safe zones');
      }
      if (rooms.some((room) => room.missionInstanceId !== null)) {
        throw new ValidationError('World event overrides cannot target MissionInstance rooms');
      }

      const expectedChanges = rooms.filter((room) => room.safeZoneOverrideActive !== active).length;
      const result = await tx.room.updateMany({
        where: {
          id: { in: roomIds },
          isSafeZone: true,
          missionInstanceId: null,
          safeZoneOverrideActive: { not: active },
        },
        data: { safeZoneOverrideActive: active },
      });
      if (result.count !== expectedChanges) {
        throw new ConflictError('World event room eligibility changed during the override transition');
      }
      return result.count;
    });
    if (changedRoomCount > 0) {
      this.roomsCache = null;
      this.roomsCacheGeneration += 1;
    }
    return changedRoomCount;
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

  async updateRoom(id: string, data: Prisma.RoomUpdateInput): Promise<RoomRecord> {
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

  async findPOIsByZone(zoneId: string): Promise<RoomRecord[]> {
    return this.db.room.findMany({
      where: { zoneId, isPOI: true },
    }) as unknown as RoomRecord[];
  }
}
