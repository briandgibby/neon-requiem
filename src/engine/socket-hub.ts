import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { AuthService } from '../domains/auth/auth.service';
import { UnauthorizedError } from '../shared/errors';

export interface ConnectedClient {
  socket: Socket;
  accountId: string;
  username: string;
}

export class SocketHub {
  private readonly io: SocketServer;
  private readonly clients = new Map<string, ConnectedClient>();

  constructor(httpServer: HttpServer, private readonly authService: AuthService) {
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
      });
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
