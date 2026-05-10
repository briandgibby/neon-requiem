import { MissionService } from '../../src/domains/mission/mission.service';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, MissionTargetComponent, PositionComponent } from '../../src/engine/ecs/components';
import { NotFoundError, ValidationError } from '../../src/shared/errors';

describe('MissionService', () => {
  function createService(overrides: {
    missionRepo?: any;
    charRepo?: any;
    worldRepo?: any;
    auditLogger?: any;
    missionGen?: any;
    ecsRegistry?: EcsRegistry;
    mobRepo?: any;
  } = {}) {
    const auditLogger = overrides.auditLogger ?? { log: jest.fn().mockResolvedValue(undefined) };
    const missionRepo = overrides.missionRepo ?? {
      findActiveMissionById: jest.fn(),
      updateMissionStatus: jest.fn().mockResolvedValue(undefined),
    };
    const charRepo = overrides.charRepo ?? {
      findByIdAndAccount: jest.fn(),
      updateCharacter: jest.fn().mockResolvedValue(undefined),
    };
    const worldRepo = overrides.worldRepo ?? {
      findRoomBySlug: jest.fn().mockResolvedValue({ id: 'safe-room-1', name: 'Safehouse' }),
    };
    const missionGen = overrides.missionGen ?? {};
    const ecsRegistry = overrides.ecsRegistry ?? new EcsRegistry();

    return {
      service: new MissionService(
        auditLogger,
        missionRepo,
        charRepo,
        worldRepo,
        missionGen,
        ecsRegistry,
        overrides.mobRepo
      ),
      auditLogger,
      missionRepo,
      charRepo,
      worldRepo,
      ecsRegistry,
    };
  }

  it('does not allow a character to complete another leader mission', async () => {
    const { service, missionRepo, charRepo } = createService();
    charRepo.findByIdAndAccount.mockResolvedValue({
      id: 'char-1',
      faction: 'shadow',
      name: 'Chrome Fox',
    });
    missionRepo.findActiveMissionById.mockResolvedValue({
      id: 'mission-1',
      leaderId: 'char-2',
      status: 'ACTIVE',
    });

    await expect(service.completeMission('char-1', 'account-1', 'mission-1', 1))
      .rejects.toThrow(NotFoundError);
  });

  it('rejects completion for inactive missions', async () => {
    const { service, missionRepo, charRepo } = createService();
    charRepo.findByIdAndAccount.mockResolvedValue({
      id: 'char-1',
      faction: 'shadow',
      name: 'Chrome Fox',
    });
    missionRepo.findActiveMissionById.mockResolvedValue({
      id: 'mission-1',
      leaderId: 'char-1',
      status: 'COMPLETED',
    });

    await expect(service.completeMission('char-1', 'account-1', 'mission-1', 1))
      .rejects.toThrow(ValidationError);
  });

  it('marks the mission completed after successful payout and extraction', async () => {
    const { service, missionRepo, charRepo } = createService();
    charRepo.findByIdAndAccount.mockResolvedValue({
      id: 'char-1',
      faction: 'shadow',
      name: 'Chrome Fox',
    });
    missionRepo.findActiveMissionById.mockResolvedValue({
      id: 'mission-1',
      leaderId: 'char-1',
      status: 'ACTIVE',
    });

    const result = await service.completeMission('char-1', 'account-1', 'mission-1', 1.2);

    expect(result.success).toBe(true);
    expect(result.payout).toBe(1200);
    expect(missionRepo.updateMissionStatus).toHaveBeenCalledWith('mission-1', 'COMPLETED');
  });

  it('attaches accepted mission assassination targets to spawned ECS NPCs', async () => {
    const ecsRegistry = new EcsRegistry();
    const targetData = {
      layout: ['office-a'],
      objectives: [
        {
          type: 'ELIMINATE_TARGET',
          description: 'Eliminate the corporate defector',
          isMandatory: true,
          isCompleted: false,
          targetId: 'assassination-target',
        },
      ],
      spawnData: [
        {
          npcId: 'assassination-target',
          templateSlug: 'security-guard',
          roomSlug: 'office-a',
          isTarget: true,
          objectiveIndex: 0,
        },
      ],
    };
    const missionRepo = {
      findTemplateBySlug: jest.fn().mockResolvedValue({
        id: 'template-1',
        slug: 'hit-job',
        name: 'Hit Job',
        type: 'ASSASSINATION',
        baseDifficulty: 1,
      }),
      createActiveMission: jest.fn().mockResolvedValue({
        id: 'mission-1',
        seed: 'seed-1',
      }),
    };
    const charRepo = {
      findByIdAndAccount: jest.fn().mockResolvedValue({
        id: 'char-1',
        accountId: 'account-1',
      }),
    };
    const worldRepo = {
      findRoomBySlug: jest.fn().mockResolvedValue({ id: 'room-1', slug: 'office-a' }),
    };
    const missionGen = {
      generate: jest.fn().mockReturnValue(targetData),
    };
    const mobRepo = {
      findBySlug: jest.fn().mockResolvedValue({
        id: 'mob-template-1',
        slug: 'security-guard',
        name: 'Security Guard',
        level: 1,
        body: 3,
        agility: 3,
        dexterity: 3,
        strength: 3,
        logic: 2,
        intuition: 2,
        willpower: 2,
        charisma: 1,
        maxHp: 20,
        maxAp: 6,
        armorValue: 1,
        masteryCQC: 1,
        masteryPistol: 1,
        masteryRifle: 0,
        masteryAutomatic: 0,
      }),
    };

    const { service } = createService({ missionRepo, charRepo, worldRepo, missionGen, ecsRegistry, mobRepo });

    const result = await service.acceptMission({
      templateSlug: 'hit-job',
      characterId: 'char-1',
      accountId: 'account-1',
    });

    expect(result.missionId).toBe('mission-1');

    const targetEntityId = ecsRegistry.getEntityByComponent<MissionTargetComponent>(
      ComponentTypes.MissionTarget,
      (target) => target.missionId === 'mission-1'
    );
    expect(targetEntityId).toBeDefined();
    expect(ecsRegistry.getComponent<MissionTargetComponent>(targetEntityId!, ComponentTypes.MissionTarget))
      .toMatchObject({
        missionId: 'mission-1',
        objectiveIndex: 0,
        goalType: 'KILL',
        isCompleted: false,
      });
    expect(ecsRegistry.getComponent<PositionComponent>(targetEntityId!, ComponentTypes.Position)).toEqual({
      roomId: 'room-1',
    });
  });
});
