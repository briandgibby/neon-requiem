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
});
