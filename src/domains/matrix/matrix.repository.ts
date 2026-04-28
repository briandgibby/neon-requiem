import { PrismaClient } from '@prisma/client';

export class MatrixRepository {
  constructor(private readonly db: PrismaClient) {}

  async findNodeByRoomId(roomId: string) {
    return this.db.matrixNode.findUnique({
      where: { roomId },
      include: { activeIC: true }
    });
  }

  async findNodeById(id: string) {
    return this.db.matrixNode.findUnique({
      where: { id },
      include: { activeIC: true }
    });
  }

  async updateNodeAlert(nodeId: string, alertLevel: string) {
    return this.db.matrixNode.update({
      where: { id: nodeId },
      data: { alertLevel }
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

  async updateCharacterLink(characterId: string, nodeId: string | null, isJackedIn: boolean) {
    return this.db.character.update({
      where: { id: characterId },
      data: {
        activeNodeId: nodeId,
        isJackedIn
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
}
