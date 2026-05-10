import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { AuthService } from '../domains/auth/auth.service';
import { UnauthorizedError } from '../shared/errors';
import { PresenceClient, RoomOccupant } from './room-presence';
import { PresenceService } from './presence.service';
import { PlayerSyncCoordinator } from './player-sync-coordinator';

export interface ConnectedClient {
  socket: Socket;
  accountId: string;
  username: string;
}

export interface SelectedCharacterInput {
  characterId: string;
  characterName: string;
  roomId: string;
}

export class SocketHub {
  private readonly io: SocketServer;
  private readonly clients = new Map<string, ConnectedClient>();

  constructor(
    httpServer: HttpServer,
    private readonly authService: AuthService,
    private readonly presence: PresenceService,
    private readonly syncCoordinator: PlayerSyncCoordinator
  ) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: '*' },
    });

    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new UnauthorizedError('No token provided'));
      try {
        const payload = this.authService.verifyToken(token);
        socket.data.accountId = payload.accountId;
        socket.data.username = payload.username;
        next();
      } catch {
        next(new UnauthorizedError('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      const client: ConnectedClient = {
        socket,
        accountId: socket.data.accountId as string,
        username: socket.data.username as string,
      };

      // Evict any existing session for this account before registering new one
      const existing = this.clients.get(client.accountId);
      if (existing) existing.socket.disconnect(true);

      this.clients.set(client.accountId, client);

      socket.on('disconnect', () => {
        // Only delete if this socket is still the registered client
        if (this.clients.get(client.accountId)?.socket === socket) {
          this.clients.delete(client.accountId);
        }

        const characterId = socket.data.characterId as string | undefined;
        void (async () => {
          try {
            if (characterId) {
              await this.syncCoordinator.handlePlayerDisconnect(characterId);
            }
          } catch (err) {
            console.error('[SocketHub] Failed to persist player disconnect snapshot:', err);
          } finally {
            this.presence.removeSocket(socket.id);
          }
        })();
      });
    });

    // Wire up presence events
    this.presence.on('character_joined', (client: PresenceClient) => {
      const socket = this.io.sockets.sockets.get(client.socketId);
      if (socket) {
        void socket.join(client.roomId);
        socket.to(client.roomId).emit('player_entered', {
          characterId: client.characterId,
          name: client.characterName,
        });
        this.emitRoomOccupants(client.roomId);
      }
    });

    this.presence.on('character_moved', (move) => {
      const socket = this.io.sockets.sockets.get(move.socketId);
      if (socket) {
        void socket.leave(move.previousRoomId);
        socket.to(move.previousRoomId).emit('player_left', {
          characterId: move.characterId,
          name: move.characterName,
        });
        this.emitRoomOccupants(move.previousRoomId);

        void socket.join(move.nextRoomId);
        socket.to(move.nextRoomId).emit('player_entered', {
          characterId: move.characterId,
          name: move.characterName,
        });
        this.emitRoomOccupants(move.nextRoomId);
      }
    });

    this.presence.on('character_left', (leave) => {
      const socket = this.io.sockets.sockets.get(leave.socketId);
      // Socket might already be disconnected, but we still emit to the room
      this.io.to(leave.previousRoomId).emit('player_left', {
        characterId: leave.characterId,
        name: leave.characterName,
      });
      this.emitRoomOccupants(leave.previousRoomId);
    });
  }

  onConnection(handler: (socket: Socket) => void | Promise<void>): void {
    this.io.on('connection', handler);
  }

  broadcast(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  sendTo(accountId: string, event: string, data: unknown): void {
    this.clients.get(accountId)?.socket.emit(event, data);
  }

  selectCharacter(socket: Socket, input: SelectedCharacterInput): void {
    const accountId = socket.data.accountId as string;
    const username = socket.data.username as string;

    this.presence.setCharacter({
      socketId: socket.id,
      accountId,
      username,
      characterId: input.characterId,
      characterName: input.characterName,
      roomId: input.roomId,
    });
  }

  moveSelectedCharacter(socket: Socket, nextRoomId: string): void {
    this.presence.moveCharacter(socket.id, nextRoomId);
  }

  getRoomOccupants(roomId: string): RoomOccupant[] {
    return this.presence.getRoomOccupants(roomId);
  }

  getSelectedClient(socket: Socket): PresenceClient | null {
    return this.presence.getClient(socket.id);
  }

  emitToRoom(roomId: string, event: string, data: unknown): void {
    this.io.to(roomId).emit(event, data);
  }

  emitToRoomExcept(socket: Socket, roomId: string, event: string, data: unknown): void {
    socket.to(roomId).emit(event, data);
  }

  sendToSocket(socketId: string, event: string, data: unknown): void {
    this.io.to(socketId).emit(event, data);
  }

  findSocketForCharacter(characterName: string): string | null {
    return this.presence.getSocketForCharacter(characterName);
  }

  private emitRoomOccupants(roomId: string): void {
    this.io.to(roomId).emit('room_occupants', this.presence.getRoomOccupants(roomId));
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.io.close(() => resolve());
    });
    this.clients.clear();
  }

  get connectedCount(): number {
    return this.clients.size;
  }
}
