import { PrismaClient } from '@prisma/client';
import { AcceptMissionInput, MissionInstanceData } from './mission.types';

export class MissionRepository {
  constructor(private readonly db: PrismaClient) {}

  async findTemplateBySlug(slug: string) {
    return this.db.missionTemplate.findUnique({ where: { slug } });
  }

  async listTemplates() {
    return this.db.missionTemplate.findMany({
      select: {
        slug: true,
        name: true,
        description: true,
        type: true,
        baseDifficulty: true,
        basePayout: true,
        requiredClasses: true,
      },
      orderBy: { name: 'asc' },
    });
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

  async findActiveMissionByLeaderId(leaderId: string) {
    return this.db.activeMission.findFirst({
      where: { leaderId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        template: true,
        missionInstance: {
          select: { id: true, status: true, alertLevel: true },
        },
      },
    });
  }

  async findLatestCompletedMissionByLeaderId(leaderId: string) {
    return this.db.activeMission.findFirst({
      where: { leaderId, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  }

  async completeMission(params: {
    missionId: string;
    characterId: string;
    characterName: string;
    safeRoomId: string;
    payout: number;
  }): Promise<{ completedNow: boolean; nuyenTotal: number }> {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.activeMission.updateMany({
        where: {
          id: params.missionId,
          leaderId: params.characterId,
          status: 'ACTIVE',
        },
        data: { status: 'COMPLETED' },
      });

      if (claimed.count === 0) {
        const character = await tx.character.findUnique({
          where: { id: params.characterId },
          select: { nuyen: true },
        });
        return { completedNow: false, nuyenTotal: character?.nuyen ?? 0 };
      }

      const character = await tx.character.update({
        where: { id: params.characterId },
        data: {
          nuyen: { increment: params.payout },
          currentRoomId: params.safeRoomId,
        },
        select: { nuyen: true },
      });

      await tx.missionInstance.updateMany({
        where: {
          activeMissionId: params.missionId,
          status: { in: ['PENDING', 'ACTIVE'] },
        },
        data: {
          status: 'COMPLETED',
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          category: 'MISSION_PAYOUT',
          severity: 'INFO',
          message: `Character ${params.characterName} completed mission ${params.missionId}. Payout: ${params.payout}¥`,
          characterId: params.characterId,
          metadata: {
            missionId: params.missionId,
            finalPayout: params.payout,
          },
        },
      });

      return { completedNow: true, nuyenTotal: character.nuyen };
    });
  }

  async deployMission(characterId: string): Promise<{
    missionId: string;
    room: { id: string; name: string; zoneId: string };
  } | null> {
    return this.db.$transaction(async (tx) => {
      const mission = await tx.activeMission.findFirst({
        where: { leaderId: characterId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          missionInstance: { select: { id: true } },
        },
      });
      const instanceId = mission?.missionInstance?.id;
      if (!mission || !instanceId) return null;

      const room = await tx.room.findFirst({
        where: {
          missionInstanceId: instanceId,
          slug: { endsWith: '-0' },
        },
        select: { id: true, name: true, zoneId: true },
      });
      if (!room) return null;

      await tx.character.update({
        where: { id: characterId },
        data: { currentRoomId: room.id },
      });
      await tx.missionInstance.updateMany({
        where: { id: instanceId, status: 'PENDING' },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });

      return { missionId: mission.id, room };
    });
  }

  async updateActiveMission(id: string, data: any) {
    return this.db.activeMission.update({
      where: { id },
      data
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

  async findActiveMissionsByNodeRoom(roomId: string) {
    const missions = await this.db.activeMission.findMany({
      where: { status: 'ACTIVE' },
    });
    return missions.filter((m) => {
      const data = m.targetData as any;
      return (
        Array.isArray(data?.nodeTargetData) &&
        data.nodeTargetData.some((t: any) => t.roomId === roomId)
      );
    });
  }
}
