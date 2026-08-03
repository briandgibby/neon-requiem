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
import { AlertPatrolSystem } from './engine/ecs/systems/alert-patrol-system';
import { MobAiSystem } from './engine/ecs/systems/mob-ai-system';
import { MatrixTickSystem } from './engine/ecs/systems/matrix-tick-system';
import { IceAiSystem } from './engine/ecs/systems/ice-ai-system';
import { MissionSystem } from './engine/ecs/systems/mission-system';
import { EntityCleanupSystem } from './engine/ecs/systems/entity-cleanup-system';
import { InstanceRepository } from './domains/mission/instance.repository';
import { InstanceCleanupSystem } from './engine/ecs/systems/instance-cleanup-system';
import { MoveDispatcher } from './engine/ecs/combat/move-dispatcher';
import { AttackExecutor } from './engine/ecs/combat/moves/attack-executor';
import { GuardExecutor } from './engine/ecs/combat/moves/guard-executor';
import { MatrixBruteExecutor } from './engine/ecs/combat/moves/matrix-brute-executor';
import { MatrixSleazeExecutor } from './engine/ecs/combat/moves/matrix-sleaze-executor';
import { MatrixDataSpikeExecutor } from './engine/ecs/combat/moves/matrix-data-spike-executor';
import { SecurityPatrol } from './engine/security-patrol';
import { RoomPresence } from './engine/room-presence';
import { PlayerSyncCoordinator } from './engine/player-sync-coordinator';
import { PlayerRuntime } from './engine/player-runtime';
import { SocketHub } from './engine/socket-hub';
import { RoomEventPublisher } from './engine/room-event-publisher';
import { CommandDispatcher } from './engine/command-dispatcher';
import { CommandRegistry } from './engine/command-registry';
import { registerCommandRoutes } from './engine/command.routes';
import { MoveHandler } from './engine/commands/move.handler';
import { NavigateHandler } from './engine/commands/navigate.handler';
import { LookHandler } from './engine/commands/look.handler';
import { WhoHandler } from './engine/commands/who.handler';
import { SayHandler } from './engine/commands/say.handler';
import { TellHandler } from './engine/commands/tell.handler';
import { HelpHandler } from './engine/commands/help.handler';
import { JackInHandler } from './engine/commands/jackin.handler';
import { JackOutHandler } from './engine/commands/jackout.handler';
import { BruteHandler } from './engine/commands/brute.handler';
import { SleazeHandler } from './engine/commands/sleaze.handler';
import { DataSpikeHandler } from './engine/commands/spike.handler';
import { AttackHandler } from './engine/commands/attack.handler';
import { GuardHandler as GuardCommandHandler } from './engine/commands/guard.handler';
import {
  AcceptMissionHandler,
  DeployMissionHandler,
  ExfilMissionHandler,
  MissionListHandler,
  MissionStatusHandler,
} from './engine/commands/mission.handlers';
import { BuyItemHandler, ShopListHandler } from './engine/commands/shop.handlers';
import { AuthRepository } from './domains/auth/auth.repository';
import { AuthService } from './domains/auth/auth.service';
import { registerAuthRoutes } from './domains/auth/auth.routes';
import { CharacterRepository } from './domains/character/character.repository';
import { CharacterService } from './domains/character/character.service';
import { registerCharacterRoutes } from './domains/character/character.routes';
import { WorldRepository } from './domains/world/world.repository';
import { WorldService } from './domains/world/world.service';
import { PatrolDefinitionRepository } from './domains/world/patrol-definition.repository';
import { PatrolBootstrap } from './engine/patrol-bootstrap';
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
import { InstanceAlertService } from './domains/mission/instance-alert.service';
import { MissionGenerator } from './domains/mission/mission.generator';
import { registerMissionRoutes } from './domains/mission/mission.routes';
import { ShopRepository } from './domains/shop/shop.repository';
import { ShopService } from './domains/shop/shop.service';
import { registerShopRoutes } from './domains/shop/shop.routes';
import { AuditLogger } from './engine/audit-logger';
import { SnapshotHistoryRepository } from './domains/admin/snapshot-history.repository';
import { SnapshotHistoryService } from './domains/admin/snapshot-history.service';
import { registerSnapshotHistoryRoutes } from './domains/admin/snapshot-history.routes';
import type { Socket } from 'socket.io';
import type { AuthPayload } from './shared/types';
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

  await app.register(import('@fastify/cors'), {
    methods: ['GET', 'HEAD', 'POST', 'PATCH'],
  });

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
  const ecsRegistry = new EcsRegistry();
  const playerRuntime = new PlayerRuntime(ecsRegistry);
  const syncCoordinator = new PlayerSyncCoordinator(db, ecsRegistry, new AuditLogger(db));
  const heartbeat = new Heartbeat(TICK_RATE_MS);

  const moveDispatcher = new MoveDispatcher();
  moveDispatcher.register(new AttackExecutor());
  moveDispatcher.register(new GuardExecutor());
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

  const snapshotHistory = new SnapshotHistoryService(new SnapshotHistoryRepository(db));
  registerSnapshotHistoryRoutes(app, snapshotHistory, authService);

  const worldService = new WorldService(worldRepo, charRepo, roomPresence);
  registerWorldRoutes(app, worldService, authService);

  const matrixRepo = new MatrixRepository(db);
  const missionRepo = new MissionRepository(db);
  const instanceRepo = new InstanceRepository(db);
  const instanceAlerts = new InstanceAlertService(instanceRepo);
  let missionService!: MissionService;
  const matrixService = new MatrixService(
    matrixRepo,
    ecsRegistry,
    moveDispatcher,
    async (roomId, nodeEntityId) => missionService.wireNodeToMissionTargets(roomId, nodeEntityId),
    instanceAlerts,
    playerRuntime,
  );
  registerMatrixRoutes(app, matrixService, authService);

  const magicRepo = new MagicRepository(db);
  const magicService = new MagicService(magicRepo);

  const combatRepo = new CombatRepository(db);
  const mobRepo = new MobRepository(db);
  const combatService = new CombatService(
    combatRepo, 
    charRepo, 
    worldRepo, 
    worldService,
    mobRepo, 
    magicService, 
    matrixService,
    ecsRegistry,
    moveDispatcher,
    syncCoordinator,
    instanceAlerts,
    playerRuntime,
  );
  registerCombatRoutes(app, combatService, authService);

  const auditLogger = new AuditLogger(db);
  const missionGen = new MissionGenerator();
  missionService = new MissionService(
    auditLogger, missionRepo, charRepo, worldRepo, missionGen, ecsRegistry, mobRepo, instanceRepo, matrixService
  );
  registerMissionRoutes(app, missionService, authService);

  const shopRepo = new ShopRepository(db);
  const shopService = new ShopService(shopRepo, worldRepo);
  registerShopRoutes(app, shopService, authService);

  const patrolDefinitions = new PatrolDefinitionRepository(db);
  await new PatrolBootstrap(ecsRegistry, patrolDefinitions, worldService, combatService, app.log).load();

  const socketHub = new SocketHub(app.server, authService, roomPresence, syncCoordinator);
  const roomEvents: RoomEventPublisher = {
    publish: (roomId, event) => socketHub.emitToRoom(roomId, 'message', event),
  };

  // Register Heartbeat subscribers
  heartbeat.subscribe(combatService);
  heartbeat.subscribe(new SecurityPatrol(db, combatService, app.log));
  heartbeat.subscribe(new RegenSystem(ecsRegistry));
  heartbeat.subscribe(new CombatTickSystem(ecsRegistry));
  heartbeat.subscribe(new CombatReinforcementSystem(ecsRegistry, combatService, worldService));
  heartbeat.subscribe(new AlertPatrolSystem(ecsRegistry, worldService, app.log, instanceAlerts, roomEvents));
  heartbeat.subscribe(new MobAiSystem(ecsRegistry, moveDispatcher, worldService, roomEvents));
  heartbeat.subscribe(new MatrixTickSystem(ecsRegistry, matrixRepo, instanceAlerts));
  heartbeat.subscribe(new IceAiSystem(ecsRegistry));
  heartbeat.subscribe(new MissionSystem(ecsRegistry, (missionId, index) => missionService.updateObjectiveProgress(missionId, index)));
  heartbeat.subscribe(new EntityCleanupSystem(ecsRegistry));
  heartbeat.subscribe(new InstanceCleanupSystem(ecsRegistry, instanceRepo));

  const commandRegistry = new CommandRegistry();
  commandRegistry.register(new MoveHandler(worldService, socketHub, instanceRepo, playerRuntime));
  commandRegistry.register(new NavigateHandler(worldService, socketHub, instanceRepo, playerRuntime));
  commandRegistry.register(new LookHandler(worldService, matrixService, socketHub));
  commandRegistry.register(new WhoHandler(socketHub));
  commandRegistry.register(new SayHandler(socketHub));
  commandRegistry.register(new TellHandler(socketHub));
  commandRegistry.register(new JackInHandler(matrixService));
  commandRegistry.register(new JackOutHandler(matrixService));
  commandRegistry.register(new BruteHandler(matrixService));
  commandRegistry.register(new SleazeHandler(matrixService));
  commandRegistry.register(new DataSpikeHandler(matrixService));
  commandRegistry.register(new AttackHandler(combatService));
  commandRegistry.register(new GuardCommandHandler(combatService));
  commandRegistry.register(new MissionListHandler(missionService));
  commandRegistry.register(new AcceptMissionHandler(missionService));
  commandRegistry.register(new MissionStatusHandler(missionService));
  commandRegistry.register(new DeployMissionHandler(missionService, worldService, socketHub, playerRuntime));
  commandRegistry.register(new ExfilMissionHandler(missionService, worldService, socketHub, playerRuntime));
  commandRegistry.register(new ShopListHandler(shopService));
  commandRegistry.register(new BuyItemHandler(shopService));
  commandRegistry.register(new HelpHandler(commandRegistry));
  registerCommandRoutes(app, commandRegistry, authService);

  const commandDispatcher = new CommandDispatcher(commandRegistry, socketHub, ecsRegistry);

  socketHub.onConnection(async (socket) => {
    const accountId = socket.data.accountId;
    let selectionInProgress = false;

    socket.on('select_character', (data: { characterId: string }) => {
      if (selectionInProgress || socket.data.characterId) return;
      const signal = socketHub.getSessionSignal(socket);
      if (!signal) return;
      selectionInProgress = true;

      void (async () => {
        try {
          await charService.getCharacter(data.characterId, accountId);
          if (signal.aborted) return;
          await syncCoordinator.waitForPlayerDisconnect(data.characterId);
          if (signal.aborted) return;
          const character = await charService.getCharacter(data.characterId, accountId);
          if (signal.aborted) return;

          let room: any = null;
          let pois: Awaited<ReturnType<WorldService['getPOIs']>> = [];
          if (character.currentRoomId) {
            room = await worldService.getRoom(character.currentRoomId);
            if (signal.aborted) return;
            pois = await worldService.getPOIs(room.zoneId);
            if (signal.aborted) return;
            playerRuntime.loadCharacter(character, room.id);
          }

          const activeNode = await matrixService.restoreSession(character.id, accountId, signal);
          if (signal.aborted) return;

          // Publish the selection only after all fallible reads and restoration complete.
          socket.data.characterId = character.id;
          if (room) {
            socketHub.selectCharacter(socket, {
              characterId: character.id,
              characterName: character.name,
              roomId: room.id,
            });
            room.occupants = socketHub.getRoomOccupants(room.id).filter(o => o.characterId !== character.id);
            socket.emit('room_data', room);
            socket.emit('local_pois', pois);
          }

          socket.emit('matrix_data', activeNode);
          socket.emit('message', { text: `Welcome back, ${character.name}. Neural link established.`, type: 'success' });
        } catch (err) {
          if (!signal.aborted) {
            const selectedCharacterId = socket.data.characterId as string | undefined;
            if (selectedCharacterId) {
              try {
                await syncCoordinator.handlePlayerDisconnect(selectedCharacterId);
              } catch (syncError) {
                app.log.error({ err: syncError }, 'Failed to roll back character selection');
              }
              socketHub.clearSelectedCharacter(socket);
            }
            socket.emit('message', { text: 'Failed to select character.', type: 'error' });
          }
        } finally {
          selectionInProgress = false;
        }
      })();
    });

    socket.on('command', async (data: { text: string }) => {
      try {
        await commandDispatcher.dispatch(socket, data.text);
      } catch (err) {
        app.log.error({ err }, 'Unhandled socket command failure');
        socket.emit('message', { text: 'Command failed unexpectedly.', type: 'error' });
      }
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
