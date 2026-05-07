export interface SelectCharacterPresenceInput {
  socketId: string;
  accountId: string;
  username: string;
  characterId: string;
  characterName: string;
  roomId: string;
}

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

export class RoomPresence {
  private readonly clientsBySocket = new Map<string, PresenceClient>();
  private readonly socketIdByAccount = new Map<string, string>();
  private readonly socketIdByCharacter = new Map<string, string>();

  selectCharacter(input: SelectCharacterPresenceInput): PresenceLeaveResult | null {
    const replaced = this.removeAccount(input.accountId);

    this.clientsBySocket.set(input.socketId, { ...input });
    this.socketIdByAccount.set(input.accountId, input.socketId);
    this.socketIdByCharacter.set(input.characterId, input.socketId);

    return replaced;
  }

  moveCharacter(socketId: string, nextRoomId: string): PresenceMoveResult | null {
    const client = this.clientsBySocket.get(socketId);
    if (!client) return null;

    const previousRoomId = client.roomId;
    client.roomId = nextRoomId;

    return {
      characterId: client.characterId,
      characterName: client.characterName,
      previousRoomId,
      nextRoomId,
      socketId,
    };
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

    return {
      characterId: client.characterId,
      characterName: client.characterName,
      previousRoomId: client.roomId,
      socketId,
    };
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
