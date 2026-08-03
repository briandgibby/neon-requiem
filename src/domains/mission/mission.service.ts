import { AuditLogger } from '../../engine/audit-logger';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { STARTING_ROOM_SHADOW, STARTING_ROOM_CORP } from '../../shared/constants';
import { MissionRepository } from './mission.repository';
import { MissionGenerator } from './mission.generator';
import {
  AcceptMissionInput,
  AcceptMissionResult,
  ActiveMissionSummary,
  MissionCompletionResult,
  MissionDeploymentResult,
  MissionExfilCandidate,
  MissionInstanceData,
  MissionObjective,
  MissionTemplateSummary,
} from './mission.types';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { EcsRegistry } from '../../engine/ecs/registry';
import { ComponentTypes, MissionTargetComponent } from '../../engine/ecs/components';
import { MobRepository } from '../combat/mob.repository';
import { MobTemplateRecord } from '../combat/combat.types';
import { MobFactory } from '../../engine/ecs/factories/mob-factory';
import { InstanceRepository } from './instance.repository';
import { MatrixService } from '../matrix/matrix.service';
import { z } from 'zod';

const characterAccessSchema = z.object({
  characterId: z.string().min(1),
  accountId: z.string().min(1),
});
const acceptMissionInputSchema = characterAccessSchema.extend({
  templateSlug: z.string().min(1),
  partyId: z.string().min(1).optional(),
});
const completeMissionInputSchema = characterAccessSchema.extend({
  missionId: z.string().min(1),
});
const PLAYABLE_MISSION_TYPES = new Set(['ASSASSINATION', 'MATRIX']);

export class MissionService {
  constructor(
    private readonly auditLogger: AuditLogger,
    private readonly missionRepo: MissionRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly missionGen: MissionGenerator,
    private readonly ecsRegistry: EcsRegistry,
    private readonly mobRepo?: MobRepository,
    private readonly instanceRepo?: InstanceRepository,
    private readonly matrixService?: MatrixService,
  ) {}

  private getGoalType(objective: MissionObjective): MissionTargetComponent['goalType'] {
    switch (objective.type) {
      case 'ELIMINATE_TARGET':
        return 'KILL';
      case 'HACK_NODE':
      case 'BREACH_NODE':
        return 'HACK';
      case 'STEAL_ITEM':
        return 'COLLECT';
      default:
        return 'VISIT';
    }
  }

  private isTemplateEligible(
    template: { type: string; requiredClasses?: unknown },
    className: string,
  ): boolean {
    if (!PLAYABLE_MISSION_TYPES.has(template.type)) return false;
    const requiredClasses = Array.isArray(template.requiredClasses)
      ? template.requiredClasses.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return requiredClasses.length === 0 || requiredClasses.includes(className);
  }

  private async attachMissionTargets(missionId: string, targetData: MissionInstanceData): Promise<void> {
    if (!this.mobRepo) return;

    for (const spawn of (targetData.spawnData ?? [])) {
      if (!spawn.isTarget || spawn.objectiveIndex === undefined) continue;

      const objective = targetData.objectives[spawn.objectiveIndex];
      if (!objective) continue;

      // Use resolved instance roomId if available, otherwise fall back to world room slug
      let room: { id: string } | null = null;
      if (spawn.roomId) {
        room = { id: spawn.roomId };
      } else {
        room = await this.worldRepo.findRoomBySlug(spawn.roomSlug);
      }
      const template = await this.mobRepo.findBySlug(spawn.templateSlug);
      if (!room || !template) continue;

      const entityId = MobFactory.createFromTemplate(
        this.ecsRegistry,
        template as MobTemplateRecord,
        room.id,
        'hostile'
      );

      this.ecsRegistry.addComponent<MissionTargetComponent>(entityId, ComponentTypes.MissionTarget, {
        missionId,
        objectiveIndex: spawn.objectiveIndex,
        goalType: this.getGoalType(objective),
        isCompleted: false,
      });
    }
  }

