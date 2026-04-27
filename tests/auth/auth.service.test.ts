import { AuthService } from '../../src/domains/auth/auth.service';
import { ConflictError, UnauthorizedError } from '../../src/shared/errors';

const mockRepository = {
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ accountId: 'acc_1', username: 'testuser' }),
};

const service = new AuthService(mockRepository as any, mockJwt as any);

beforeEach(() => jest.clearAllMocks());

describe('AuthService.register', () => {
  it('returns a token on successful registration', async () => {
    mockRepository.findByUsername.mockResolvedValue(null);
    mockRepository.findByEmail.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue({ id: 'acc_1', username: 'testuser' });

    const result = await service.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.token).toBe('mock.jwt.token');
    expect(mockRepository.create).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictError if username already exists', async () => {
    mockRepository.findByUsername.mockResolvedValue({ id: 'acc_1' });

    await expect(
      service.register({ username: 'testuser', email: 'new@example.com', password: 'pass' })
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError if email already exists', async () => {
    mockRepository.findByUsername.mockResolvedValue(null);
    mockRepository.findByEmail.mockResolvedValue({ id: 'acc_2' });

    await expect(
      service.register({ username: 'newuser', email: 'taken@example.com', password: 'password123' })
    ).rejects.toThrow(ConflictError);
  });
});

describe('AuthService.login', () => {
  it('throws UnauthorizedError for unknown username', async () => {
    mockRepository.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({ username: 'nobody', password: 'pass' })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('returns a token on successful login', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('correctpass', 4); // low rounds for test speed
    mockRepository.findByUsername.mockResolvedValue({
      id: 'acc_1',
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: hash,
    });

    const result = await service.login({ username: 'testuser', password: 'correctpass' });
    expect(result.token).toBe('mock.jwt.token');
  });

  it('throws UnauthorizedError for wrong password', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('correctpass', 4);
    mockRepository.findByUsername.mockResolvedValue({
      id: 'acc_1',
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: hash,
    });

    await expect(
      service.login({ username: 'testuser', password: 'wrongpass' })
    ).rejects.toThrow(UnauthorizedError);
  });
});
