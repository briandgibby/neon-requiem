import { PrismaClient } from '@prisma/client';
import { CombatService } from '../domains/combat/combat.service';
import { Tickable } from './heartbeat';

export class SecurityPatrol implements Tickable {
  readonly name = 'SecurityPatrol';
  readonly frequency = 60; // Run every minute (assuming 1s heartbeat)

  constructor(
    private readonly db: PrismaClient,
    private readonly combatService: CombatService,
    private readonly logger: { warn: (obj: any, msg: string) => void, info: (obj: any, msg: string) => void }
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const dirtyRooms = await this.db.room.findMany({
      where: {
        isClean: false,
        lastCombatAt: { lt: twoMinutesAgo }
      }
    });

    for (const room of dirtyRooms) {
      this.logger.warn({ roomId: room.id, roomSlug: room.slug }, 'Security patrol discovered a messy room! Triggering alarm.');
      
      const session = await this.combatService.getOrCreateSession(room.id);
      session.alarmState = 'RED';
      session.backupCalled = true;
      session.turnsUntilReinforcements = 1; // Immediate backup
      
      await this.combatService.saveSession(session);
    }

    if (dirtyRooms.length > 0) {
      this.logger.info({ dirtyRoomCount: dirtyRooms.length }, 'Security patrol completed alarm triggers');
    }
  }
}
