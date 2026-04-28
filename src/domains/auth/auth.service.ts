import bcrypt from 'bcrypt';
import { getAuthMiddleware } from './auth.middleware';
import { RegisterInput, LoginInput, LoginResult, JwtSigner, IAuthRepository } from './auth.types';
import { ConflictError, UnauthorizedError } from '../../shared/errors';
import { BCRYPT_ROUNDS } from '../../shared/constants';

export class AuthService {
  constructor(
    private readonly repo: IAuthRepository,
    private readonly jwt: JwtSigner
  ) {}

  async register(input: RegisterInput): Promise<LoginResult> {
    const existingUsername = await this.repo.findByUsername(input.username);
    if (existingUsername) throw new ConflictError('Username already taken');

    const existingEmail = await this.repo.findByEmail(input.email);
    if (existingEmail) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const account = await this.repo.create({
      username: input.username,
      email: input.email,
      passwordHash,
    });

    const token = this.jwt.sign({ accountId: account.id, username: account.username });
    return { token, accountId: account.id, username: account.username };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const account = await this.repo.findByUsername(input.username);

    // Always run bcrypt to prevent timing-based username enumeration
    const DUMMY_HASH = '$2b$12$invalidhashpaddingtomatchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = account
      ? await bcrypt.compare(input.password, account.passwordHash)
      : await bcrypt.compare(input.password, DUMMY_HASH);

    if (!account || !valid) throw new UnauthorizedError('Invalid username or password');

    const token = this.jwt.sign({ accountId: account.id, username: account.username });
    return { token, accountId: account.id, username: account.username };
  }

  verifyToken(token: string): import('../../shared/types').AuthPayload {
    return this.jwt.verify(token);
  }

  getAuthMiddleware() {
    return getAuthMiddleware(this);
  }
}
