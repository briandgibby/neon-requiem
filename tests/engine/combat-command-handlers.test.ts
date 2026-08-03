import { AttackHandler } from '../../src/engine/commands/attack.handler';
import { GuardHandler } from '../../src/engine/commands/guard.handler';

function createContext(targetId: string) {
  return {
    action: 'attack',
    characterId: 'char-1',
    accountId: 'account-1',
    args: [targetId],
    argsString: targetId,
    roomId: 'room-1',
    characterName: 'Chrome Fox',
    output: { emit: jest.fn(), data: {} },
    message: jest.fn(),
  };
}

describe('combat command target validation', () => {
  it('does not dispatch attack for a target outside the authoritative hostile list', async () => {
    const combatService = {
      listTargets: jest.fn().mockResolvedValue({ hostiles: [], allies: [] }),
      joinCombat: jest.fn(),
      performMove: jest.fn(),
    };

    await new AttackHandler(combatService as any).execute(createContext('forged-target') as any);

    expect(combatService.joinCombat).not.toHaveBeenCalled();
    expect(combatService.performMove).not.toHaveBeenCalled();
  });

  it('does not dispatch guard for a target outside the authoritative ally list', async () => {
    const combatService = {
      listTargets: jest.fn().mockResolvedValue({ hostiles: [], allies: [] }),
      joinCombat: jest.fn(),
      performMove: jest.fn(),
    };

    await new GuardHandler(combatService as any).execute(createContext('forged-target') as any);

    expect(combatService.joinCombat).not.toHaveBeenCalled();
    expect(combatService.performMove).not.toHaveBeenCalled();
  });

  it('publishes current actor vitals after a successful attack', async () => {
    const context = createContext('hostile-1');
    const combatService = {
      listTargets: jest.fn().mockResolvedValue({
        hostiles: [{ id: 'hostile-1', name: 'Guard', currentHp: 80, maxHp: 80 }],
        allies: [],
      }),
      joinCombat: jest.fn(),
      performMove: jest.fn().mockResolvedValue({
        success: true,
        message: 'You attack and deal 9 damage (solid).',
        data: {
          actorState: { currentHp: 42, maxHp: 65, currentAp: 2, maxAp: 6 },
        },
      }),
    };

    await new AttackHandler(combatService as any).execute(context as any);

    expect(context.output.emit).toHaveBeenCalledWith('character_update', {
      currentHp: 42,
      maxHp: 65,
      currentAp: 2,
      maxAp: 6,
    });
  });
});
