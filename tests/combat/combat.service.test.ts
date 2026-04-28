import { CombatService } from '../../src/domains/combat/combat.service';
import { MAX_AP, COMMAND_AP_PENALTY } from '../../src/shared/constants';
import { ValidationError } from '../../src/shared/errors';

describe('CombatService', () => {
  let service: CombatService;
  let mockCombatRepo: any;
  let mockCharRepo: any;
  let mockWorldRepo: any;
  let mockMobRepo: any;

  beforeEach(() => {
    mockCombatRepo = {
      getSessionByRoom: jest.fn(),
      saveSession: jest.fn(),
      findSessionByParticipant: jest.fn(),
    };
    mockCharRepo = {
      findById: jest.fn(),
      findByIdAndAccount: jest.fn(),
    };
    mockWorldRepo = {
      findRoomById: jest.fn(),
      updateRoom: jest.fn(),
    };
    mockMobRepo = {
      findBySlug: jest.fn(),
    };
    const mockMagicService = {
      castSpell: jest.fn(),
    };
    const mockMatrixService = {
      // Add methods as needed
    };
    service = new CombatService(
      mockCombatRepo, 
      mockCharRepo, 
      mockWorldRepo, 
      mockMobRepo, 
      mockMagicService as any, 
      mockMatrixService as any
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
    it('creates a new session if none exists and populates stats', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockCombatRepo.getSessionByRoom.mockResolvedValue(null);
      mockWorldRepo.findRoomById.mockResolvedValue({ id: 'room_1', securityRating: 'C' });

      await service.joinCombat('char_1', 'acc_1', 'room_1');

      expect(mockCombatRepo.saveSession).toHaveBeenCalledWith(expect.objectContaining({
        roomId: 'room_1',
        participants: expect.objectContaining({
          'char_1': expect.objectContaining({
            agility: 5,
            strength: 5,
          })
        })
      }));
    });
  });

  describe('AP and Recovery', () => {
    it('depletes AP on move and enters recovery at 0', async () => {
      const actor = { 
        ...mockCharacter, id: 'char_1', ap: 1, maxAp: 6, status: 'idle', recoveryTicks: 0, isPetActive: false
      };
      const target = { ...mockCharacter, id: 'mob_1', name: 'Mob', type: 'npc' };
      const session = { 
        participants: { 'char_1': actor, 'mob_1': target },
        roomId: 'room_1'
      };
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockCombatRepo.findSessionByParticipant.mockResolvedValue(session);

      await service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'mob_1', move: 'attack' });

      expect(actor.ap).toBe(0);
      expect(actor.status).toBe('recovering');
      expect(actor.recoveryTicks).toBeGreaterThan(0);
    });

    it('throws error if attacking while recovering', async () => {
      const participant = { ...mockCharacter, status: 'recovering', ap: 0 };
      const session = { participants: { 'char_1': participant } };
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockCombatRepo.findSessionByParticipant.mockResolvedValue(session);

      await expect(service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'mob_1', move: 'attack' }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('On Guard', () => {
    it('sets status to guarding', async () => {
      const participant = { ...mockCharacter, ap: 6, status: 'idle' };
      const session = { participants: { 'char_1': participant }, roomId: 'room_1' };
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockCombatRepo.findSessionByParticipant.mockResolvedValue(session);

      await service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'char_1', move: 'guard' });

      expect(participant.status).toBe('guarding');
      expect(participant.ap).toBe(5);
    });
  });
});
