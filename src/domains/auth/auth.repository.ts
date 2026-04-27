import { PrismaClient } from '@prisma/client';
import { AccountRecord } from './auth.types';

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByUsername(username: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { username } });
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { id } });
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<AccountRecord> {
    return this.db.account.create({ data });
  }
}
