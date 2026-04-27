import 'dotenv/config';
import Fastify from 'fastify';
import { createServer } from 'http';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { TICK_RATE_MS } from './shared/constants';
import { GameLoop } from './engine/game-loop';
import { SocketHub } from './engine/socket-hub';
import { AuthRepository } from './domains/auth/auth.repository';
import { AuthService } from './domains/auth/auth.service';
import { registerAuthRoutes } from './domains/auth/auth.routes';
import { CharacterRepository } from './domains/character/character.repository';
import { CharacterService } from './domains/character/character.service';
import { registerCharacterRoutes } from './domains/character/character.routes';
import { WorldRepository } from './domains/world/world.repository';
import { WorldService } from './domains/world/world.service';
import { registerWorldRoutes } from './domains/world/world.routes';
import { CombatRepository } from './domains/combat/combat.repository';
import { CombatService } from './domains/combat/combat.service';
import { registerCombatRoutes } from './domains/combat/combat.routes';
import { MatrixRepository } from './domains/matrix/matrix.repository';
import { MatrixService } from './domains/matrix/matrix.service';
import { registerMatrixRoutes } from './domains/matrix/matrix.routes';
import { MissionRepository } from './domains/mission/mission.repository';
import { MissionService } from './domains/mission/mission.service';
import { MissionGenerator } from './domains/mission/mission.generator';
import { registerMissionRoutes } from './domains/mission/mission.routes';
import { AuditLogger } from './engine/audit-logger';
import type { AuthPayload } from './shared/types';
import type { JwtSigner } from './domains/auth/auth.types';

async function bootstrap() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  const app = Fastify({ logger: true });
  const httpServer = createServer(app.server);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');

  await app.register(import('@fastify/cors'));

  const jwtSigner: JwtSigner = {
    sign: (payload: AuthPayload): string => {
      return jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
    },
    verify: (token: string): AuthPayload => {
      return jwt.verify(token, jwtSecret) as AuthPayload;
    },
  };

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo, jwtSigner);
  registerAuthRoutes(app, authService);

  const charRepo = new CharacterRepository(db);
  const worldRepo = new WorldRepository(db);
  const charService = new CharacterService(charRepo, worldRepo);
  registerCharacterRoutes(app, charService, authService);

  const worldService = new WorldService(worldRepo, charRepo);
  registerWorldRoutes(app, worldService, authService);

  const combatRepo = new CombatRepository(db);
  const mobRepo = new MobRepository(db);
  const combatService = new CombatService(
    combatRepo, 
    charRepo, 
    worldRepo, 
    mobRepo, 
    magicService, 
    matrixService
  );
  registerCombatRoutes(app, combatService, authService);

  const matrixRepo = new MatrixRepository(db);
  const matrixService = new MatrixService(matrixRepo);
  registerMatrixRoutes(app, matrixService, authService);

  const auditLogger = new AuditLogger(db);
  const missionRepo = new MissionRepository(db);
  const missionGen = new MissionGenerator();
  const missionService = new MissionService(auditLogger, missionRepo, charRepo, worldRepo, missionGen);
  registerMissionRoutes(app, missionService, authService);

  const socketHub = new SocketHub(httpServer, authService);

  socketHub.onConnection(async (socket) => {
    const accountId = socket.data.accountId;

    socket.on('select_character', async (data: { characterId: string }) => {
      try {
        const character = await charService.getCharacter(data.characterId, accountId);

        socket.data.characterId = character.id;
        
        // Send initial room data
        if (character.currentRoomId) {
          const room = await worldService.getRoom(character.currentRoomId);
          socket.emit('room_data', room);
          
          // Send local POIs if they have area knowledge
          const pois = await db.room.findMany({
            where: { zoneId: room.zoneId, isPOI: true }
          });
          socket.emit('local_pois', pois);
        }

        socket.emit('message', { text: `Welcome back, ${character.name}. Neural link established.`, type: 'success' });
      } catch (err) {
        socket.emit('message', { text: 'Failed to select character.', type: 'error' });
      }
    });

    socket.on('command', async (data: { text: string }) => {
      const characterId = socket.data.characterId;
      if (!characterId) return;

      const cmd = data.text.toLowerCase().trim();
      const [action, ...args] = cmd.split(' ');

      try {
        if (['n', 's', 'e', 'w', 'u', 'd', 'north', 'south', 'east', 'west', 'up', 'down'].includes(action)) {
          const directionMap: Record<string, string> = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
          const direction = directionMap[action] || action;
          
          const result = await worldService.moveCharacter(characterId, accountId, direction as any);
          if (result.success) {
            socket.emit('room_data', result.room);
            
            // Update POIs for new room
            const pois = await db.room.findMany({
              where: { zoneId: result.room!.zoneId, isPOI: true }
            });
            socket.emit('local_pois', pois);
          } else {
            socket.emit('message', { text: result.error || 'You cannot go that way.', type: 'error' });
          }
        } else if (action === 'navigate') {
          const targetSlug = args[0];
          const results = await worldService.navigate(characterId, accountId, targetSlug);
          
          for (const result of results) {
            if (result.success) {
              socket.emit('room_data', result.room);
              // Small artificial delay for "walking" feel
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              socket.emit('message', { text: result.error, type: 'error' });
              break;
            }
          }

          // Final POI update
          if (results.length > 0 && results[results.length - 1].success) {
             const finalRoom = results[results.length - 1].room!;
             const pois = await db.room.findMany({
               where: { zoneId: finalRoom.zoneId, isPOI: true }
             });
             socket.emit('local_pois', pois);
          }
        } else {
          socket.emit('message', { text: `Unknown command: ${action}`, type: 'info' });
        }
      } catch (err: any) {
        socket.emit('message', { text: err.message || 'An error occurred.', type: 'error' });
      }
    });
  });

  // Tracks rooms with active combat for the game loop to process
  const activeRooms = new Set<string>();

  const originalJoinCombat = combatService.joinCombat.bind(combatService);
  combatService.joinCombat = async (charId, roomId) => {
    await originalJoinCombat(charId, roomId);
    activeRooms.add(roomId);
  };

  const gameLoop = new GameLoop(TICK_RATE_MS, async (tick) => {
    // 1. Process combat ticks for active rooms
    for (const roomId of activeRooms) {
      await combatService.processTick(roomId);
    }

    // 2. Security Patrol Check (Every 60 ticks / ~1 minute)
    if (tick % 60 === 0) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const dirtyRooms = await db.room.findMany({
        where: {
          isClean: false,
          lastCombatAt: { lt: twoMinutesAgo }
        }
      });

      for (const room of dirtyRooms) {
        app.log.warn({ roomId: room.id, roomSlug: room.slug }, 'Security patrol discovered a messy room! Triggering alarm.');
        
        // Find or create combat session to set alarm state
        const session = await combatService.getOrCreateSession(room.id);
        session.alarmState = 'RED';
        session.backupCalled = true;
        session.turnsUntilReinforcements = 1; // Immediate backup
        
        // Reset room cleaning status once alarm is triggered (or keep it dirty?)
        // For now, keep it dirty so reinforcements keep coming until cleaned
      }

      app.log.info({ tick, connected: socketHub.connectedCount, activeCombats: activeRooms.size }, 'Game tick');
    }
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  gameLoop.start();

  app.log.info(`Neon Requiem server running on port ${port}`);

  process.on('SIGTERM', async () => {
    gameLoop.stop();
    await db.$disconnect();
    await pool.end();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
