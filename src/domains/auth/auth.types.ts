export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  accountId: string;
  username: string;
}

export interface AccountRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

import { AuthPayload } from '../../shared/types';

export interface JwtSigner {
  sign(payload: AuthPayload): string;
  verify(token: string): AuthPayload;
}

export interface IAuthRepository {
  findByUsername(username: string): Promise<AccountRecord | null>;
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  create(data: { username: string; email: string; passwordHash: string }): Promise<AccountRecord>;
}
