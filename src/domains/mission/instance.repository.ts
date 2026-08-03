import { PrismaClient } from '@prisma/client';
import type { ActiveInstanceAlertLevel, InstanceAlertLevel } from './mission.types';

interface PersistedInstanceAlert {
  id: string;
  status: string;
  alertLevel: string;
  alertSourceRoomId: string | null;
}

interface PersistedActiveInstanceAlert {
  id: string;
  alertLevel: string;
  alertSourceRoomId: string | null;
}

export class InstanceRepository {
  constructor(private readonly db: PrismaClient) {}

  async createInstance(params: { activeMissionId: string; partyLeaderId: string }) {
    return this.db.missionInstance.create({
      data: {
        activeMissionId: params.activeMissionId,
        partyLeaderId: params.partyLeaderId,
        status: 'PENDING',
        alertLevel: 'GREEN',
      },
    });
  }

  async createInstanceRooms(instanceId: string, layoutSlugs: string[]) {
    const zone = await this.db.zone.upsert({
      where: { slug: '_instances' },
      update: {},
      create: { slug: '_instances', name: 'Mission Instances', securityRating: 'HOSTILE' },
    });

    const rooms = [];
    for (let i = 0; i < layoutSlugs.length; i++) {
      const templateSlug = layoutSlugs[i];
      const slug = `ir-${instanceId.slice(0, 8)}-${templateSlug}-${i}`;
      const room = await this.db.room.create({
        data: {
          slug,
          name: templateSlug.replace(/-/g, ' '),
          description: 'A secured area within the mission instance.',
          zoneId: zone.id,
          securityRating: 'HOSTILE',
          missionInstanceId: instanceId,
          isSafeZone: false,
        },
      });
      rooms.push(room);
    }

    for (let i = 0; i < rooms.length; i++) {
      const exits: Record<string, string> = {
        ...(i > 0 ? { west: rooms[i - 1].slug } : {}),
        ...(i < rooms.length - 1 ? { east: rooms[i + 1].slug } : {}),
      };
      await this.db.room.update({
        where: { id: rooms[i].id },
        data: { exits },
      });
      rooms[i] = { ...rooms[i], exits };
    }
    return rooms;
  }

  async findInstanceByMissionId(activeMissionId: string) {
    return this.db.missionInstance.findUnique({ where: { activeMissionId } });
  }

  async findInstanceByRoomId(roomId: string) {
    const room = await this.db.room.findUnique({ where: { id: roomId } });
    if (!room?.missionInstanceId) return null;
    return this.db.missionInstance.findUnique({ where: { id: room.missionInstanceId } });
  }

  async updateInstanceStatus(instanceId: string, status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED') {
    const data: { status: string; activatedAt?: Date; resolvedAt?: Date } = { status };
    if (status === 'ACTIVE') data.activatedAt = new Date();
    if (status === 'COMPLETED' || status === 'ABANDONED') data.resolvedAt = new Date();
    return this.db.missionInstance.update({ where: { id: instanceId }, data });
  }

  async raiseInstanceAlert(
    instanceId: string,
    newLevel: ActiveInstanceAlertLevel,
    sourceRoomId: string,
    lowerLevels: InstanceAlertLevel[],
  ): Promise<boolean> {
    const result = await this.db.missionInstance.updateMany({
      where: {
        id: instanceId,
        status: 'ACTIVE',
        alertLevel: { in: lowerLevels },
        rooms: { some: { id: sourceRoomId } },
      },
      data: {
        alertLevel: newLevel,
        alertSourceRoomId: sourceRoomId,
      },
    });
    return result.count > 0;
  }

  async replaceInstanceAlertSource(
    instanceId: string,
    level: ActiveInstanceAlertLevel,
    sourceRoomId: string,
  ): Promise<boolean> {
    const result = await this.db.missionInstance.updateMany({
      where: {
        id: instanceId,
        status: 'ACTIVE',
        alertLevel: level,
        OR: [
          { alertSourceRoomId: null },
          { alertSourceRoomId: { not: sourceRoomId } },
        ],
        rooms: { some: { id: sourceRoomId } },
      },
      data: { alertSourceRoomId: sourceRoomId },
    });
    return result.count > 0;
  }

  async claimInstanceAlertSource(
    instanceId: string,
    level: ActiveInstanceAlertLevel,
    sourceRoomId: string,
  ): Promise<boolean> {
    const result = await this.db.missionInstance.updateMany({
      where: {
        id: instanceId,
        status: 'ACTIVE',
        alertLevel: level,
        alertSourceRoomId: null,
        rooms: { some: { id: sourceRoomId } },
      },
      data: { alertSourceRoomId: sourceRoomId },
    });
    return result.count > 0;
  }

  async findInstanceAlertForRoom(roomId: string): Promise<PersistedInstanceAlert | null> {
    const room = await this.db.room.findUnique({
      where: { id: roomId },
      select: {
        missionInstance: {
          select: { id: true, status: true, alertLevel: true, alertSourceRoomId: true },
        },
      },
    });
    return room?.missionInstance ?? null;
  }

  async findActiveInstanceAlerts(): Promise<PersistedActiveInstanceAlert[]> {
    return this.db.missionInstance.findMany({
      where: {
        status: 'ACTIVE',
        alertLevel: { in: ['YELLOW', 'RED'] },
        alertSourceRoomId: { not: null },
      },
      select: { id: true, alertLevel: true, alertSourceRoomId: true },
    });
  }

  async findResolvedInstances() {
    return this.db.missionInstance.findMany({
      where: {
        status: { in: ['COMPLETED', 'ABANDONED'] },
        rooms: { some: {} },  // Only instances that still have rooms to clean up
      },
      include: { rooms: { select: { id: true } } },
    });
  }

  async deleteInstanceRooms(instanceId: string) {
    await this.db.room.deleteMany({ where: { missionInstanceId: instanceId } });
  }

  async deleteInstance(instanceId: string) {
    await this.db.missionInstance.update({
      where: { id: instanceId },
      data: { status: 'ABANDONED' },
    });
  }
}
