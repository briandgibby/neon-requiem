import { AuditLogger } from '../../engine/audit-logger';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { STARTING_ROOM_SHADOW, STARTING_ROOM_CORP } from '../../shared/constants';
import { MissionRepository } from './mission.repository';
import { MissionGenerator } from './mission.generator';
import { AcceptMissionInput } from './mission.types';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';

export class MissionService {
  constructor(
    private readonly auditLogger: AuditLogger,
    private readonly missionRepo: MissionRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly missionGen: MissionGenerator
  ) {}

  async acceptMission(input: AcceptMissionInput) {
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

    return {
      success: true,
      message: `Contract accepted: ${template.name}. Prepare for deployment.`,
      missionId: activeMission.id,
      seed: activeMission.seed
    };
  }

  async completeMission(characterId: string, missionId: string, successRating: number) {
    const character = await this.charRepo.findById(characterId);
    if (!character) throw new NotFoundError('Character');

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

    return {
      success: true,
      message: `Mission Complete. You have been extracted to ${safeRoom?.name || 'Safe Zone'}. Payout: ${finalPayout}¥`,
      payout: finalPayout
    };
  }
}
