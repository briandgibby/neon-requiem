import { CombatService } from '../../src/domains/combat/combat.service';
import { MAX_AP, COMMAND_AP_PENALTY } from '../../src/shared/constants';
import { ValidationError } from '../../src/shared/errors';

describe('CombatService', () => {
  let service: CombatService;
  let mockCombatRepo: any;
  let mockCharRepo: any;
  let mockWorldRepo: any;
  let mockMobRepo: any;
  let mockMagicService: any;
  let mockMatrixService: any;
  let mockEcsRegistry: any;
  let mockMoveDispatcher: any;

  beforeEach(() => {
    mockCombatRepo = {
      getSessionByRoom: jest.fn(),
      saveSession: jest.fn(),
      findSessionByParticipant: jest.fn(),
    };
    mockCharRepo = {
      findById: jest.fn(),
      findByIdAndAccount: jest.fn(),
      updateCharacter: jest.fn(),
    };
    mockWorldRepo = {
      findRoomById: jest.fn(),
      updateRoom: jest.fn(),
    };
    mockMobRepo = {
      findBySlug: jest.fn(),
    };
    mockMagicService = {
      castSpell: jest.fn(),
    };
    mockMatrixService = {};
    mockEcsRegistry = {
      getEntityByComponent: jest.fn(),
      createEntity: jest.fn().mockReturnValue('entity-1'),
      addComponent: jest.fn(),
      getEntitiesWith: jest.fn().mockReturnValue([]),
      getComponent: jest.fn(),
    };
    mockMoveDispatcher = {
      dispatch: jest.fn(),
    };
    service = new CombatService(
      mockCombatRepo,
      mockCharRepo as any,
      mockWorldRepo as any,
      mockMobRepo as any,
      mockMagicService as any,
      mockMatrixService as any,
      mockEcsRegistry as any,
      mockMoveDispatcher as any
    );
  });

  const mockCharacter = {
    id: 'char_1',
    accountId: 'acc_1',
    name: 'Kira',
    currentHp: 100,
    maxHp: 100,
    currentStun: 100,
    maxStun: 100,
    currentMana: 0,
    maxMana: 0,
    level: 1,
    agility: 5,
    dexterity: 5,
    logic: 5,
    intuition: 5,
    willpower: 5,
    charisma: 5,
    strength: 5,
    body: 5,
    luck: 5,
    masteryCQC: 5,
    masteryPistol: 0,
    masteryRifle: 0,
    masteryAutomatic: 0,
    armorValue: 0,
  };

  describe('joinCombat', () => {
    it('creates a new player entity in ECS if none exists', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockEcsRegistry.getEntityByComponent.mockReturnValue(undefined); // Entity not in ECS
      mockWorldRepo.findRoomById.mockResolvedValue({ id: 'room_1', securityRating: 'C' });

      await service.joinCombat('char_1', 'acc_1', 'room_1');

      expect(mockEcsRegistry.createEntity).toHaveBeenCalled();
      expect(mockEcsRegistry.addComponent).toHaveBeenCalledWith(
        'entity-1', 
        'player_id', 
        expect.objectContaining({ characterId: 'char_1' })
      );
    });
  });

  describe('performMove', () => {
    it('dispatches move and syncs db', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockEcsRegistry.getEntityByComponent.mockReturnValue('entity-1');
      mockEcsRegistry.getEntitiesWith.mockReturnValue(['entity-1']);
      mockEcsRegistry.getComponent.mockImplementation((id: string, type: string) => {
        if (type === 'player_id') return { characterId: 'char_1' };
        if (type === 'health') return { current: 50 };
        if (type === 'stun') return { current: 50 };
        if (type === 'mana') return { current: 50 };
        return undefined;
      });

      await service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'mob_1', move: 'attack' });

      expect(mockMoveDispatcher.dispatch).toHaveBeenCalledWith('attack', 'entity-1', 'mob_1', { registry: mockEcsRegistry });
      expect(mockCharRepo.updateCharacter).toHaveBeenCalledWith('char_1', {
        currentHp: 50,
        currentStun: 50,
        currentMana: 50,
      });
    });

    it('throws error if attacking while not in combat', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockEcsRegistry.getEntityByComponent.mockReturnValue(undefined); // Not in combat

      await expect(service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'mob_1', move: 'attack' }))
        .rejects.toThrow(ValidationError);
    });
  });
});
