import { EventEmitter } from 'events';

export interface RoomOccupant {
  characterId: string;
  name: string;
}

export interface PresenceLeaveResult {
  characterId: string;
  characterName: string;
  previousRoomId: string;
  socketId: string;
}

export interface PresenceMoveResult extends PresenceLeaveResult {
  nextRoomId: string;
}

export interface PresenceClient {
  socketId: string;
  accountId: string;
  username: string;
  characterId: string;
  characterName: string;
  roomId: string;
}

export class RoomPresence extends EventEmitter {
  private readonly clientsBySocket = new Map<string, PresenceClient>();
  private readonly socketIdByAccount = new Map<string, string>();
  private readonly socketIdByCharacter = new Map<string, string>();

  constructor() {
    super();
  }

  setCharacter(client: PresenceClient): void {
    const replaced = this.removeAccount(client.accountId);

    this.clientsBySocket.set(client.socketId, { ...client });
    this.socketIdByAccount.set(client.accountId, client.socketId);
    this.socketIdByCharacter.set(client.characterId, client.socketId);

    if (replaced) this.emit('character_left', replaced);
    this.emit('character_joined', client);
  }

  moveCharacter(socketId: string, nextRoomId: string): PresenceMoveResult | null {
    const client = this.clientsBySocket.get(socketId);
    if (!client) return null;

    const previousRoomId = client.roomId;
    client.roomId = nextRoomId;

    const move: PresenceMoveResult = {
      characterId: client.characterId,
      characterName: client.characterName,
      previousRoomId,
      nextRoomId,
      socketId,
    };
    this.emit('character_moved', move);
    return move;
  }

  moveCharacterById(characterId: string, nextRoomId: string): PresenceMoveResult | null {
    const socketId = this.socketIdByCharacter.get(characterId);
    if (!socketId) return null;
    return this.moveCharacter(socketId, nextRoomId);
  }

  removeSocket(socketId: string): PresenceLeaveResult | null {
    const client = this.clientsBySocket.get(socketId);
    if (!client) return null;

    this.clientsBySocket.delete(socketId);
    if (this.socketIdByAccount.get(client.accountId) === socketId) {
      this.socketIdByAccount.delete(client.accountId);
    }
    if (this.socketIdByCharacter.get(client.characterId) === socketId) {
      this.socketIdByCharacter.delete(client.characterId);
    }

    const leave: PresenceLeaveResult = {
      characterId: client.characterId,
      characterName: client.characterName,
      previousRoomId: client.roomId,
      socketId,
    };
    this.emit('character_left', leave);
    return leave;
  }

  getSocketForCharacter(characterName: string): string | null {
    const normalized = characterName.toLowerCase();
    for (const client of this.clientsBySocket.values()) {
      if (client.characterName.toLowerCase() === normalized) {
        return client.socketId;
      }
    }
    return null;
  }

  getClient(socketId: string): PresenceClient | null {
    return this.clientsBySocket.get(socketId) ?? null;
  }

  getRoomOccupants(roomId: string): RoomOccupant[] {
    return [...this.clientsBySocket.values()]
      .filter((client) => client.roomId === roomId)
      .sort((a, b) => a.characterName.localeCompare(b.characterName))
      .map((client) => ({
        characterId: client.characterId,
        name: client.characterName,
      }));
  }

  private removeAccount(accountId: string): PresenceLeaveResult | null {
    const existingSocketId = this.socketIdByAccount.get(accountId);
    if (!existingSocketId) return null;
    return this.removeSocket(existingSocketId);
  }
}
