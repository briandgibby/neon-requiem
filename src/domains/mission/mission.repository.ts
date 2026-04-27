import { PrismaClient } from '@prisma/client';
import { AcceptMissionInput, MissionInstanceData } from './mission.types';

export class MissionRepository {
  constructor(private readonly db: PrismaClient) {}

  async findTemplateBySlug(slug: string) {
    return this.db.missionTemplate.findUnique({ where: { slug } });
  }

  async createActiveMission(params: {
    templateId: string;
    leaderId: string;
    partyId?: string;
    seed: string;
    targetData: MissionInstanceData;
  }) {
    return this.db.activeMission.create({
      data: {
        templateId: params.templateId,
        leaderId: params.leaderId,
        partyId: params.partyId,
        seed: params.seed,
        targetData: params.targetData as any
      }
    });
  }

  async findActiveMissionById(id: string) {
    return this.db.activeMission.findUnique({
      where: { id },
      include: { template: true, leader: true }
    });
  }

  async updateMissionStatus(id: string, status: string) {
    return this.db.activeMission.update({
      where: { id },
      data: { status }
    });
  }

  async updateObjectiveProgress(id: string, objectiveIndex: number) {
    return this.db.activeMission.update({
      where: { id },
      data: { currentObjective: objectiveIndex }
    });
  }
}
