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

export class MissionService {
  constructor(
    private readonly auditLogger: AuditLogger,
    private readonly missionRepo: MissionRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly missionGen: MissionGenerator,
    private readonly ecsRegistry: EcsRegistry,
    private readonly mobRepo?: MobRepository
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

    for (const spawn of targetData.spawnData) {
      if (!spawn.isTarget || spawn.objectiveIndex === undefined) continue;

      const objective = targetData.objectives[spawn.objectiveIndex];
      if (!objective) continue;

      const room = await this.worldRepo.findRoomBySlug(spawn.roomSlug);
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

    // 1. Determine Seed (Unique per character/party and time)
    const seed = `${input.characterId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // 2. Mock Party Composition (In a real system, this would fetch party data)
    const partyComp = ['samurai', 'street-doc']; // Placeholder

    // 3. Generate the Instance
    const targetData = this.missionGen.generate(template, seed, partyComp);

    // 4. Persist Active Mission
    const activeMission = await this.missionRepo.createActiveMission({
      templateId: template.id,
      leaderId: input.characterId,
      partyId: input.partyId,
      seed,
      targetData
    });

    await this.attachMissionTargets(activeMission.id, targetData);

    return {
      success: true,
      message: `Contract accepted: ${template.name}. Prepare for deployment.`,
      missionId: activeMission.id,
      seed: activeMission.seed
    };
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

    return {
      success: true,
      message: `Mission Complete. You have been extracted to ${safeRoom?.name || 'Safe Zone'}. Payout: ${finalPayout}¥`,
      payout: finalPayout
    };
  }
}
