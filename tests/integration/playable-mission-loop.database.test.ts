import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CharacterRepository } from '../../src/domains/character/character.repository';
import { CombatService } from '../../src/domains/combat/combat.service';
import { MobRepository } from '../../src/domains/combat/mob.repository';
import { InstanceRepository } from '../../src/domains/mission/instance.repository';
import { MissionGenerator } from '../../src/domains/mission/mission.generator';
import { MissionRepository } from '../../src/domains/mission/mission.repository';
import { MissionService } from '../../src/domains/mission/mission.service';
import { ShopRepository } from '../../src/domains/shop/shop.repository';
import { ShopService } from '../../src/domains/shop/shop.service';
import { WorldRepository } from '../../src/domains/world/world.repository';
import { WorldService } from '../../src/domains/world/world.service';
import { AuditLogger } from '../../src/engine/audit-logger';
import { CommandDispatcher, CommandOutput } from '../../src/engine/command-dispatcher';
import { CommandRegistry } from '../../src/engine/command-registry';
import { AttackHandler } from '../../src/engine/commands/attack.handler';
import {
  AcceptMissionHandler,
  DeployMissionHandler,
  ExfilMissionHandler,
} from '../../src/engine/commands/mission.handlers';
import { MoveHandler } from '../../src/engine/commands/move.handler';
import { BuyItemHandler } from '../../src/engine/commands/shop.handlers';
import { AttackExecutor } from '../../src/engine/ecs/combat/moves/attack-executor';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { ComponentTypes, HealthComponent, MissionTargetComponent, PositionComponent } from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MissionSystem } from '../../src/engine/ecs/systems/mission-system';
import { PlayerRuntime } from '../../src/engine/player-runtime';
import { PlayerSyncCoordinator } from '../../src/engine/player-sync-coordinator';
import { STARTING_ROOM_SHADOW } from '../../src/shared/constants';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseSchema = process.env.TEST_DATABASE_SCHEMA ?? 'public';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('playable Mission loop database integration', () => {
  jest.setTimeout(30_000);

  const runId = `loop-${Date.now()}`;
  let pool: Pool;
  let db: PrismaClient;
  let accountId: string;
  let characterId: string;
  let itemId: string;
  let safeRoomId: string;
  let shopRoomId: string;
  let createdMobTemplate = false;
  let instanceRoomIds: string[] = [];

  beforeAll(async () => {
    if (!/^[a-z][a-z0-9_]*$/.test(testDatabaseSchema)) {
      throw new Error('TEST_DATABASE_SCHEMA must be a simple PostgreSQL identifier');
    }
    pool = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${testDatabaseSchema}`,
    });
    db = new PrismaClient({ adapter: new PrismaPg(pool, { schema: testDatabaseSchema }) });

    const zone = await db.zone.create({
      data: { slug: `${runId}-zone`, name: 'Integration Zone', securityRating: 'C' },
    });
    const safeRoom = await db.room.create({
      data: {
        slug: STARTING_ROOM_SHADOW,
        zoneId: zone.id,
        name: 'The Pit',
        description: 'A fortified refuge for shadow runners.',
        securityRating: 'C',
        isSafeZone: true,
        isPOI: true,
        poiCategory: 'HUB',
        exits: { east: `${runId}-shop` },
      },
    });
    safeRoomId = safeRoom.id;
    const shopRoom = await db.room.create({
      data: {
        slug: `${runId}-shop`,
        zoneId: zone.id,
        name: 'Integration Supply Counter',
        description: 'A test-only shop.',
        securityRating: 'C',
        isSafeZone: true,
        isPOI: true,
        poiCategory: 'SHOP',
        exits: { west: STARTING_ROOM_SHADOW },
      },
    });
    shopRoomId = shopRoom.id;
    const account = await db.account.create({
      data: {
        username: `${runId}-runner`,
        email: `${runId}@example.test`,
        passwordHash: 'not-used',
      },
    });
    accountId = account.id;
    const character = await db.character.create({
      data: {
        accountId,
        name: 'Chrome Fox',
        faction: 'shadow',
        race: 'human',
        className: 'street-samurai',
        nuyen: 500,
        body: 10,
        agility: 100,
        dexterity: 10,
        strength: 20,
        logic: 5,
        intuition: 10,
        willpower: 10,
        charisma: 5,
        biosync: 6,
        luck: 5,
        luckPool: 5,
        masteryCQC: 100,
        currentRoomId: safeRoom.id,
        currentHp: 100,
        maxHp: 100,
        currentStun: 80,
        maxStun: 80,
        currentMana: 0,
        maxMana: 0,
        currentAp: 10,
        maxInventorySlots: 10,
        areaKnowledge: [],
        isCreationComplete: true,
      },
    });
    characterId = character.id;

    await db.missionTemplate.create({
      data: {
        slug: `${runId}-wetwork`,
        name: 'Integration Wetwork',
        type: 'ASSASSINATION',
        description: 'Remove the marked guard.',
        baseDifficulty: 1,
        basePayout: 3000,
        requiredClasses: [],
      },
    });
    const existingMobTemplate = await db.mobTemplate.findUnique({ where: { slug: 'security-guard' } });
    if (!existingMobTemplate) {
      await db.mobTemplate.create({
        data: {
        slug: 'security-guard',
        name: 'Marked Guard',
        body: 1,
        agility: 1,
        dexterity: 1,
        strength: 1,
        logic: 1,
        intuition: 1,
        willpower: 1,
        charisma: 1,
          maxHp: 20,
        },
      });
      createdMobTemplate = true;
    }
    const item = await db.item.create({
      data: {
        slug: `${runId}-trauma-patch`,
        name: 'Trauma Patch',
        description: 'Emergency medicine.',
        type: 'CONSUMABLE',
        slots: 1,
      },
    });
    itemId = item.id;
    await db.shopItem.create({
      data: { roomId: shopRoomId, itemId, price: 500, stock: 1 },
    });
  });

  afterAll(async () => {
    if (!db) return;
    if (characterId) {
      await db.auditLog.deleteMany({ where: { characterId } });
      await db.activeMission.deleteMany({ where: { leaderId: characterId } });
    }
    if (itemId) await db.shopItem.deleteMany({ where: { itemId } });
    if (accountId) await db.account.deleteMany({ where: { id: accountId } });
    await db.room.deleteMany({ where: { id: { in: instanceRoomIds } } });
    const fixedRoomIds = [safeRoomId, shopRoomId].filter((id): id is string => Boolean(id));
    await db.room.deleteMany({ where: { id: { in: fixedRoomIds } } });
    if (itemId) await db.item.deleteMany({ where: { id: itemId } });
    if (createdMobTemplate) {
      await db.mobTemplate.deleteMany({ where: { slug: 'security-guard' } });
    }
    await db.missionTemplate.deleteMany({ where: { slug: `${runId}-wetwork` } });
    await db.zone.deleteMany({
      where: { slug: { in: [`${runId}-zone`, '_instances'] }, rooms: { none: {} } },
    });
    await db.$disconnect();
    await pool.end();
  });

  it('runs accept, deploy, traversal, combat, recovery exfil, payout, and purchase through commands', async () => {
    const missionRepo = new MissionRepository(db);
    const characterRepo = new CharacterRepository(db);
    const worldRepo = new WorldRepository(db);
    const instanceRepo = new InstanceRepository(db);
    const mobRepo = new MobRepository(db);
    const registry = new EcsRegistry();
    const playerRuntime = new PlayerRuntime(registry);
    const auditLogger = new AuditLogger(db);
    const missionService = new MissionService(
      auditLogger,
      missionRepo,
      characterRepo,
      worldRepo,
      new MissionGenerator(),
      registry,
      mobRepo,
      instanceRepo,
    );

    const selected = {
      characterId,
      accountId,
      roomId: (await characterRepo.findById(characterId))!.currentRoomId!,
      characterName: 'Chrome Fox',
    };
    const socketHub = {
      getSelectedClient: jest.fn(() => selected),
      getRoomOccupants: jest.fn(() => []),
      moveCharacter: jest.fn((_characterId: string, roomId: string) => {
        selected.roomId = roomId;
      }),
    };
    const presence = {
      moveCharacterById: jest.fn((_characterId: string, roomId: string) => {
        selected.roomId = roomId;
      }),
    };
    const worldService = new WorldService(worldRepo, characterRepo, presence as any);
    const syncCoordinator = new PlayerSyncCoordinator(db, registry, auditLogger);
    const moveDispatcher = new MoveDispatcher();
    moveDispatcher.register(new AttackExecutor());
    const combatService = new CombatService(
      {} as any,
      characterRepo,
      worldRepo,
      { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) },
      mobRepo,
      {} as any,
      {} as any,
      registry,
      moveDispatcher,
      syncCoordinator,
      undefined,
      playerRuntime,
    );
    const shopService = new ShopService(new ShopRepository(db), worldRepo);

    const commandRegistry = new CommandRegistry();
    commandRegistry.register(new AcceptMissionHandler(missionService));
    commandRegistry.register(new DeployMissionHandler(missionService, worldService, socketHub as any, playerRuntime));
    commandRegistry.register(new MoveHandler(worldService, socketHub as any, instanceRepo, playerRuntime));
    commandRegistry.register(new AttackHandler(combatService));
    commandRegistry.register(new ExfilMissionHandler(missionService, worldService, socketHub as any, playerRuntime));
    commandRegistry.register(new BuyItemHandler(shopService));
    const dispatcher = new CommandDispatcher(commandRegistry, socketHub as any, registry);
    const output: CommandOutput = {
      emit: jest.fn(),
      data: { characterId, accountId },
    };

    await dispatcher.dispatch(output, `accept ${runId}-wetwork`);
    const mission = await missionRepo.findActiveMissionByLeaderId(characterId);
    expect(mission).not.toBeNull();
    instanceRoomIds = (await db.room.findMany({
      where: { missionInstance: { activeMissionId: mission!.id } },
      select: { id: true },
    })).map((room) => room.id);

    await dispatcher.dispatch(output, 'deploy');
    const character = (await characterRepo.findById(characterId))!;
    playerRuntime.loadCharacter(character, selected.roomId);

    const targetId = registry.getEntityByComponent<MissionTargetComponent>(
      ComponentTypes.MissionTarget,
      (target) => target.missionId === mission!.id,
    )!;
    const targetRoomId = registry.getComponent<PositionComponent>(targetId, ComponentTypes.Position)!.roomId;
    for (let steps = 0; selected.roomId !== targetRoomId && steps < 10; steps++) {
      const previousRoomId = selected.roomId;
      await dispatcher.dispatch(output, 'east');
      expect(selected.roomId).not.toBe(previousRoomId);
    }
    expect(selected.roomId).toBe(targetRoomId);

    registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health)!.current = 1;
    await dispatcher.dispatch(output, `attack ${targetId}`);
    expect(registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health)!.current).toBe(0);

    await new MissionSystem(
      registry,
      (missionId, objectiveIndex) => missionService.updateObjectiveProgress(missionId, objectiveIndex),
    ).onTick(5);

    const committed = await missionService.completeMission(characterId, accountId, mission!.id);
    expect(committed).toMatchObject({ payout: 3000, nuyenTotal: 3500, alreadyCompleted: false });
    expect(selected.roomId).toBe(targetRoomId);

    await dispatcher.dispatch(output, 'exfil');
    expect(selected.roomId).toBe(safeRoomId);
    expect(registry.getComponent<PositionComponent>(
      registry.getEntityByComponent(ComponentTypes.PlayerId, (player: any) => player.characterId === characterId)!,
      ComponentTypes.Position,
    )?.roomId).toBe(safeRoomId);

    await dispatcher.dispatch(output, 'east');
    expect(selected.roomId).toBe(shopRoomId);
    await dispatcher.dispatch(output, `buy ${itemId}`);
    const purchasedCharacter = await characterRepo.findByIdWithInventory(characterId, accountId);
    expect(purchasedCharacter.nuyen).toBe(3000);
    expect(purchasedCharacter.inventory).toEqual([
      expect.objectContaining({ itemId, quantity: 1 }),
    ]);
    expect((await db.shopItem.findUnique({
      where: { roomId_itemId: { roomId: shopRoomId, itemId } },
    }))?.stock).toBe(0);

    const repeated = await missionService.completeMission(characterId, accountId, mission!.id);
    expect(repeated).toMatchObject({ nuyenTotal: 3000, alreadyCompleted: true });
    expect(await db.auditLog.count({
      where: { characterId, category: 'MISSION_PAYOUT' },
    })).toBe(1);
  });
});
