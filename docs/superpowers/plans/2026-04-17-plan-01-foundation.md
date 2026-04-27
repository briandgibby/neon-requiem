# Neon Requiem — Plan 01: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete project structure, configure PostgreSQL + Prisma, implement JWT authentication, establish the WebSocket hub, and get the game tick loop running — so every subsequent plan has a working foundation to build on.

**Architecture:** Modular monolith with strict domain boundaries. Each domain under `src/domains/` exposes only a `.service.ts` interface to the rest of the app. The `engine/` module owns the game loop and WebSocket hub. All state is PostgreSQL-backed via Prisma; no flat files.

**Tech Stack:** Node.js 22 LTS, TypeScript, Fastify, Socket.IO, PostgreSQL 16, Prisma, pgBouncer, Jest, PM2

---

## File Map

```
neon-requiem/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── prisma/
│   └── schema.prisma              # DB schema — accounts table only for this plan
├── src/
│   ├── shared/
│   │   ├── types.ts               # Shared TypeScript types
│   │   ├── constants.ts           # Game constants (TICK_RATE, etc.)
│   │   └── errors.ts              # Typed error classes
│   ├── engine/
│   │   ├── game-loop.ts           # Tick loop (setInterval, ~1/sec)
│   │   └── socket-hub.ts          # Socket.IO server, connection registry
│   ├── domains/
│   │   └── auth/
│   │       ├── auth.service.ts    # register(), login(), verifyToken()
│   │       ├── auth.repository.ts # DB queries — accounts table
│   │       ├── auth.types.ts      # AuthPayload, LoginResult, etc.
│   │       └── auth.routes.ts     # POST /auth/register, POST /auth/login
│   └── server.ts                  # Fastify + Socket.IO bootstrap
└── tests/
    ├── auth/
    │   └── auth.service.test.ts
    └── engine/
        └── game-loop.test.ts
```

---

## Task 1: Initialize Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize npm project**

```bash
cd /mnt/c/Users/brian/git/neon-requiem
npm init -y
```

Expected: `package.json` created.

- [ ] **Step 2: Install dependencies**

```bash
npm install fastify @fastify/cors @fastify/jwt socket.io @prisma/client bcrypt zod
npm install -D typescript ts-node @types/node @types/bcrypt tsx prisma jest ts-jest @types/jest
```

Expected: `node_modules/` created, no peer dep errors.

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write .gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: Write .env.example**

```
DATABASE_URL=postgresql://user:password@localhost:5432/neon_requiem
SHADOW_DATABASE_URL=postgresql://user:password@localhost:5432/neon_requiem_shadow
JWT_SECRET=change_me_to_a_long_random_string
PORT=3000
TICK_RATE_MS=1000
```

- [ ] **Step 6: Add scripts to package.json**

Edit `package.json` to add:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --runInBand",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.ts"]
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example
git commit -m "chore: initialize Node.js + TypeScript project"
```

---

## Task 2: Prisma + PostgreSQL Setup

**Files:**
- Create: `prisma/schema.prisma`

**Prerequisite:** PostgreSQL 16 running locally. Create the database:
```bash
createdb neon_requiem
createdb neon_requiem_shadow
```

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 2: Copy .env.example to .env and fill in your DATABASE_URL**

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and SHADOW_DATABASE_URL to your local Postgres credentials
```

- [ ] **Step 3: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}

model Account {
  id           String   @id @default(cuid())
  username     String   @unique
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("accounts")
}
```

- [ ] **Step 4: Run migration**

```bash
npm run db:migrate -- --name init-accounts
```

Expected: `prisma/migrations/` directory created, `accounts` table exists in DB.

- [ ] **Step 5: Generate Prisma client**

```bash
npm run db:generate
```

Expected: `node_modules/@prisma/client` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/
git commit -m "feat: add Prisma schema with accounts table"
```

---

## Task 3: Shared Types, Constants, and Errors

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/errors.ts`

- [ ] **Step 1: Write src/shared/constants.ts**

```typescript
export const TICK_RATE_MS = Number(process.env.TICK_RATE_MS) || 1000;
export const JWT_EXPIRY = '24h';
export const BCRYPT_ROUNDS = 12;
export const MAX_LEVEL = 25;
export const BASE_CLASS_LEVEL_CAP = 8;
export const TIER_2_LEVEL = 15;
export const TIER_3_LEVEL = 25;
export const PVP_PROTECTION_LEVEL = 8;
```

- [ ] **Step 2: Write src/shared/types.ts**

```typescript
export type Faction = 'shadow' | 'corp';

