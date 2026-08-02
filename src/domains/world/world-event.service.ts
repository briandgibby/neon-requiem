import { NotFoundError, ValidationError } from '../../shared/errors';

interface WorldEventRoom {
  id: string;
  isSafeZone: boolean;
  missionInstanceId: string | null;
}

interface WorldEventRoomStore {
  findRoomsByIds(roomIds: string[]): Promise<WorldEventRoom[]>;
  setSafeZoneOverride(roomIds: string[], active: boolean): Promise<number>;
}

export interface SafeZoneOverrideResult {
  roomIds: string[];
  active: boolean;
  changedRoomCount: number;
}

export class WorldEventService {
  constructor(private readonly rooms: WorldEventRoomStore) {}

  startSafeZoneOverride(roomIds: string[]): Promise<SafeZoneOverrideResult> {
    return this.setSafeZoneOverride(roomIds, true);
  }

  endSafeZoneOverride(roomIds: string[]): Promise<SafeZoneOverrideResult> {
    return this.setSafeZoneOverride(roomIds, false);
  }

  private async setSafeZoneOverride(roomIds: string[], active: boolean): Promise<SafeZoneOverrideResult> {
    const uniqueRoomIds = [...new Set(roomIds)];
    if (uniqueRoomIds.length === 0) {
      throw new ValidationError('A world event must target at least one room');
    }

    const rooms = await this.rooms.findRoomsByIds(uniqueRoomIds);
    const foundRoomIds = new Set(rooms.map((room) => room.id));
    if (uniqueRoomIds.some((roomId) => !foundRoomIds.has(roomId))) {
      throw new NotFoundError('Room');
    }
    if (rooms.some((room) => !room.isSafeZone)) {
      throw new ValidationError('World event overrides can only target configured safe zones');
    }
    if (rooms.some((room) => room.missionInstanceId !== null)) {
      throw new ValidationError('World event overrides cannot target MissionInstance rooms');
    }

    const changedRoomCount = await this.rooms.setSafeZoneOverride(uniqueRoomIds, active);
    return { roomIds: uniqueRoomIds, active, changedRoomCount };
  }
}
