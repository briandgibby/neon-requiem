import { PrismaClient } from '@prisma/client';

const ALERT_ORDER = ['GREEN', 'YELLOW', 'RED'];

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
    const data: any = { status };
    if (status === 'ACTIVE') data.activatedAt = new Date();
    if (status === 'COMPLETED' || status === 'ABANDONED') data.resolvedAt = new Date();
    return this.db.missionInstance.update({ where: { id: instanceId }, data });
  }

  async updateInstanceAlertLevel(instanceId: string, newLevel: string) {
    const instance = await this.db.missionInstance.findUnique({ where: { id: instanceId } });
    if (!instance) return;
    if (ALERT_ORDER.indexOf(newLevel) <= ALERT_ORDER.indexOf(instance.alertLevel)) return;
    return this.db.missionInstance.update({ where: { id: instanceId }, data: { alertLevel: newLevel } });
  }

  async findResolvedInstances() {
    return this.db.missionInstance.findMany({
      where: { status: { in: ['COMPLETED', 'ABANDONED'] } },
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
