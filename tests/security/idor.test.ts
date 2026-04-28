import { CharacterService } from '../../src/domains/character/character.service';
import { WorldService } from '../../src/domains/world/world.service';
import { CombatService } from '../../src/domains/combat/combat.service';
import { MatrixService } from '../../src/domains/matrix/matrix.service';
import { MissionService } from '../../src/domains/mission/mission.service';
import { Direction } from '../../src/shared/types';
import { NotFoundError } from '../../src/shared/errors';

describe('IDOR Vulnerability Fix Verification', () => {
  const mockRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndAccount: jest.fn(),
    findByAccountId: jest.fn(),
    findByAccountAndName: jest.fn(),
    findByIdWithInventory: jest.fn(),
    updateInventoryItem: jest.fn(),
  };

  const mockWorldRepo = {
    findRoomBySlug: jest.fn(),
    findRoomById: jest.fn(),
    findZoneBySlug: jest.fn(),
    findZoneById: jest.fn(),
    updateRoom: jest.fn(),
    updateCharacterLocation: jest.fn(),
  };

  const characterService = new CharacterService(mockRepo as any, mockWorldRepo as any);
  const worldService = new WorldService(mockWorldRepo as any, mockRepo as any);

  it('FIXED: CharacterService.getCharacter throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);

    await expect(characterService.getCharacter('char_other', 'acc_mine'))
      .rejects.toThrow(NotFoundError);
  });

  it('FIXED: WorldService.moveCharacter throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);

    await expect(worldService.moveCharacter('char_other', 'acc_mine', 'north' as Direction))
      .rejects.toThrow(NotFoundError);
  });

  it('FIXED: WorldService.navigate throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);

    await expect(worldService.navigate('char_other', 'acc_mine', 'poi-slug'))
      .rejects.toThrow(NotFoundError);
  });

  it('FIXED: CombatService.joinCombat throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);
    const combatService = new CombatService(
      { getSessionByRoom: jest.fn(), saveSession: jest.fn(), findSessionByParticipant: jest.fn() } as any,
      mockRepo as any,
      mockWorldRepo as any,
      { findBySlug: jest.fn() } as any,
      { castSpell: jest.fn() } as any,
      {} as any
    );

    await expect(combatService.joinCombat('char_other', 'acc_mine', 'room_1'))
      .rejects.toThrow(NotFoundError);
  });

  it('FIXED: CombatService.performMove throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);
    const combatService = new CombatService(
      { getSessionByRoom: jest.fn(), saveSession: jest.fn(), findSessionByParticipant: jest.fn() } as any,
      mockRepo as any,
      mockWorldRepo as any,
      { findBySlug: jest.fn() } as any,
      { castSpell: jest.fn() } as any,
      {} as any
    );

    await expect(combatService.performMove({
      characterId: 'char_other',
      accountId: 'acc_mine',
      targetId: 'mob_1',
      move: 'attack',
    })).rejects.toThrow(NotFoundError);
  });

  it('FIXED: MatrixService.jackIn throws NotFoundError when accountId does not match', async () => {
    const matrixService = new MatrixService({
      getCharacterWithEquipment: jest.fn().mockResolvedValue(null),
    } as any);

    await expect(matrixService.jackIn('char_other', 'acc_mine', 'room_1'))
      .rejects.toThrow(NotFoundError);
  });

  it('FIXED: MissionService.acceptMission throws NotFoundError when accountId does not match', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);
    const missionService = new MissionService(
      { log: jest.fn() } as any,
      { findTemplateBySlug: jest.fn(), createActiveMission: jest.fn() } as any,
      mockRepo as any,
      mockWorldRepo as any,
      { generate: jest.fn() } as any
    );

    await expect(missionService.acceptMission({
      templateSlug: 'retrieval',
      characterId: 'char_other',
      accountId: 'acc_mine',
    })).rejects.toThrow(NotFoundError);
  });
});
