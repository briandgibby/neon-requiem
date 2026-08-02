import { CombatService } from '../../src/domains/combat/combat.service';
import { MAX_AP, COMMAND_AP_PENALTY } from '../../src/shared/constants';
import { NotFoundError, ValidationError } from '../../src/shared/errors';

describe('CombatService', () => {
  let service: CombatService;
  let mockCombatRepo: any;
  let mockCharRepo: any;
  let mockWorldRepo: any;
  let mockSafeZonePolicy: any;
  let mockMobRepo: any;
  let mockMagicService: any;
  let mockMatrixService: any;
  let mockEcsRegistry: any;
  let mockMoveDispatcher: any;
  let mockInstanceRepo: any;

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
    mockSafeZonePolicy = {
      isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
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
    mockInstanceRepo = {
      escalateAlertFromRoom: jest.fn().mockResolvedValue('not-in-instance'),
    };
    service = new CombatService(
      mockCombatRepo,
      mockCharRepo as any,
      mockWorldRepo as any,
      mockSafeZonePolicy as any,
      mockMobRepo as any,
      mockMagicService as any,
      mockMatrixService as any,
      mockEcsRegistry as any,
      mockMoveDispatcher as any,
      { syncAllPlayers: jest.fn().mockResolvedValue(undefined) } as any,
      mockInstanceRepo as any,
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
    currentAp: MAX_AP,
    apRecoveryTicks: 0,
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

    it('restores zero-AP characters into recovery instead of action-locking them', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue({
        ...mockCharacter,
        currentAp: 0,
        apRecoveryTicks: 3,
      });
      mockEcsRegistry.getEntityByComponent.mockReturnValue(undefined);

      await service.joinCombat('char_1', 'acc_1', 'room_1');

      expect(mockEcsRegistry.addComponent).toHaveBeenCalledWith('entity-1', 'ap', expect.objectContaining({
        current: 0,
        recoveryTicks: 3,
      }));
      expect(mockEcsRegistry.addComponent).toHaveBeenCalledWith(
        'entity-1',
        'combat_status',
        expect.objectContaining({ state: 'recovering' }),
      );
    });
  });

  describe('triggerSecurityAlarm', () => {
    it('does not create or mutate a combat session in an effective safe zone', async () => {
      mockSafeZonePolicy.isEffectiveSafeZone.mockResolvedValue(true);

      const result = await service.triggerSecurityAlarm('room_1');

      expect(result).toEqual({ triggered: false, reason: 'safe_zone' });
      expect(mockEcsRegistry.getEntityByComponent).not.toHaveBeenCalled();
      expect(mockEcsRegistry.createEntity).not.toHaveBeenCalled();
      expect(mockEcsRegistry.addComponent).not.toHaveBeenCalled();
      expect(mockEcsRegistry.getComponent).not.toHaveBeenCalled();
      expect(mockWorldRepo.updateRoom).not.toHaveBeenCalled();
    });

    it('throws NotFoundError and does not create a combat session when room is missing', async () => {
      mockSafeZonePolicy.isEffectiveSafeZone.mockRejectedValue(new NotFoundError('Room'));

      await expect(service.triggerSecurityAlarm('missing_room')).rejects.toThrow(NotFoundError);

      expect(mockEcsRegistry.getEntityByComponent).not.toHaveBeenCalled();
      expect(mockEcsRegistry.createEntity).not.toHaveBeenCalled();
      expect(mockEcsRegistry.addComponent).not.toHaveBeenCalled();
      expect(mockEcsRegistry.getComponent).not.toHaveBeenCalled();
    });

    it('triggers RED alert when safe zone override is active', async () => {
      const session = {
        roomId: 'room_1',
        securityRating: 'A',
        alarmState: 'GREEN',
        turnsUntilReinforcements: null,
        backupCalled: false,
        tick: 0,
      };
      mockSafeZonePolicy.isEffectiveSafeZone.mockResolvedValue(false);
      mockEcsRegistry.getEntityByComponent.mockReturnValue('session-1');
      mockEcsRegistry.getComponent.mockReturnValue(session);

      const result = await service.triggerSecurityAlarm('room_1');

      expect(result).toEqual({ triggered: true });
      expect(session.alarmState).toBe('RED');
      expect(session.backupCalled).toBe(true);
      expect(session.turnsUntilReinforcements).toBe(1);
    });

    it('triggers RED alert in a non-safe-zone room', async () => {
      const session = {
        roomId: 'room_1',
        securityRating: 'C',
        alarmState: 'GREEN',
        turnsUntilReinforcements: null,
        backupCalled: false,
        tick: 0,
      };
      mockSafeZonePolicy.isEffectiveSafeZone.mockResolvedValue(false);
      mockEcsRegistry.getEntityByComponent.mockReturnValue('session-1');
      mockEcsRegistry.getComponent.mockReturnValue(session);

      const result = await service.triggerSecurityAlarm('room_1');

      expect(result).toEqual({ triggered: true });
      expect(session.alarmState).toBe('RED');
      expect(session.backupCalled).toBe(true);
      expect(session.turnsUntilReinforcements).toBe(1);
    });

    it('escalates the owning MissionInstance from the physical alert room', async () => {
      const session = {
        roomId: 'room_1', securityRating: 'A', alarmState: 'GREEN',
        turnsUntilReinforcements: null, backupCalled: false, tick: 0,
      };
      mockEcsRegistry.getEntityByComponent.mockReturnValue('session-1');
      mockEcsRegistry.getComponent.mockReturnValue(session);

      await service.triggerSecurityAlarm('room_1');

      expect(mockInstanceRepo.escalateAlertFromRoom).toHaveBeenCalledWith('room_1', 'RED');
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
      expect(service['syncCoordinator'].syncAllPlayers).toHaveBeenCalled();
    });

    it('throws error if attacking while not in combat', async () => {
      mockCharRepo.findByIdAndAccount.mockResolvedValue(mockCharacter);
      mockEcsRegistry.getEntityByComponent.mockReturnValue(undefined); // Not in combat

      await expect(service.performMove({ characterId: 'char_1', accountId: 'acc_1', targetId: 'mob_1', move: 'attack' }))
        .rejects.toThrow(ValidationError);
    });
  });
});
