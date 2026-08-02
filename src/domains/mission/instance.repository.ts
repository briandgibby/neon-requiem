import { PrismaClient } from '@prisma/client';

const ALERT_LEVELS = ['GREEN', 'YELLOW', 'RED'] as const;
type AlertLevel = typeof ALERT_LEVELS[number];
export type InstanceAlertUpdateResult =
  | 'escalated'
  | 'source-updated'
  | 'unchanged'
  | 'not-in-instance'
  | 'inactive-instance';

export interface InstanceAlertAuthority {
  escalateAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult>;
  ensureAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult>;
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

  async updateInstanceAlertLevel(
    instanceId: string,
    newLevel: string,
    sourceRoomId?: string,
  ): Promise<'escalated' | 'source-updated' | 'unchanged'> {
    return this.writeInstanceAlertLevel(instanceId, newLevel, sourceRoomId, 'replace');
  }

  private async writeInstanceAlertLevel(
    instanceId: string,
    newLevel: string,
    sourceRoomId: string | undefined,
    sameLevelSourcePolicy: 'replace' | 'fill',
  ): Promise<'escalated' | 'source-updated' | 'unchanged'> {
    if (newLevel !== 'YELLOW' && newLevel !== 'RED') return 'unchanged';

    const lowerLevels: AlertLevel[] = newLevel === 'RED' ? ['GREEN', 'YELLOW'] : ['GREEN'];
    const sourceRoomFilter = sourceRoomId ? { rooms: { some: { id: sourceRoomId } } } : {};
    const escalated = await this.db.missionInstance.updateMany({
      where: {
        id: instanceId,
        status: 'ACTIVE',
        alertLevel: { in: lowerLevels },
        ...sourceRoomFilter,
      },
      data: {
        alertLevel: newLevel,
        ...(sourceRoomId ? { alertSourceRoomId: sourceRoomId } : {}),
      },
    });
    if (escalated.count > 0) return 'escalated';

    if (sourceRoomId) {
      const sourceUpdated = await this.db.missionInstance.updateMany({
        where: {
          id: instanceId,
          status: 'ACTIVE',
          alertLevel: newLevel,
          ...(sameLevelSourcePolicy === 'fill'
            ? { alertSourceRoomId: null }
            : {
                OR: [
                  { alertSourceRoomId: null },
                  { alertSourceRoomId: { not: sourceRoomId } },
                ],
              }),
          ...sourceRoomFilter,
        },
        data: { alertSourceRoomId: sourceRoomId },
      });
      if (sourceUpdated.count > 0) return 'source-updated';
    }

    return 'unchanged';
  }

  async escalateAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult> {
    if (newLevel !== 'YELLOW' && newLevel !== 'RED') return 'unchanged';

    const instance = await this.findInstanceAlertForRoom(roomId);
    if (!instance) return 'not-in-instance';
    if (instance.status !== 'ACTIVE') return 'inactive-instance';

    const currentPriority = ALERT_LEVELS.indexOf(instance.alertLevel as AlertLevel);
    const requestedPriority = ALERT_LEVELS.indexOf(newLevel);
    if (currentPriority > requestedPriority) return 'unchanged';
    if (currentPriority === requestedPriority && instance.alertSourceRoomId === roomId) return 'unchanged';

    return this.updateInstanceAlertLevel(instance.id, newLevel, roomId);
  }

  async ensureAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult> {
    if (newLevel !== 'YELLOW' && newLevel !== 'RED') return 'unchanged';

    const instance = await this.findInstanceAlertForRoom(roomId);
    if (!instance) return 'not-in-instance';
    if (instance.status !== 'ACTIVE') return 'inactive-instance';

    const currentPriority = ALERT_LEVELS.indexOf(instance.alertLevel as AlertLevel);
    const requestedPriority = ALERT_LEVELS.indexOf(newLevel);
    if (currentPriority > requestedPriority) return 'unchanged';
    if (currentPriority === requestedPriority && instance.alertSourceRoomId) return 'unchanged';

    return this.writeInstanceAlertLevel(instance.id, newLevel, roomId, 'fill');
  }

  private async findInstanceAlertForRoom(roomId: string) {
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

  async findActiveInstanceAlertSources(): Promise<Array<{
    instanceId: string;
    roomId: string;
    alarmState: 'YELLOW' | 'RED';
  }>> {
    const instances = await this.db.missionInstance.findMany({
      where: {
        status: 'ACTIVE',
        alertLevel: { in: ['YELLOW', 'RED'] },
        alertSourceRoomId: { not: null },
      },
      select: { id: true, alertLevel: true, alertSourceRoomId: true },
    });

    return instances.flatMap((instance) => {
      if (!instance.alertSourceRoomId || (instance.alertLevel !== 'YELLOW' && instance.alertLevel !== 'RED')) {
        return [];
      }
      return [{ instanceId: instance.id, roomId: instance.alertSourceRoomId, alarmState: instance.alertLevel }];
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
