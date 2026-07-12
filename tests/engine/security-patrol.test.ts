import { SecurityPatrol } from '../../src/engine/security-patrol';

describe('SecurityPatrol', () => {
  it('logs skipped alarm triggers without treating safe-zone rooms as alarms', async () => {
    const db = {
      room: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'room_1', slug: 'civic-plaza' },
        ]),
      },
    };
    const combatService = {
      triggerSecurityAlarm: jest.fn().mockResolvedValue({ triggered: false, reason: 'safe_zone' }),
    };
    const logger = {
      warn: jest.fn(),
      info: jest.fn(),
    };
    const patrol = new SecurityPatrol(db as any, combatService as any, logger);

    await patrol.onTick(1);

    expect(combatService.triggerSecurityAlarm).toHaveBeenCalledWith('room_1');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { roomId: 'room_1', roomSlug: 'civic-plaza', reason: 'safe_zone' },
      'Security patrol skipped alarm trigger'
    );
  });

  it('logs triggered alarms after the alarm module accepts the trigger', async () => {
    const db = {
      room: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'room_1', slug: 'back-alley' },
        ]),
      },
    };
    const combatService = {
      triggerSecurityAlarm: jest.fn().mockResolvedValue({ triggered: true }),
    };
    const logger = {
      warn: jest.fn(),
      info: jest.fn(),
    };
    const patrol = new SecurityPatrol(db as any, combatService as any, logger);

    await patrol.onTick(1);

    expect(combatService.triggerSecurityAlarm).toHaveBeenCalledWith('room_1');
    expect(logger.warn).toHaveBeenCalledWith(
      { roomId: 'room_1', roomSlug: 'back-alley' },
      'Security patrol discovered a messy room! Triggering alarm.'
    );
  });
});