export type SecurityRating = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'Z' | 'mission';

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary' | 'unique';

export interface AuthPayload {
  accountId: string;
  username: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

- [ ] **Step 3: Write src/shared/errors.ts**

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 422);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types, constants, and error classes"
```

---

## Task 4: Auth Domain

**Files:**
- Create: `src/domains/auth/auth.types.ts`
- Create: `src/domains/auth/auth.repository.ts`
- Create: `src/domains/auth/auth.service.ts`
- Create: `src/domains/auth/auth.routes.ts`
- Create: `tests/auth/auth.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/auth/auth.service.test.ts`:

```typescript
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
});

describe('AuthService.login', () => {
  it('throws UnauthorizedError for unknown username', async () => {
    mockRepository.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({ username: 'nobody', password: 'pass' })
    ).rejects.toThrow(UnauthorizedError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/auth/auth.service.test.ts
```

Expected: FAIL — `Cannot find module '../../src/domains/auth/auth.service'`

- [ ] **Step 3: Write src/domains/auth/auth.types.ts**

```typescript
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
```

- [ ] **Step 4: Write src/domains/auth/auth.repository.ts**

```typescript
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
```

- [ ] **Step 5: Write src/domains/auth/auth.service.ts**

```typescript
import bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RegisterInput, LoginInput, LoginResult } from './auth.types';
import { AuthPayload } from '../../shared/types';
import { ConflictError, UnauthorizedError } from '../../shared/errors';
import { BCRYPT_ROUNDS } from '../../shared/constants';

interface JwtSigner {
  sign(payload: AuthPayload): string;
  verify(token: string): AuthPayload;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
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
    if (!account) throw new UnauthorizedError('Invalid username or password');

    const valid = await bcrypt.compare(input.password, account.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid username or password');

    const token = this.jwt.sign({ accountId: account.id, username: account.username });
    return { token, accountId: account.id, username: account.username };
  }

  verifyToken(token: string): AuthPayload {
    return this.jwt.verify(token);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/auth/auth.service.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 7: Write src/domains/auth/auth.routes.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AppError } from '../../shared/errors';

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    try {
      const result = await authService.register(body);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    try {
      const result = await authService.login(body);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add src/domains/auth/ tests/auth/
git commit -m "feat: implement auth domain — register, login, JWT"
```

---

## Task 5: Game Loop (Engine)

**Files:**
- Create: `src/engine/game-loop.ts`
- Create: `tests/engine/game-loop.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/engine/game-loop.test.ts`:

```typescript
import { GameLoop } from '../../src/engine/game-loop';

describe('GameLoop', () => {
  it('calls the tick handler on each tick', async () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    const loop = new GameLoop(100, handler);

    loop.start();
    jest.advanceTimersByTime(350);
    loop.stop();

    expect(handler).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('does not tick after stop() is called', () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    const loop = new GameLoop(100, handler);

    loop.start();
    jest.advanceTimersByTime(150);
    loop.stop();
    jest.advanceTimersByTime(300);

    expect(handler).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('throws if start() is called while already running', () => {
    const loop = new GameLoop(100, jest.fn());
    loop.start();
    expect(() => loop.start()).toThrow('GameLoop is already running');
    loop.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/engine/game-loop.test.ts
```

Expected: FAIL — `Cannot find module '../../src/engine/game-loop'`

- [ ] **Step 3: Write src/engine/game-loop.ts**

```typescript
export type TickHandler = (tick: number) => void | Promise<void>;

export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly onTick: TickHandler
  ) {}

  start(): void {
    if (this.intervalId !== null) throw new Error('GameLoop is already running');
    this.intervalId = setInterval(() => {
      this.tickCount++;
      void this.onTick(this.tickCount);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  get ticks(): number {
    return this.tickCount;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/engine/game-loop.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game-loop.ts tests/engine/game-loop.test.ts
git commit -m "feat: implement game loop engine with tick handler"
```

---

## Task 6: WebSocket Hub

**Files:**
- Create: `src/engine/socket-hub.ts`

- [ ] **Step 1: Write src/engine/socket-hub.ts**

```typescript
import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { AuthService } from '../domains/auth/auth.service';
import { UnauthorizedError } from '../shared/errors';

export interface ConnectedClient {
  socket: Socket;
  accountId: string;
  username: string;
}

export class SocketHub {
  private readonly io: SocketServer;
  private readonly clients = new Map<string, ConnectedClient>();

  constructor(httpServer: HttpServer, private readonly authService: AuthService) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: '*' },
    });

    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new UnauthorizedError('No token provided'));
      try {
        const payload = this.authService.verifyToken(token);
        socket.data.accountId = payload.accountId;
        socket.data.username = payload.username;
        next();
      } catch {
        next(new UnauthorizedError('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      const client: ConnectedClient = {
        socket,
        accountId: socket.data.accountId as string,
        username: socket.data.username as string,
      };
      this.clients.set(client.accountId, client);

      socket.on('disconnect', () => {
        this.clients.delete(client.accountId);
      });
    });
  }

  broadcast(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  sendTo(accountId: string, event: string, data: unknown): void {
    this.clients.get(accountId)?.socket.emit(event, data);
  }

  get connectedCount(): number {
    return this.clients.size;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/socket-hub.ts
git commit -m "feat: implement WebSocket hub with JWT auth middleware"
```

---

## Task 7: Server Bootstrap

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Write src/server.ts**

```typescript
import Fastify from 'fastify';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { TICK_RATE_MS } from './shared/constants';
import { GameLoop } from './engine/game-loop';
import { SocketHub } from './engine/socket-hub';
import { AuthRepository } from './domains/auth/auth.repository';
import { AuthService } from './domains/auth/auth.service';
import { registerAuthRoutes } from './domains/auth/auth.routes';

async function bootstrap() {
  const db = new PrismaClient();
  const app = Fastify({ logger: true });
  const httpServer = createServer(app.server);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');

  await app.register(import('@fastify/cors'));

  const jwtSigner = {
    sign: (payload: object) => {
      const jwt = require('jsonwebtoken');
      return jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
    },
    verify: (token: string) => {
      const jwt = require('jsonwebtoken');
      return jwt.verify(token, jwtSecret) as any;
    },
  };

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo, jwtSigner);
  registerAuthRoutes(app, authService);

  const socketHub = new SocketHub(httpServer, authService);

  const gameLoop = new GameLoop(TICK_RATE_MS, (tick) => {
    if (tick % 60 === 0) {
      app.log.info({ tick, connected: socketHub.connectedCount }, 'Game tick');
    }
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  gameLoop.start();

  app.log.info(`Neon Requiem server running on port ${port}`);

  process.on('SIGTERM', async () => {
    gameLoop.stop();
    await db.$disconnect();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
```

- [ ] **Step 2: Install jsonwebtoken**

```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

- [ ] **Step 3: Start the server and verify it runs**

```bash
npm run dev
```

Expected output:
```
{"level":30,"msg":"Server listening at http://0.0.0.0:3000"}
Neon Requiem server running on port 3000
```

- [ ] **Step 4: Test auth endpoints**

```bash
# Register
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testrunner","email":"test@example.com","password":"password123"}' | jq

# Expected: {"token":"...","accountId":"...","username":"testrunner"}

# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testrunner","password":"password123"}' | jq

# Expected: {"token":"...","accountId":"...","username":"testrunner"}
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts package.json package-lock.json
git commit -m "feat: bootstrap Fastify + Socket.IO server with game loop"
```

---

## Task 8: PM2 Configuration

**Files:**
- Create: `ecosystem.config.js`

- [ ] **Step 1: Install PM2**

```bash
npm install -D pm2
```

- [ ] **Step 2: Write ecosystem.config.js**

```javascript
module.exports = {
  apps: [
    {
      name: 'neon-requiem',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

- [ ] **Step 3: Add PM2 scripts to package.json**

Add to the `"scripts"` block:

```json
"start:pm2": "pm2 start ecosystem.config.js",
"stop:pm2": "pm2 stop neon-requiem",
"logs": "pm2 logs neon-requiem"
```

- [ ] **Step 4: Commit**

```bash
git add ecosystem.config.js package.json
git commit -m "chore: add PM2 process management config"
```

---

## Completion Checklist

After all tasks are done, verify:

- [ ] `npm test` passes all tests
- [ ] `npm run build` compiles without TypeScript errors
- [ ] `npm run dev` starts server successfully
- [ ] `POST /auth/register` returns a JWT token
- [ ] `POST /auth/login` returns a JWT token
- [ ] WebSocket connection with a valid token is accepted
- [ ] WebSocket connection without a token is rejected
- [ ] Game loop ticks at ~1/second (check logs)

---

## What's Next

**Plan 02: Character System** — races, classes, stat generation (roll + karma methods), character creation flow, and faction assignment.
