import { AuditLogger } from '../../engine/audit-logger';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { STARTING_ROOM_SHADOW, STARTING_ROOM_CORP } from '../../shared/constants';
import { MissionRepository } from './mission.repository';
import { MissionGenerator } from './mission.generator';
import { AcceptMissionInput, MissionInstanceData, MissionObjective } from './mission.types';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { EcsRegistry } from '../../engine/ecs/registry';
import { ComponentTypes, MissionTargetComponent } from '../../engine/ecs/components';
import { MobRepository, MobTemplateRecord } from '../combat/mob.repository';
import { MobFactory } from '../../engine/ecs/factories/mob-factory';
import { InstanceRepository } from './instance.repository';
import { MatrixService } from '../matrix/matrix.service';

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
        room.id
      );

      this.ecsRegistry.addComponent<MissionTargetComponent>(entityId, ComponentTypes.MissionTarget, {
        missionId,
        objectiveIndex: spawn.objectiveIndex,
        goalType: this.getGoalType(objective),
        isCompleted: false,
      });
    }
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

  async acceptMission(input: AcceptMissionInput) {
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');

    const template = await this.missionRepo.findTemplateBySlug(input.templateSlug);
    if (!template) throw new NotFoundError('Mission template');

    const seed = `${input.characterId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const partyComp = ['samurai', 'street-doc'];
    const targetData = this.missionGen.generate(template, seed, partyComp);

    // 1. Persist active mission first to get its ID
    const activeMission = await this.missionRepo.createActiveMission({
      templateId: template.id,
      leaderId: input.characterId,
      partyId: input.partyId,
      seed,
      targetData
    });

    // 2. Create MissionInstance + private room records (if instanceRepo is wired)
    if (this.instanceRepo) {
      const instance = await this.instanceRepo.createInstance({
        activeMissionId: activeMission.id,
        partyLeaderId: input.characterId,
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

  async completeMission(characterId: string, accountId: string, missionId: string, successRating: number) {
    const character = await this.charRepo.findByIdAndAccount(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    const mission = await this.missionRepo.findActiveMissionById(missionId);
    if (!mission || mission.leaderId !== character.id) throw new NotFoundError('Mission');
    if (mission.status !== 'ACTIVE') throw new ValidationError('Mission is not active');

    // 1. Calculate Payout (Placeholder)
    const basePayout = 1000;
    const finalPayout = Math.floor(basePayout * successRating);

    // 2. Audit Log the completion
    await this.auditLogger.log({
      category: 'MISSION_PAYOUT',
      severity: 'INFO',
      message: `Character ${character.name} completed mission ${missionId} with success rating ${successRating}. Payout: ${finalPayout}¥`,
      characterId: character.id,
      metadata: { missionId, successRating, finalPayout }
    });

    // 3. Exfiltrate (Portal to safe zone)
    const safeRoomSlug = character.faction === 'shadow' ? STARTING_ROOM_SHADOW : STARTING_ROOM_CORP;
    const safeRoom = await this.worldRepo.findRoomBySlug(safeRoomSlug);

    if (safeRoom) {
      await this.charRepo.updateCharacter(characterId, { currentRoomId: safeRoom.id });
    }

    await this.missionRepo.updateMissionStatus(missionId, 'COMPLETED');

    if (this.instanceRepo) {
      const instance = await this.instanceRepo.findInstanceByMissionId(missionId);
      if (instance) {
        await this.instanceRepo.updateInstanceStatus(instance.id, 'COMPLETED');
      }
    }

    return {
      success: true,
      message: `Mission Complete. You have been extracted to ${safeRoom?.name || 'Safe Zone'}. Payout: ${finalPayout}¥`,
      payout: finalPayout
    };
  }
}
