import { AuthService } from '../../src/domains/auth/auth.service';
import { CharacterService } from '../../src/domains/character/character.service';
import { CharacterRepository } from '../../src/domains/character/character.repository';
import { WorldRepository } from '../../src/domains/world/world.repository';
import { AuthRepository } from '../../src/domains/auth/auth.repository';

describe('End-to-End Registration and Character Creation Flow', () => {
  let authService: AuthService;
  let characterService: CharacterService;
  
  // Mocks
  let mockAuthRepo: any;
  let mockCharRepo: any;
  let mockWorldRepo: any;
  let mockJwt: any;

  beforeEach(() => {
    mockAuthRepo = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    mockCharRepo = {
      create: jest.fn(),
      findByAccountAndName: jest.fn(),
    };

    mockWorldRepo = {
      findRoomBySlug: jest.fn(),
    };

    mockJwt = {
      sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    };

    authService = new AuthService(mockAuthRepo as any, mockJwt as any);
    characterService = new CharacterService(mockCharRepo as any, mockWorldRepo as any);
  });

  it('successfully completes the full registration and character creation flow', async () => {
    // --- Step 1: Account Registration ---
    const registrationInput = {
      username: 'newrunner',
      email: 'runner@sprawl.net',
      password: 'secure-password-123'
    };

    mockAuthRepo.findByUsername.mockResolvedValue(null);
    mockAuthRepo.findByEmail.mockResolvedValue(null);
    mockAuthRepo.create.mockResolvedValue({
      id: 'new-acc-id-001',
      username: registrationInput.username,
      email: registrationInput.email
    });

    const authResult = await authService.register(registrationInput);
    
    expect(authResult.token).toBe('mocked-jwt-token');
    expect(mockAuthRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      username: registrationInput.username,
      email: registrationInput.email
    }));

    // --- Step 2: Character Creation ---
    const characterInput = {
      accountId: 'new-acc-id-001', // ID from the registered account
      name: 'Razor-Edge',
      faction: 'shadow' as const,
      race: 'surge' as const, // SURGE race has different biosync and stat ranges
      className: 'street-samurai' as const,
      body: 4,
      agility: 6,
      dexterity: 5,
      strength: 4,
      logic: 3,
      intuition: 5,
      willpower: 3,
      charisma: 3,
      luck: 3,
    };

    mockCharRepo.findByAccountAndName.mockResolvedValue(null);
    mockWorldRepo.findRoomBySlug.mockResolvedValue({ 
      id: 'room-shadow-001', 
      slug: 'shadow-hub-center' 
    });
    
    mockCharRepo.create.mockImplementation((data: any) => Promise.resolve({
      ...data,
      id: 'new-char-id-999'
    }));

    const characterResult = await characterService.createCharacter(characterInput);

    // --- Step 3: Verification ---
    expect(characterResult.id).toBe('new-char-id-999');
    expect(characterResult.accountId).toBe('new-acc-id-001');
    expect(characterResult.name).toBe('Razor-Edge');
    
    // Check SURGE specific stats (Biosync should be 6.0 based on races.ts)
    expect(characterResult.biosync).toBe(6.0);
    
    // Check starting room assignment
    expect(characterResult.currentRoomId).toBe('room-shadow-001');
    
    // Check if repository was called correctly
    expect(mockCharRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Razor-Edge',
      accountId: 'new-acc-id-001',
      isCreationComplete: true
    }));
  });

  it('fails character creation if karma limit is exceeded', async () => {
    const highKarmaInput = {
      accountId: 'new-acc-id-001',
      name: 'Too-Powerful',
      faction: 'shadow' as const,
      race: 'human' as const,
      className: 'street-samurai' as const,
      body: 6,
      agility: 6,
      dexterity: 6,
      strength: 6,
      logic: 6,
      intuition: 6,
      willpower: 6,
      charisma: 6,
      luck: 7,
    };

    // Human base stats are all 1.
    // Raising 8 stats to 6 and 1 to 7 costs way more than 50 karma.
    
    await expect(characterService.createCharacter(highKarmaInput))
      .rejects.toThrow(/exceeds the starting limit/);
  });
});
