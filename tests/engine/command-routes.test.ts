import Fastify from 'fastify';
import { CommandContext, CommandHandler, CommandRegistry } from '../../src/engine/command-registry';
import { registerCommandRoutes } from '../../src/engine/command.routes';
import { AuthPayload } from '../../src/shared/types';

class TestCommand implements CommandHandler {
  readonly aliases = ['look'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Look';
  readonly description = 'Examine your surroundings';

  async execute(_context: CommandContext): Promise<void> {}
}

function createApp() {
  const app = Fastify();
  const registry = new CommandRegistry();
  registry.register(new TestCommand());

  registerCommandRoutes(app, registry, {
    verifyToken: jest.fn((_token: string): AuthPayload => ({
      accountId: 'account-1',
      username: 'runner',
    })),
  } as any);

  return app;
}

describe('command metadata routes', () => {
  it('returns registered command metadata for authenticated clients', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/commands',
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      commands: [
        {
          aliases: ['look'],
          mode: 'any',
          label: 'Look',
          description: 'Examine your surroundings',
        },
      ],
    });
  });

  it('rejects clients without an auth token', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/commands',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Missing or invalid Authorization header' });
  });
});