  async listAvailableMissions(characterId: string, accountId: string): Promise<MissionTemplateSummary[]> {
    const input = characterAccessSchema.parse({ characterId, accountId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');
    const templates = await this.missionRepo.listTemplates();
    return templates
      .filter((template) => this.isTemplateEligible(template, character.className))
      .map(({ requiredClasses: _requiredClasses, ...template }) => template);
  }

  async getActiveMission(characterId: string, accountId: string): Promise<ActiveMissionSummary | null> {
    const input = characterAccessSchema.parse({ characterId, accountId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');

    const mission = await this.missionRepo.findActiveMissionByLeaderId(characterId);
    if (!mission) return null;
    const targetData = mission.targetData as unknown as Partial<MissionInstanceData> | null;

    return {
      missionId: mission.id,
      name: mission.template.name,
      status: mission.status,
      instanceStatus: mission.missionInstance?.status ?? null,
      alertLevel: mission.missionInstance?.alertLevel ?? 'GREEN',
      payout: mission.template.basePayout,
      objectives: (targetData?.objectives ?? []).map((objective) => ({
        description: objective.description,
        isMandatory: objective.isMandatory,
        isCompleted: objective.isCompleted,
      })),
    };
  }

  async deployMission(characterId: string, accountId: string): Promise<MissionDeploymentResult> {
    const input = characterAccessSchema.parse({ characterId, accountId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');
    const deployment = await this.missionRepo.deployMission(input.characterId);
    if (!deployment) throw new ValidationError('No deployable Mission Instance found');
    return deployment;
  }

  async getMissionForExfil(characterId: string, accountId: string): Promise<MissionExfilCandidate | null> {
    const input = characterAccessSchema.parse({ characterId, accountId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');

    const activeMission = await this.missionRepo.findActiveMissionByLeaderId(input.characterId);
    if (activeMission) return { missionId: activeMission.id };

    const safeRoomSlug = character.faction === 'shadow' ? STARTING_ROOM_SHADOW : STARTING_ROOM_CORP;
    const safeRoom = await this.worldRepo.findRoomBySlug(safeRoomSlug);
    if (!safeRoom || character.currentRoomId !== safeRoom.id) return null;

    const completedMission = await this.missionRepo.findLatestCompletedMissionByLeaderId(input.characterId);
    return completedMission ? { missionId: completedMission.id } : null;
  }

  async updateObjectiveProgress(missionId: string, objectiveIndex: number) {
    const mission = await this.missionRepo.findActiveMissionById(missionId);
    if (!mission) return;

    const targetData = mission.targetData as any;
    if (targetData.objectives[objectiveIndex]) {
      targetData.objectives[objectiveIndex].isCompleted = true;
    }

    // Update DB
    await this.missionRepo.updateActiveMission(missionId, { targetData });

    // Notify leader
    // This would typically go through SocketHub, but for now we audit log
    await this.auditLogger.log({
      category: 'MISSION_PROGRESS',
      severity: 'INFO',
      message: `Objective ${objectiveIndex} completed for mission ${missionId}`,
      characterId: mission.leaderId,
      metadata: { missionId, objectiveIndex }
    });
  }

  async acceptMission(input: AcceptMissionInput): Promise<AcceptMissionResult> {
    const parsedInput = acceptMissionInputSchema.parse(input);
    const character = await this.charRepo.findByIdAndAccount(parsedInput.characterId, parsedInput.accountId);
    if (!character) throw new NotFoundError('Character');

    const existingMission = await this.missionRepo.findActiveMissionByLeaderId(parsedInput.characterId);
    if (existingMission) throw new ValidationError('Complete or abandon your active Mission first');

    const template = await this.missionRepo.findTemplateBySlug(parsedInput.templateSlug);
    if (!template) throw new NotFoundError('Mission template');
    if (!PLAYABLE_MISSION_TYPES.has(template.type)) {
      throw new ValidationError('This Mission type is not currently playable');
    }
    if (!this.isTemplateEligible(template, character.className)) {
      const requiredClasses = Array.isArray(template.requiredClasses)
        ? template.requiredClasses.join(', ')
        : '';
      throw new ValidationError(`This Mission requires one of these classes: ${requiredClasses}`);
    }

    const seed = `${parsedInput.characterId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const partyComp = [character.className];
    const targetData = this.missionGen.generate(template, seed, partyComp);

    // 1. Persist active mission first to get its ID
    const activeMission = await this.missionRepo.createActiveMission({
      templateId: template.id,
      leaderId: parsedInput.characterId,
      partyId: parsedInput.partyId,
      seed,
      targetData
    });

    // 2. Create MissionInstance + private room records (if instanceRepo is wired)
    if (this.instanceRepo) {
      const instance = await this.instanceRepo.createInstance({
        activeMissionId: activeMission.id,
        partyLeaderId: parsedInput.characterId,
      });

      try {
        const instanceRooms = await this.instanceRepo.createInstanceRooms(instance.id, targetData.layout ?? []);

        if (instanceRooms.length !== (targetData.layout ?? []).length) {
          throw new Error(`Instance room creation incomplete: expected ${(targetData.layout ?? []).length}, got ${instanceRooms.length}`);
        }

        // Map layout slugs → instance rooms by position
        const slugToRoom = new Map(
          (targetData.layout ?? []).map((slug: string, i: number) => [slug, instanceRooms[i]])
        );

        // Resolve spawnData roomSlugs → instance room IDs
        for (const spawn of (targetData.spawnData ?? [])) {
          const instanceRoom = slugToRoom.get(spawn.roomSlug);
          if (instanceRoom) spawn.roomId = instanceRoom.id;
        }

        // Resolve nodeTargetData roomSlugs → instance room IDs
        for (const nodeTarget of (targetData.nodeTargetData ?? [])) {
          const instanceRoom = slugToRoom.get(nodeTarget.roomSlug);
          if (instanceRoom) nodeTarget.roomId = instanceRoom.id;
        }

        // 3. For MATRIX missions, create an instance-scoped MatrixNode
        if (template.type === 'MATRIX' && this.matrixService) {
          const seenRoomIds = new Set<string>();
          for (const nodeTarget of (targetData.nodeTargetData ?? [])) {
            if (nodeTarget.roomId && !seenRoomIds.has(nodeTarget.roomId)) {
              seenRoomIds.add(nodeTarget.roomId);
              await this.matrixService.createInstanceNode({
                slug: `inst-node-${instance.id.slice(0, 8)}-${nodeTarget.roomId.slice(0, 8)}`,
                name: `${template.name} — Corporate Host`,
                roomId: nodeTarget.roomId,
                securityLevel: template.baseDifficulty + 1,
                requiresPhysicalPresence: true,
              });
            }
          }
        }

        // Persist updated targetData (now has roomIds)
        await this.missionRepo.updateActiveMission(activeMission.id, { targetData });
      } catch (err) {
        await this.instanceRepo.deleteInstance(instance.id).catch(() => undefined);
        throw err;
      }
    }

    await this.attachMissionTargets(activeMission.id, targetData);

    return {
      success: true,
      message: `Contract accepted: ${template.name}. Prepare for deployment.`,
      missionId: activeMission.id,
      seed: activeMission.seed
    };
  }

  async wireNodeToMissionTargets(roomId: string, nodeEntityId: string): Promise<void> {
    const missions = await this.missionRepo.findActiveMissionsByNodeRoom(roomId);
    for (const mission of missions) {
      const targetData = mission.targetData as any;
      for (const nodeTarget of (targetData.nodeTargetData ?? [])) {
        if (nodeTarget.roomId === roomId) {
          this.ecsRegistry.addComponent<MissionTargetComponent>(nodeEntityId, ComponentTypes.MissionTarget, {
            missionId: mission.id,
            objectiveIndex: nodeTarget.objectiveIndex,
            goalType: 'HACK',
            hackThreshold: nodeTarget.hackThreshold,
            isCompleted: false,
          });
        }
      }
    }
  }

  async completeMission(
    characterId: string,
    accountId: string,
    missionId: string,
  ): Promise<MissionCompletionResult> {
    const input = completeMissionInputSchema.parse({ characterId, accountId, missionId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');

    const mission = await this.missionRepo.findActiveMissionById(input.missionId);
    if (!mission || mission.leaderId !== character.id) throw new NotFoundError('Mission');
    if (mission.status !== 'ACTIVE' && mission.status !== 'COMPLETED') {
      throw new ValidationError('Mission is not active');
    }

    const safeRoomSlug = character.faction === 'shadow' ? STARTING_ROOM_SHADOW : STARTING_ROOM_CORP;
    const safeRoom = await this.worldRepo.findRoomBySlug(safeRoomSlug);
    if (!safeRoom) throw new ValidationError('Safe extraction room is unavailable');

    if (mission.status === 'COMPLETED') {
      return {
        success: true,
        message: `Mission already complete. Payout: ${mission.template.basePayout}¥`,
        payout: mission.template.basePayout,
        nuyenTotal: character.nuyen,
        alreadyCompleted: true,
        extractionRoom: { id: safeRoom.id, name: safeRoom.name, zoneId: safeRoom.zoneId },
      };
    }

    const objectives = (mission.targetData as unknown as Partial<MissionInstanceData> | null)?.objectives;
    if (!Array.isArray(objectives) || objectives.length === 0) {
      throw new ValidationError('Mission objective state is unavailable');
    }
    if (objectives.some((objective) => objective.isMandatory && !objective.isCompleted)) {
      throw new ValidationError('Mandatory mission objectives are incomplete');
    }

    const finalPayout = mission.template.basePayout;

    const completion = await this.missionRepo.completeMission({
      missionId: input.missionId,
      characterId: input.characterId,
      characterName: character.name,
      safeRoomId: safeRoom.id,
      payout: finalPayout,
    });

    return {
      success: true,
      message: completion.completedNow
        ? `Mission Complete. You have been extracted to ${safeRoom.name}. Payout: ${finalPayout}¥`
        : `Mission already complete. Payout: ${finalPayout}¥`,
      payout: finalPayout,
      nuyenTotal: completion.nuyenTotal,
      alreadyCompleted: !completion.completedNow,
      extractionRoom: { id: safeRoom.id, name: safeRoom.name, zoneId: safeRoom.zoneId },
    };
  }
}
