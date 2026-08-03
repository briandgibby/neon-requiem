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

    let triggeredAlarmCount = 0;
    let skippedAlarmCount = 0;

    for (const room of dirtyRooms) {
      const alarmResult = await this.combatService.triggerSecurityAlarm(room.id);
      if (!alarmResult.triggered) {
        skippedAlarmCount += 1;
        this.logger.info(
          { roomId: room.id, roomSlug: room.slug, reason: alarmResult.reason },
          'Security patrol skipped alarm trigger'
        );
        continue;
      }

      triggeredAlarmCount += 1;
      this.logger.warn({ roomId: room.id, roomSlug: room.slug }, 'Security patrol discovered a messy room! Triggering alarm.');
    }

    if (dirtyRooms.length > 0) {
      this.logger.info(
        { dirtyRoomCount: dirtyRooms.length, triggeredAlarmCount, skippedAlarmCount },
        'Security patrol completed alarm scan'
      );
    }
  }
}
