import { PrismaClient } from '@prisma/client';

export class SocialRepository {
  constructor(private readonly db: PrismaClient) {}

  async findCharacterById(id: string) {
    return this.db.character.findUnique({
      where: { id },
      include: {
        inventory: {
          include: { item: true }
        }
      }
    });
  }

  async updateSINStatus(characterId: string, hasValidSIN: boolean) {
    return this.db.character.update({
      where: { id: characterId },
      data: { hasValidSIN }
    });
  }

  async updateDisguise(characterId: string, identity: string | null) {
    return this.db.character.update({
      where: { id: characterId },
      data: { disguiseIdentity: identity }
    });
  }

  async updateReputation(characterId: string, corpDelta: number, shadowDelta: number) {
    const character = await this.db.character.findUnique({ where: { id: characterId } });
    if (!character) return null;

    return this.db.character.update({
      where: { id: characterId },
      data: {
        reputationCorp: character.reputationCorp + corpDelta,
        reputationShadow: character.reputationShadow + shadowDelta
      }
    });
  }

  async getRoomBySlug(slug: string) {
    return this.db.room.findUnique({ where: { slug } });
  }

  async updateRoomDisposition(roomId: string, baseDisposition: string) {
    return this.db.room.update({
      where: { id: roomId },
      data: { baseDisposition }
    });
  }
}
