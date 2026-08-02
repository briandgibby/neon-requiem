import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

type PersistedMatrixNode = Prisma.MatrixNodeGetPayload<{
  include: { activeIC: true };
}>;
type PersistedMatrixIce = PersistedMatrixNode['activeIC'][number];

const matrixIceTypeSchema = z.enum(['WHITE', 'GRAY', 'BLACK']);

export type HydratedMatrixNode = Omit<PersistedMatrixNode, 'activeIC'> & {
  activeIC: Array<Omit<PersistedMatrixIce, 'type'> & {
    type: z.infer<typeof matrixIceTypeSchema>;
  }>;
};

function hydrateMatrixNode(node: PersistedMatrixNode): HydratedMatrixNode {
  return {
    ...node,
    activeIC: node.activeIC.map((ice) => ({
      ...ice,
      type: matrixIceTypeSchema.parse(ice.type),
    })),
  };
}

export class MatrixRepository {
  constructor(private readonly db: PrismaClient) {}

  async findNodeByRoomId(roomId: string): Promise<HydratedMatrixNode | null> {
    const node = await this.db.matrixNode.findUnique({
      where: { roomId },
      include: { activeIC: true }
    });
    return node ? hydrateMatrixNode(node) : null;
  }

  async findNodeById(id: string): Promise<HydratedMatrixNode | null> {
    const node = await this.db.matrixNode.findUnique({
      where: { id },
      include: { activeIC: true }
    });
    return node ? hydrateMatrixNode(node) : null;
  }

  async updateNodeAlert(nodeId: string, alertLevel: string) {
    return this.db.matrixNode.update({
      where: { id: nodeId },
      data: { alertLevel }
    });
  }

  async escalateInstanceNodes(instanceId: string, alertLevel: 'YELLOW' | 'RED') {
    const lowerLevels = alertLevel === 'RED' ? ['GREEN', 'YELLOW'] : ['GREEN'];
    return this.db.matrixNode.updateMany({
      where: {
        alertLevel: { in: lowerLevels },
        room: { missionInstanceId: instanceId },
      },
      data: { alertLevel },
    });
  }

  async updateIceHp(iceId: string, currentHp: number) {
    return this.db.intCountermeasure.update({
      where: { id: iceId },
      data: { currentHp }
    });
  }

  async updateCharacterHp(characterId: string, currentHp: number) {
    return this.db.character.update({
      where: { id: characterId },
      data: { currentHp }
    });
  }

  async updateCharacterStun(characterId: string, currentStun: number) {
    return this.db.character.update({
      where: { id: characterId },
      data: { currentStun }
    });
  }

  async corruptProgram(inventoryItemId: string, level: number) {
    return this.db.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { corruptionLevel: level }
    });
  }

  async repairProgram(inventoryItemId: string, newLevel: number) {
    return this.db.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { corruptionLevel: newLevel }
    });
  }

  async updateCharacterLink(
    characterId: string,
    nodeId: string | null,
    isJackedIn: boolean,
    sessionState?: { currentAp: number; recoveryTicks: number; overwatchScore: number },
  ) {
    return this.db.character.update({
      where: { id: characterId },
      data: {
        activeNodeId: nodeId,
        isJackedIn,
        ...(sessionState ? {
          currentAp: sessionState.currentAp,
          apRecoveryTicks: sessionState.recoveryTicks,
          matrixOverwatchScore: sessionState.overwatchScore,
        } : {}),
        ...(!isJackedIn ? { matrixOverwatchScore: 0 } : {}),
      }
    });
  }

  async getCharacterWithEquipment(characterId: string, accountId?: string) {
    return this.db.character.findFirst({
      where: accountId ? { id: characterId, accountId } : { id: characterId },
      include: {
        inventory: {
          where: { isEquipped: true },
          include: { item: true }
        }
      }
    });
  }

  async findRoomById(roomId: string) {
    return this.db.room.findUnique({ where: { id: roomId } });
  }

  async createMatrixNode(params: {
    slug: string;
    name: string;
    roomId: string;
    securityLevel: number;
    requiresPhysicalPresence: boolean;
  }) {
    return this.db.matrixNode.create({
      data: {
        slug: params.slug,
        name: params.name,
        description: 'Instance corporate host.',
        roomId: params.roomId,
        securityLevel: params.securityLevel,
        hostType: 'corporate',
        requiresPhysicalPresence: params.requiresPhysicalPresence,
      },
      include: { activeIC: true },
    });
  }
}
