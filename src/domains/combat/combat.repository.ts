import { Prisma, PrismaClient } from '@prisma/client';
import { CombatSession, CombatParticipant } from './combat.types';

export class CombatRepository {
  constructor(private readonly db: PrismaClient) {}

  async getSessionByRoom(roomId: string): Promise<CombatSession | null> {
    const session = await this.db.combatSession.findUnique({
      where: { roomId },
    });
    if (!session) return null;

    return {
      id: session.id,
      roomId: session.roomId,
      securityRating: session.securityRating,
      participants: session.participants as unknown as Record<string, CombatParticipant>,
      tick: session.tick,
      alarmState: session.alarmState as 'GREEN' | 'YELLOW' | 'RED',
      turnsUntilReinforcements: session.turnsUntilReinforcements,
      backupCalled: session.backupCalled,
    };
  }

  async saveSession(session: CombatSession): Promise<void> {
    await this.db.combatSession.upsert({
      where: { roomId: session.roomId },
      create: {
        id: session.id,
        roomId: session.roomId,
        securityRating: session.securityRating,
        participants: session.participants as any,
        tick: session.tick,
        alarmState: session.alarmState,
        turnsUntilReinforcements: session.turnsUntilReinforcements,
        backupCalled: session.backupCalled,
      },
      update: {
        participants: session.participants as any,
        tick: session.tick,
        alarmState: session.alarmState,
        turnsUntilReinforcements: session.turnsUntilReinforcements,
        backupCalled: session.backupCalled,
      },
    });
  }

  async deleteSession(roomId: string): Promise<void> {
    await this.db.combatSession.delete({
      where: { roomId },
    }).catch(() => {}); // Ignore if already deleted
  }

  async findSessionByParticipant(participantId: string): Promise<CombatSession | null> {
    const session = await this.db.combatSession.findFirst({
      where: {
        participants: {
          path: [participantId],
          not: Prisma.JsonNull,
        },
      },
    });
    
    if (!session) return null;

    return {
      id: session.id,
      roomId: session.roomId,
      securityRating: session.securityRating,
      participants: session.participants as unknown as Record<string, CombatParticipant>,
      tick: session.tick,
      alarmState: session.alarmState as 'GREEN' | 'YELLOW' | 'RED',
      turnsUntilReinforcements: session.turnsUntilReinforcements,
      backupCalled: session.backupCalled,
    };
  }
}
