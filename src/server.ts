import 'dotenv/config';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { TICK_RATE_MS } from './shared/constants';
import { Heartbeat } from './engine/heartbeat';
import { EcsRegistry } from './engine/ecs/registry';
import { RegenSystem } from './engine/ecs/systems/regen-system';
import { CombatTickSystem } from './engine/ecs/systems/combat-tick-system';
import { CombatReinforcementSystem } from './engine/ecs/systems/combat-reinforcement-system';
import { MatrixTickSystem } from './engine/ecs/systems/matrix-tick-system';
import { IceAiSystem } from './engine/ecs/systems/ice-ai-system';
import { MoveDispatcher } from './engine/ecs/combat/move-dispatcher';
import { AttackExecutor } from './engine/ecs/combat/moves/attack-executor';
import { MatrixBruteExecutor } from './engine/ecs/combat/moves/matrix-brute-executor';
import { MatrixSleazeExecutor } from './engine/ecs/combat/moves/matrix-sleaze-executor';
import { MatrixDataSpikeExecutor } from './engine/ecs/combat/moves/matrix-data-spike-executor';
import { SecurityPatrol } from './engine/security-patrol';
import { RoomPresence } from './engine/room-presence';
import { PresenceService } from './engine/presence.service';
import { SocketHub } from './engine/socket-hub';
import { CommandDispatcher } from './engine/command-dispatcher';
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
import { MobRepository } from './domains/combat/mob.repository';
import { CombatService } from './domains/combat/combat.service';
import { registerCombatRoutes } from './domains/combat/combat.routes';
import { MagicRepository } from './domains/magic/magic.repository';
import { MagicService } from './domains/magic/magic.service';
import { MatrixRepository } from './domains/matrix/matrix.repository';
import { MatrixService } from './domains/matrix/matrix.service';
import { registerMatrixRoutes } from './domains/matrix/matrix.routes';
import { MissionRepository } from './domains/mission/mission.repository';
import { MissionService } from './domains/mission/mission.service';
import { MissionGenerator } from './domains/mission/mission.generator';
import { registerMissionRoutes } from './domains/mission/mission.routes';
import { ShopRepository } from './domains/shop/shop.repository';
import { ShopService } from './domains/shop/shop.service';
import { registerShopRoutes } from './domains/shop/shop.routes';
import { AuditLogger } from './engine/audit-logger';
import type { Socket } from 'socket.io';
import type { AuthPayload, Direction } from './shared/types';
import type { JwtSigner } from './domains/auth/auth.types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

function getPort(): number {
  const rawPort = process.env.PORT;
  if (!rawPort) return 3000;

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

async function bootstrap() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const jwtSecret = requireEnv('JWT_SECRET');
  const port = getPort();

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  const app = Fastify({ logger: true });

  await app.register(import('@fastify/cors'));

  const jwtSigner: JwtSigner = {
    sign: (payload: AuthPayload): string => {
      return jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
    },
    verify: (token: string): AuthPayload => {
      return jwt.verify(token, jwtSecret) as AuthPayload;
    },
  };

  // Shared Engine Services
  const roomPresence = new RoomPresence();
  const presenceService = new PresenceService(roomPresence);
  const ecsRegistry = new EcsRegistry();
  const heartbeat = new Heartbeat(TICK_RATE_MS);

  const moveDispatcher = new MoveDispatcher();
  moveDispatcher.register(new AttackExecutor());
  moveDispatcher.register(new MatrixBruteExecutor());
  moveDispatcher.register(new MatrixSleazeExecutor());
  moveDispatcher.register(new MatrixDataSpikeExecutor());

  // Domain Repositories & Services
  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo, jwtSigner);
  registerAuthRoutes(app, authService);

  const charRepo = new CharacterRepository(db);
  const worldRepo = new WorldRepository(db);
  const charService = new CharacterService(charRepo, worldRepo);
  registerCharacterRoutes(app, charService, authService);

  const worldService = new WorldService(worldRepo, charRepo, presenceService);
  registerWorldRoutes(app, worldService, authService);

  const matrixRepo = new MatrixRepository(db);
  const matrixService = new MatrixService(matrixRepo);
  registerMatrixRoutes(app, matrixService, authService);

  const magicRepo = new MagicRepository(db);
  const magicService = new MagicService(magicRepo);

  const combatRepo = new CombatRepository(db);
  const mobRepo = new MobRepository(db);
  const combatService = new CombatService(
    combatRepo, 
    charRepo, 
    worldRepo, 
    mobRepo, 
    magicService, 
    matrixService,
    ecsRegistry,
    moveDispatcher
  );
  registerCombatRoutes(app, combatService, authService);

  const auditLogger = new AuditLogger(db);
  const missionRepo = new MissionRepository(db);
  const missionGen = new MissionGenerator();
  const missionService = new MissionService(auditLogger, missionRepo, charRepo, worldRepo, missionGen);
  registerMissionRoutes(app, missionService, authService);

  const shopRepo = new ShopRepository(db);
  const shopService = new ShopService(shopRepo, worldRepo, charRepo);
  registerShopRoutes(app, shopService, authService);

  // Register Heartbeat subscribers
  heartbeat.subscribe(combatService);
  heartbeat.subscribe(new SecurityPatrol(db, combatService, app.log));
  heartbeat.subscribe(new RegenSystem(ecsRegistry));
  heartbeat.subscribe(new CombatTickSystem(ecsRegistry));
  heartbeat.subscribe(new CombatReinforcementSystem(ecsRegistry, mobRepo));
  heartbeat.subscribe(new MatrixTickSystem(ecsRegistry));
  heartbeat.subscribe(new IceAiSystem(ecsRegistry));

  const socketHub = new SocketHub(app.server, authService, presenceService);
  const commandDispatcher = new CommandDispatcher(worldService, socketHub, matrixService);

  socketHub.onConnection(async (socket) => {
    const accountId = socket.data.accountId;

    socket.on('select_character', async (data: { characterId: string }) => {
      try {
        const character = await charService.getCharacter(data.characterId, accountId);

        socket.data.characterId = character.id;

        // Send initial room data and establish room presence.
        if (character.currentRoomId) {
          const room = await worldService.getRoom(character.currentRoomId) as any;
          socketHub.selectCharacter(socket, {
            characterId: character.id,
            characterName: character.name,
            roomId: room.id,
          });
          room.occupants = socketHub.getRoomOccupants(room.id).filter(o => o.characterId !== character.id);
          socket.emit('room_data', room);
          const pois = await worldService.getPOIs(room.zoneId);
          socket.emit('local_pois', pois);
        }

        socket.emit('message', { text: `Welcome back, ${character.name}. Neural link established.`, type: 'success' });
      } catch (err) {
        socket.emit('message', { text: 'Failed to select character.', type: 'error' });
      }
    });

    socket.on('command', async (data: { text: string }) => {
      await commandDispatcher.dispatch(socket, data.text);
    });
  });

  await app.listen({ port, host: '0.0.0.0' });
  heartbeat.start();

  app.log.info(`Neon Requiem server running on port ${port}`);

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, 'Shutting down Neon Requiem server');
    heartbeat.stop();

    try {
      await socketHub.close();
      await app.close();
      await db.$disconnect();
      await pool.end();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(console.error);
