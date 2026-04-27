import { CharacterService } from '../../src/domains/character/character.service';
import { WorldService } from '../../src/domains/world/world.service';
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
});
