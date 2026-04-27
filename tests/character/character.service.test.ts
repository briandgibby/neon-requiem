import { CharacterService } from '../../src/domains/character/character.service';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors';

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndAccount: jest.fn(),
  findByAccountId: jest.fn(),
  findByAccountAndName: jest.fn(),
  updateCharacter: jest.fn(),
  findByIdWithInventory: jest.fn(),
  getInventoryItem: jest.fn(),
  updateInventoryItem: jest.fn(),
};

const mockWorldRepo = {
  findRoomBySlug: jest.fn(),
  findRoomById: jest.fn(),
  findZoneBySlug: jest.fn(),
  findZoneById: jest.fn(),
  getAllRooms: jest.fn(),
  updateRoom: jest.fn(),
  updateCharacterLocation: jest.fn(),
};

const service = new CharacterService(mockRepo as any, mockWorldRepo as any);

describe('CharacterService.createCharacter', () => {
  const baseInput = {
    accountId: 'acc_1',
    name: 'Kira',
    faction: 'shadow' as const,
    race: 'human' as const,
    className: 'street-samurai' as const,
    body: 3,
    agility: 3,
    dexterity: 3,
    strength: 3,
    logic: 3,
    intuition: 3,
    willpower: 3,
    charisma: 3,
    luck: 3,
  };

  it('creates a valid human street-samurai', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: 'room_1' });
    mockRepo.create.mockImplementation(data => Promise.resolve({ ...data, id: 'char_1' }));

    const result = await service.createCharacter(baseInput);

    expect(result.name).toBe('Kira');
    expect(result.body).toBe(3);
    expect(result.isCreationComplete).toBe(true);
  });

  it('sets biosync from race definition', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: 'room_1' });
    mockRepo.create.mockImplementation(data => Promise.resolve({ ...data, id: 'char_2' }));

    const result = await service.createCharacter({ ...baseInput, race: 'elf', charisma: 4 });
    expect(result.biosync).toBe(7.0);
  });

  it('throws ConflictError if character name already exists for account', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue({ id: 'existing' });

    await expect(service.createCharacter(baseInput)).rejects.toThrow(ConflictError);
  });

  it('sets luckPool equal to luck at creation', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: 'room_1' });
    mockRepo.create.mockImplementation(data => Promise.resolve({ ...data }));

    const result = await service.createCharacter(baseInput);
    expect(result.luckPool).toBe(result.luck);
  });

  it('sets magic=0 and resonance=null for awakened class', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: 'room_1' });
    mockRepo.create.mockImplementation(data => Promise.resolve({ ...data }));

    const result = await service.createCharacter({ ...baseInput, className: 'mage-hermetic', mentorSpirit: 'bear' });
    expect(result.magic).toBe(0);
    expect(result.resonance).toBeNull();
  });

  it('sets resonance=0 and magic=null for matrix class', async () => {
    mockRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ id: 'room_1' });
    mockRepo.create.mockImplementation(data => Promise.resolve({ ...data }));

    const result = await service.createCharacter({ ...baseInput, className: 'decker' });
    expect(result.resonance).toBe(0);
    expect(result.magic).toBeNull();
  });

  it('throws ValidationError if class requires mentorSpirit but none provided', async () => {
    await expect(service.createCharacter({ ...baseInput, className: 'shaman' }))
      .rejects.toThrow(ValidationError);
  });
});

describe('CharacterService.getCharacter', () => {
  it('returns character when found and matches account', async () => {
    const char = { id: 'char_1', name: 'Kira', accountId: 'acc_1' };
    mockRepo.findByIdAndAccount.mockResolvedValue(char);

    const result = await service.getCharacter('char_1', 'acc_1');
    expect(result).toEqual(char);
  });

  it('throws NotFoundError when character does not exist or account mismatch', async () => {
    mockRepo.findByIdAndAccount.mockResolvedValue(null);

    await expect(service.getCharacter('missing', 'acc_1')).rejects.toThrow(NotFoundError);
  });
});

describe('CharacterService.listCharacters', () => {
  it('returns all characters for account', async () => {
    const chars = [{ id: 'char_1' }, { id: 'char_2' }];
    mockRepo.findByAccountId.mockResolvedValue(chars);

    const result = await service.listCharacters('acc_1');
    expect(result).toHaveLength(2);
  });
});
