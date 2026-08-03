import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { MedicalRepository } from '../../src/domains/medical/medical.repository';
import { MedicalService } from '../../src/domains/medical/medical.service';
import { CommandDispatcher, CommandOutput } from '../../src/engine/command-dispatcher';
import { CommandRegistry } from '../../src/engine/command-registry';
import { TreatHandler } from '../../src/engine/commands/treat.handler';
import { ComponentTypes, HealthComponent, ManaComponent } from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { PlayerRuntime } from '../../src/engine/player-runtime';
import { runtimeCharacter } from '../helpers/runtime-character';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseSchema = process.env.TEST_DATABASE_SCHEMA ?? 'public';
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('field treatment database integration', () => {
  jest.setTimeout(30_000);

  const runId = `medicine-${Date.now()}`;
  let pool: Pool;
  let db: PrismaClient;
  let repo: MedicalRepository;
  let roomId: string;
  let doctorAccountId: string;
  let targetAccountId: string;
  let doctorId: string;
  let targetId: string;
  let secondTargetId: string;
  let supplyItemId: string;
  let supplyInventoryId: string;
  let createdSupplyItem = false;

  beforeAll(async () => {
    if (!/^[a-z][a-z0-9_]*$/.test(testDatabaseSchema)) {
      throw new Error('TEST_DATABASE_SCHEMA must be a simple PostgreSQL identifier');
    }
    pool = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${testDatabaseSchema}`,
    });
    db = new PrismaClient({ adapter: new PrismaPg(pool, { schema: testDatabaseSchema }) });
    repo = new MedicalRepository(db);

    const zone = await db.zone.create({
      data: { slug: `${runId}-zone`, name: 'Field Clinic Test Zone', securityRating: 'C' },
    });
    const room = await db.room.create({
      data: {
        slug: `${runId}-room`,
        zoneId: zone.id,
        name: 'Field Clinic',
        description: 'A test-only treatment room.',
        securityRating: 'C',
        exits: {},
      },
    });
    roomId = room.id;
    const doctorAccount = await db.account.create({
      data: {
        username: `${runId}-doctor`,
        email: `${runId}-doctor@example.test`,
        passwordHash: 'not-used',
      },
    });
    doctorAccountId = doctorAccount.id;
    const targetAccount = await db.account.create({
      data: {
        username: `${runId}-target`,
        email: `${runId}-target@example.test`,
        passwordHash: 'not-used',
      },
    });
    targetAccountId = targetAccount.id;

    const characterData = {
      faction: 'shadow',
      race: 'human',
      level: 1,
      body: 3,
      agility: 3,
      dexterity: 3,
      strength: 3,
      logic: 5,
      intuition: 3,
      willpower: 3,
      charisma: 3,
      biosync: 3,
      luck: 3,
      luckPool: 3,
      currentRoomId: roomId,
      maxHp: 100,
      currentStun: 100,
      maxStun: 100,
      currentMana: 60,
      maxMana: 100,
      currentAp: 6,
      maxInventorySlots: 10,
      areaKnowledge: [],
      isCreationComplete: true,
    };
    const doctor = await db.character.create({
      data: {
        ...characterData,
        accountId: doctorAccountId,
        name: 'Patch',
        className: 'street-doc',
        streetDocPath: 'tech',
        currentHp: 100,
      },
    });
    doctorId = doctor.id;
    const target = await db.character.create({
      data: {
        ...characterData,
        accountId: targetAccountId,
        name: 'Rook',
        className: 'mercenary',
        currentHp: 30,
      },
    });
    targetId = target.id;
    const secondTarget = await db.character.create({
      data: {
        ...characterData,
        accountId: targetAccountId,
        name: 'Glitch',
        className: 'decker',
        currentHp: 30,
      },
    });
    secondTargetId = secondTarget.id;

    const existingSupply = await db.item.findUnique({ where: { slug: 'medical-supplies' } });
    if (existingSupply) {
      supplyItemId = existingSupply.id;
    } else {
      const supply = await db.item.create({
        data: {
          slug: 'medical-supplies',
          name: 'Medical Supplies',
          description: 'Test treatment supplies.',
          type: 'CONSUMABLE',
          slots: 1,
        },
      });
      supplyItemId = supply.id;
      createdSupplyItem = true;
    }
    const supplyInventory = await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 1 },
    });
    supplyInventoryId = supplyInventory.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { characterId: doctorId } });
    await db.account.deleteMany({ where: { id: { in: [doctorAccountId, targetAccountId] } } });
    await db.room.deleteMany({ where: { id: roomId } });
    await db.zone.deleteMany({ where: { slug: `${runId}-zone` } });
    if (createdSupplyItem) await db.item.deleteMany({ where: { id: supplyItemId } });
    await db.$disconnect();
    await pool.end();
  });

  it('atomically spends Tech supplies, heals the target, and records the treatment', async () => {
    const result = await repo.commitTreatment({
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'inventory', inventoryItemId: supplyInventoryId, quantity: 1 },
    });

    expect(result).toMatchObject({
      targetName: 'Rook',
      actorCurrentMana: 60,
    });
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 65 });
    expect(await db.inventoryItem.count({ where: { characterId: doctorId, itemId: supplyItemId } })).toBe(0);
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(1);
  });

  it('cannot spend the same final Medical Supplies twice', async () => {
    await db.character.update({ where: { id: targetId }, data: { currentHp: 30 } });
    const supplyInventory = await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 1 },
    });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });
    const input = {
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'inventory' as const, inventoryItemId: supplyInventory.id, quantity: 1 },
    };

    const attempts = await Promise.allSettled([
      repo.commitTreatment(input),
      repo.commitTreatment(input),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await db.inventoryItem.count({ where: { characterId: doctorId, itemId: supplyItemId } })).toBe(0);
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(1);
  });

  it('spends Magic-path mana and reports only the HP actually restored', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'magic', magic: 4, currentMana: 20 },
    });
    await db.character.update({ where: { id: targetId }, data: { currentHp: 90 } });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });

    const result = await repo.commitTreatment({
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 90,
      targetNextHp: 100,
      hpRestored: 10,
      resource: { type: 'mana', amount: 20 },
    });

    expect(result).toMatchObject({
      actorCurrentMana: 0,
    });
    expect(await db.character.findUnique({ where: { id: doctorId } })).toMatchObject({ currentMana: 0 });
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 100 });
  });

  it('cannot spend the same final Mana twice', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'magic', magic: 4, currentMana: 20 },
    });
    await db.character.update({ where: { id: targetId }, data: { currentHp: 30 } });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });
    const input = {
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 60,
      hpRestored: 30,
      resource: { type: 'mana' as const, amount: 20 },
    };

    const attempts = await Promise.allSettled([
      repo.commitTreatment(input),
      repo.commitTreatment(input),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await db.character.findUnique({ where: { id: doctorId } })).toMatchObject({ currentMana: 0 });
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(1);
  });

  it('rolls back a resource spend when target health changes concurrently', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'magic', magic: 4, currentMana: 40 },
    });
    await db.character.update({ where: { id: targetId }, data: { currentHp: 30 } });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });
    const input = {
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 60,
      hpRestored: 30,
      resource: { type: 'mana' as const, amount: 20 },
    };

    const attempts = await Promise.allSettled([
      repo.commitTreatment(input),
      repo.commitTreatment(input),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await db.character.findUnique({ where: { id: doctorId } })).toMatchObject({ currentMana: 20 });
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 60 });
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(1);
  });

  it('reports and synchronizes post-spend mana across concurrent valid treatments', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'magic', magic: 4, currentMana: 40 },
    });
    await db.character.updateMany({
      where: { id: { in: [targetId, secondTargetId] } },
      data: { currentRoomId: roomId, currentHp: 30 },
    });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });

    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter({
      ...runtimeCharacter(doctorId, doctorAccountId, 'Patch', 'street-doc', 100),
      currentMana: 40,
    }, roomId);
    const firstTargetEntityId = runtime.loadCharacter(
      runtimeCharacter(targetId, targetAccountId, 'Rook', 'mercenary', 30),
      roomId,
    );
    const secondTargetEntityId = runtime.loadCharacter(
      runtimeCharacter(secondTargetId, targetAccountId, 'Glitch', 'decker', 30),
      roomId,
    );
    const service = new MedicalService(repo, registry, runtime);

    const results = await Promise.all([
      service.treat({
        doctorId,
        accountId: doctorAccountId,
        targetEntityId: firstTargetEntityId,
        roomId,
      }),
      service.treat({
        doctorId,
        accountId: doctorAccountId,
        targetEntityId: secondTargetEntityId,
        roomId,
      }),
    ]);

    expect(results.map((result) => result.actorCurrentMana).sort((a, b) => a - b)).toEqual([0, 20]);
    const doctorEntityId = registry.getEntitiesWith([ComponentTypes.PlayerId])
      .find((entityId) => ![firstTargetEntityId, secondTargetEntityId].includes(entityId))!;
    expect(registry.getComponent<ManaComponent>(doctorEntityId, ComponentTypes.Mana)?.current).toBe(0);
    expect(await db.character.findUnique({ where: { id: doctorId } })).toMatchObject({ currentMana: 0 });
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(2);
  });

  it('serializes same-target treatments against authoritative live health', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'tech', currentMana: 60 },
    });
    await db.character.update({
      where: { id: targetId },
      data: { currentRoomId: roomId, currentHp: 30 },
    });
    await db.inventoryItem.deleteMany({ where: { characterId: doctorId, itemId: supplyItemId } });
    await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 2 },
    });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });

    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter(doctorId, doctorAccountId, 'Patch', 'street-doc', 100), roomId);
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter(targetId, targetAccountId, 'Rook', 'mercenary', 30),
      roomId,
    );
    const service = new MedicalService(repo, registry, runtime);

    const results = await Promise.all([
      service.treat({ doctorId, accountId: doctorAccountId, targetEntityId, roomId }),
      service.treat({ doctorId, accountId: doctorAccountId, targetEntityId, roomId }),
    ]);

    expect(results.map((result) => result.targetCurrentHp)).toEqual([65, 100]);
    expect(results.map((result) => result.hpRestored)).toEqual([35, 35]);
    expect(registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(100);
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 100 });
    expect(await db.inventoryItem.count({
      where: { characterId: doctorId, itemId: supplyItemId },
    })).toBe(0);
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(2);
  });

  it('leaves health and audit state unchanged when Tech supplies are missing', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { streetDocPath: 'tech', currentMana: 60 },
    });
    await db.character.update({ where: { id: targetId }, data: { currentHp: 30 } });
    await db.inventoryItem.deleteMany({ where: { characterId: doctorId, itemId: supplyItemId } });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });

    await expect(repo.commitTreatment({
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'inventory', inventoryItemId: 'missing-supply', quantity: 1 },
    })).rejects.toThrow('Insufficient Medical Supplies');

    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 30 });
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(0);
  });

  it('rejects an unowned actor without spending supplies', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { className: 'street-doc', streetDocPath: 'tech' },
    });
    await db.character.update({ where: { id: targetId }, data: { currentHp: 30 } });
    const supplyInventory = await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 1 },
    });

    await expect(repo.commitTreatment({
      doctorId,
      accountId: targetAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'inventory', inventoryItemId: supplyInventory.id, quantity: 1 },
    })).rejects.toThrow('Doctor not found');
    expect(await db.inventoryItem.findFirst({
      where: { characterId: doctorId, itemId: supplyItemId },
    })).toMatchObject({ quantity: 1 });
  });

  it('rolls back when the target has left the treatment room', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: { className: 'street-doc', streetDocPath: 'tech', currentRoomId: roomId },
    });
    await db.character.update({
      where: { id: targetId },
      data: { currentRoomId: null, currentHp: 30 },
    });
    await db.inventoryItem.deleteMany({ where: { characterId: doctorId, itemId: supplyItemId } });
    const supplyInventory = await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 1 },
    });
    await db.auditLog.deleteMany({ where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' } });

    await expect(repo.commitTreatment({
      doctorId,
      accountId: doctorAccountId,
      targetCharacterId: targetId,
      roomId,
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'inventory', inventoryItemId: supplyInventory.id, quantity: 1 },
    })).rejects.toThrow('Target is no longer in the treatment room');

    expect(await db.inventoryItem.findUnique({ where: { id: supplyInventory.id } }))
      .toMatchObject({ quantity: 1 });
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 30 });
    expect(await db.auditLog.count({
      where: { characterId: doctorId, category: 'MEDICAL_TREATMENT' },
    })).toBe(0);
  });

  it('persists picker-driven treatment across a fresh runtime load', async () => {
    await db.character.update({
      where: { id: doctorId },
      data: {
        className: 'street-doc',
        streetDocPath: 'tech',
        currentRoomId: roomId,
        currentMana: 60,
      },
    });
    await db.character.update({
      where: { id: targetId },
      data: { currentRoomId: roomId, currentHp: 100 },
    });
    await db.inventoryItem.deleteMany({ where: { characterId: doctorId, itemId: supplyItemId } });
    await db.inventoryItem.create({
      data: { characterId: doctorId, itemId: supplyItemId, quantity: 1 },
    });

    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter(doctorId, doctorAccountId, 'Patch', 'street-doc', 100), roomId);
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter(targetId, targetAccountId, 'Rook', 'mercenary', 30),
      roomId,
    );
    const medicalService = new MedicalService(repo, registry, runtime);
    const handler = new TreatHandler(
      medicalService,
      { listTargets: jest.fn().mockResolvedValue({ hostiles: [], allies: [] }) } as never,
      { publish: jest.fn() },
      { publish: jest.fn() },
    );
    const commandRegistry = new CommandRegistry();
    commandRegistry.register(handler);
    const socketHub = {
      getSelectedClient: () => ({
        characterId: doctorId,
        accountId: doctorAccountId,
        roomId,
        characterName: 'Patch',
      }),
    };
    const dispatcher = new CommandDispatcher(commandRegistry, socketHub as never, registry);
    const output: CommandOutput = {
      emit: jest.fn(),
      data: { characterId: doctorId, accountId: doctorAccountId },
    };

    await dispatcher.dispatch(output, `treat ${targetEntityId}`);

    expect(registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(65);
    expect(await db.character.findUnique({ where: { id: targetId } })).toMatchObject({ currentHp: 65 });
    expect(await db.inventoryItem.count({
      where: { characterId: doctorId, itemId: supplyItemId },
    })).toBe(0);

    const reconnectedTarget = await db.character.findUniqueOrThrow({ where: { id: targetId } });
    const reconnectedDoctor = await db.character.findUniqueOrThrow({ where: { id: doctorId } });
    const freshRegistry = new EcsRegistry();
    const freshRuntime = new PlayerRuntime(freshRegistry);
    const reconnectedTargetEntityId = freshRuntime.loadCharacter({
      ...runtimeCharacter(targetId, targetAccountId, 'Rook', 'mercenary', reconnectedTarget.currentHp),
      currentMana: reconnectedTarget.currentMana,
    }, roomId);
    freshRuntime.loadCharacter({
      ...runtimeCharacter(doctorId, doctorAccountId, 'Patch', 'street-doc', reconnectedDoctor.currentHp),
      currentMana: reconnectedDoctor.currentMana,
    }, roomId);

    expect(freshRegistry.getComponent<HealthComponent>(
      reconnectedTargetEntityId,
      ComponentTypes.Health,
    )?.current).toBe(65);
  });

});
