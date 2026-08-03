import { WorldService } from '../../src/domains/world/world.service';
import { isEffectiveSafeZone } from '../../src/domains/world/world.types';
import { Direction } from '../../src/shared/types';
import { NotFoundError, ValidationError } from '../../src/shared/errors';

const mockWorldRepo = {
  findRoomBySlug: jest.fn(),
  findRoomById: jest.fn(),
  findZoneBySlug: jest.fn(),
  findZoneById: jest.fn(),
  getAllRooms: jest.fn(),
  updateRoom: jest.fn(),
  updateCharacterLocation: jest.fn(),
};

const mockCharRepo = {
  findById: jest.fn(),
  findByIdAndAccount: jest.fn(),
  findByIdWithInventory: jest.fn(),
  updateInventoryItem: jest.fn(),
};

const mockPresence = {
  moveCharacterById: jest.fn(),
};

const service = new WorldService(mockWorldRepo as any, mockCharRepo as any, mockPresence as any);

beforeEach(() => jest.clearAllMocks());

describe('isEffectiveSafeZone', () => {
  it('returns true when safe zone protection is active', () => {
    expect(isEffectiveSafeZone({
      isSafeZone: true,
      safeZoneOverrideActive: false,
    })).toBe(true);
  });

  it('returns false when room is not a safe zone', () => {
    expect(isEffectiveSafeZone({
      isSafeZone: false,
      safeZoneOverrideActive: false,
    })).toBe(false);
  });

  it('returns false when safe zone override is active', () => {
    expect(isEffectiveSafeZone({
      isSafeZone: true,
      safeZoneOverrideActive: true,
    })).toBe(false);
  });
});

describe('WorldService.getRoom', () => {
  it('returns room when found by slug', async () => {
    const room = { id: 'room_1', slug: 'room-1' };
    mockWorldRepo.findRoomBySlug.mockResolvedValue(room);

    const result = await service.getRoom('room-1');
    expect(result).toEqual(room);
  });

  it('returns room when found by id', async () => {
    const room = { id: 'room_1', slug: 'room-1' };
    mockWorldRepo.findRoomBySlug.mockResolvedValue(null);
    mockWorldRepo.findRoomById.mockResolvedValue(room);

    const result = await service.getRoom('room_1');
    expect(result).toEqual(room);
  });

  it('throws NotFoundError when room does not exist', async () => {
    mockWorldRepo.findRoomBySlug.mockResolvedValue(null);
    mockWorldRepo.findRoomById.mockResolvedValue(null);

    await expect(service.getRoom('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('WorldService.moveCharacter', () => {
  const characterId = 'char_1';
  const accountId = 'acc_1';
  const currentRoomId = 'room_1';
  const nextRoomSlug = 'room-2';
  const nextRoomId = 'room_2';

  it('successfully moves character to adjacent room', async () => {
    mockCharRepo.findByIdAndAccount.mockResolvedValue({ id: characterId, accountId, currentRoomId });
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: currentRoomId,
      exits: { north: nextRoomSlug }
    });
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: nextRoomId, slug: nextRoomSlug });

    const result = await service.moveCharacter(characterId, accountId, 'north' as Direction);

    expect(result.success).toBe(true);
    expect(result.room?.id).toBe(nextRoomId);
    expect(mockWorldRepo.updateCharacterLocation).toHaveBeenCalledWith(characterId, nextRoomId);
  });

  it('returns error if no exit in that direction', async () => {
    mockCharRepo.findByIdAndAccount.mockResolvedValue({ id: characterId, accountId, currentRoomId });
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: currentRoomId,
      exits: { south: 'other-room' }
    });

    const result = await service.moveCharacter(characterId, accountId, 'north' as Direction);

    expect(result.success).toBe(false);
    expect(result.error).toContain('no exit to the north');
    expect(mockWorldRepo.updateCharacterLocation).not.toHaveBeenCalled();
  });

  it('throws NotFoundError if character not found or account mismatch', async () => {
    mockCharRepo.findByIdAndAccount.mockResolvedValue(null);

    await expect(service.moveCharacter(characterId, accountId, 'north' as Direction))
      .rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError if character has no currentRoomId', async () => {
    mockCharRepo.findByIdAndAccount.mockResolvedValue({ id: characterId, accountId, currentRoomId: null });

    await expect(service.moveCharacter(characterId, accountId, 'north' as Direction))
      .rejects.toThrow(ValidationError);
  });

  it('returns error if next room does not exist', async () => {
    mockCharRepo.findByIdAndAccount.mockResolvedValue({ id: characterId, accountId, currentRoomId });
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: currentRoomId,
      exits: { north: 'missing-room' }
    });
    mockWorldRepo.findRoomBySlug.mockResolvedValue(null);

    const result = await service.moveCharacter(characterId, accountId, 'north' as Direction);

    expect(result.success).toBe(false);
    expect(result.error).toContain("room 'missing-room' does not exist");
  });
});

describe('WorldService.isEffectiveSafeZone', () => {
  it('returns true for effective safe zone', async () => {
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: 'room_1',
      isSafeZone: true,
      safeZoneOverrideActive: false,
    });

    const result = await service.isEffectiveSafeZone('room_1');

    expect(result).toBe(true);
    expect(mockWorldRepo.findRoomById).toHaveBeenCalledWith('room_1');
  });

  it('returns false when room is not a safe zone', async () => {
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: 'room_1',
      isSafeZone: false,
      safeZoneOverrideActive: false,
    });

    const result = await service.isEffectiveSafeZone('room_1');

    expect(result).toBe(false);
  });

  it('returns false when safe zone override is active', async () => {
    mockWorldRepo.findRoomById.mockResolvedValue({
      id: 'room_1',
      isSafeZone: true,
      safeZoneOverrideActive: true,
    });

    const result = await service.isEffectiveSafeZone('room_1');

    expect(result).toBe(false);
  });

  it('throws NotFoundError when room does not exist', async () => {
    mockWorldRepo.findRoomById.mockResolvedValue(null);

    await expect(service.isEffectiveSafeZone('missing_room')).rejects.toThrow(NotFoundError);
  });
});
