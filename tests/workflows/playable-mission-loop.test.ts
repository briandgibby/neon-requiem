import { CombatService } from '../../src/domains/combat/combat.service';
import { MissionGenerator } from '../../src/domains/mission/mission.generator';
import { MissionService } from '../../src/domains/mission/mission.service';
import { ShopService } from '../../src/domains/shop/shop.service';
import { AttackExecutor } from '../../src/engine/ecs/combat/moves/attack-executor';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { ComponentTypes, HealthComponent, MissionTargetComponent, PositionComponent } from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MissionSystem } from '../../src/engine/ecs/systems/mission-system';
import { PlayerRuntime } from '../../src/engine/player-runtime';
import { STARTING_ROOM_SHADOW } from '../../src/shared/constants';

describe('playable Mission loop composition', () => {
  it('accepts, deploys, resolves combat, pays once, extracts, and spends the reward', async () => {
    const registry = new EcsRegistry();
    const playerRuntime = new PlayerRuntime(registry);
    const character = {
      id: 'char-1',
      accountId: 'account-1',
      name: 'Chrome Fox',
      faction: 'shadow',
      className: 'street-samurai',
      currentRoomId: 'safe-room',
      nuyen: 500,
      currentHp: 100,
      maxHp: 100,
      currentStun: 80,
      maxStun: 80,
      currentMana: 0,
      maxMana: 0,
      currentAp: 10,
      apRecoveryTicks: 0,
      level: 5,
      body: 10,
      agility: 100,
      dexterity: 10,
      strength: 20,
      logic: 5,
      intuition: 10,
      willpower: 10,
      charisma: 5,
      luck: 5,
      masteryCQC: 100,
      masteryPistol: 0,
      masteryRifle: 0,
      masteryAutomatic: 0,
      armorValue: 10,
    };
    const template = {
      id: 'template-1',
      slug: 'redmond-wetwork',
      name: 'Redmond Wetwork',
      type: 'ASSASSINATION',
      description: 'Remove a gang lieutenant.',
      baseDifficulty: 1,
      basePayout: 3000,
      requiredClasses: [],
    };
    let mission: any = null;
    let instanceStatus = 'PENDING';
    let instanceRooms: any[] = [];

    const missionRepo = {
      findActiveMissionByLeaderId: jest.fn(async () => (
        mission?.status === 'ACTIVE'
          ? { ...mission, template, missionInstance: { id: 'instance-1', status: instanceStatus, alertLevel: 'GREEN' } }
          : null
      )),
      findTemplateBySlug: jest.fn(async (slug: string) => slug === template.slug ? template : null),
      createActiveMission: jest.fn(async (input: any) => {
        mission = { id: 'mission-1', status: 'ACTIVE', seed: input.seed, leaderId: character.id, targetData: input.targetData };
        return mission;
      }),
      updateActiveMission: jest.fn(async (_id: string, update: any) => {
        mission = { ...mission, ...update };
        return mission;
      }),
      findActiveMissionById: jest.fn(async () => mission ? { ...mission, template, leader: character } : null),
      completeMission: jest.fn(async (input: any) => {
        if (mission.status !== 'ACTIVE') {
          return { completedNow: false, nuyenTotal: character.nuyen };
        }
        mission.status = 'COMPLETED';
        instanceStatus = 'COMPLETED';
        character.nuyen += input.payout;
        character.currentRoomId = input.safeRoomId;
        return { completedNow: true, nuyenTotal: character.nuyen };
      }),
      deployMission: jest.fn(async () => {
        character.currentRoomId = instanceRooms[0].id;
        instanceStatus = 'ACTIVE';
        return { missionId: mission.id, room: instanceRooms[0] };
      }),
    };
    const instanceRepo = {
      createInstance: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      createInstanceRooms: jest.fn(async (_instanceId: string, layout: string[]) => {
        instanceRooms = layout.map((slug, index) => ({
          id: 'instance-room-' + index,
          slug: 'ir-instance-' + slug + '-' + index,
          name: slug,
          zoneId: 'instance-zone',
        }));
        return instanceRooms;
      }),
      deleteInstance: jest.fn(),
    };
    const worldRepo = {
      findRoomBySlug: jest.fn(async (slug: string) => (
        slug === STARTING_ROOM_SHADOW
          ? { id: 'safe-room', slug, name: 'The Pit', zoneId: 'shadow-zone' }
          : null
      )),
      findRoomById: jest.fn(async (id: string) => (
        instanceRooms.find((room) => room.id === id)
        ?? (id === 'safe-room' ? { id, securityRating: 'C' } : null)
      )),
    };
    const charRepo = {
      findByIdAndAccount: jest.fn(async (id: string, accountId: string) => (
        id === character.id && accountId === character.accountId ? character : null
      )),
    };
    const mobTemplate = {
      id: 'mob-template-1',
      slug: 'security-guard',
      name: 'Gang Lieutenant',
      level: 1,
      maxHp: 20,
      body: 1,
      agility: 1,
      dexterity: 1,
      strength: 1,
      logic: 1,
      intuition: 1,
      willpower: 1,
      charisma: 1,
      masteryCQC: 0,
      masteryPistol: 0,
      masteryRifle: 0,
      masteryAutomatic: 0,
      armorValue: 0,
    };
    const mobRepo = { findBySlug: jest.fn().mockResolvedValue(mobTemplate) };
    const missionService = new MissionService(
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      missionRepo as any,
      charRepo as any,
      worldRepo as any,
      new MissionGenerator(),
      registry,
      mobRepo as any,
      instanceRepo as any,
    );

    const accepted = await missionService.acceptMission({
      templateSlug: template.slug,
      characterId: character.id,
      accountId: character.accountId,
    });
    expect(accepted.missionId).toBe('mission-1');

    await missionService.deployMission(character.id, character.accountId);
    const targetId = registry.getEntityByComponent<MissionTargetComponent>(
      ComponentTypes.MissionTarget,
      (target) => target.missionId === accepted.missionId,
    )!;
    const targetPosition = registry.getComponent<PositionComponent>(targetId, ComponentTypes.Position)!;
    character.currentRoomId = targetPosition.roomId;
    playerRuntime.loadCharacter(character, targetPosition.roomId);
    registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health)!.current = 1;

    const moveDispatcher = new MoveDispatcher();
    moveDispatcher.register(new AttackExecutor());
    const combatService = new CombatService(
      {} as any,
      charRepo as any,
      worldRepo as any,
      { isEffectiveSafeZone: jest.fn().mockResolvedValue(false) } as any,
      mobRepo as any,
      {} as any,
      {} as any,
      registry,
      moveDispatcher,
      { syncAllPlayers: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      playerRuntime,
    );
    await combatService.joinCombat(character.id, character.accountId, targetPosition.roomId);
    await combatService.performMove({
      characterId: character.id,
      accountId: character.accountId,
      targetId,
      move: 'attack',
    });
    expect(registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health)?.current).toBe(0);

    await new MissionSystem(
      registry,
      (missionId, objectiveIndex) => missionService.updateObjectiveProgress(missionId, objectiveIndex),
    ).onTick(5);
    expect(mission.targetData.objectives[0].isCompleted).toBe(true);

    const completed = await missionService.completeMission(character.id, character.accountId, mission.id);
    expect(completed).toMatchObject({
      payout: 3000,
      nuyenTotal: 3500,
      alreadyCompleted: false,
    });
    expect(character.currentRoomId).toBe('safe-room');

    const repeated = await missionService.completeMission(character.id, character.accountId, mission.id);
    expect(repeated).toMatchObject({ nuyenTotal: 3500, alreadyCompleted: true });

    const shopService = new ShopService({
      purchase: jest.fn(async () => {
        character.nuyen -= 500;
        return {
          success: true,
          message: 'Successfully purchased 1x Trauma Patch',
          item: { id: 'trauma-patch', name: 'Trauma Patch' },
          nuyenRemaining: character.nuyen,
        };
      }),
    } as any, {} as any);
    const purchase = await shopService.buyItem({
      characterId: character.id,
      accountId: character.accountId,
      roomId: 'safe-room',
      itemId: 'trauma-patch',
      quantity: 1,
    });
    expect(purchase.nuyenRemaining).toBe(3000);
  });
});
