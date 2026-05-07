import { EventEmitter } from 'events';
import { RoomPresence, PresenceClient, RoomOccupant, PresenceLeaveResult, PresenceMoveResult } from './room-presence';

export class PresenceService extends EventEmitter {
  constructor(private readonly presence: RoomPresence) {
    super();
  }

  setCharacter(client: PresenceClient): void {
    const previous = this.presence.selectCharacter(client);
    if (previous) {
      this.emit('character_left', previous);
    }
    this.emit('character_joined', client);
  }

  moveCharacter(socketId: string, nextRoomId: string): PresenceMoveResult | null {
    const move = this.presence.moveCharacter(socketId, nextRoomId);
    if (move) {
      this.emit('character_moved', move);
    }
    return move;
  }

  moveCharacterById(characterId: string, nextRoomId: string): PresenceMoveResult | null {
    const move = this.presence.moveCharacterById(characterId, nextRoomId);
    if (move) {
      this.emit('character_moved', move);
    }
    return move;
  }

  removeSocket(socketId: string): PresenceLeaveResult | null {
    const leave = this.presence.removeSocket(socketId);
    if (leave) {
      this.emit('character_left', leave);
    }
    return leave;
  }

  getRoomOccupants(roomId: string): RoomOccupant[] {
    return this.presence.getRoomOccupants(roomId);
  }

  getClient(socketId: string): PresenceClient | null {
    return this.presence.getClient(socketId);
  }

  getSocketForCharacter(characterName: string): string | null {
    return this.presence.getSocketForCharacter(characterName);
  }
}
