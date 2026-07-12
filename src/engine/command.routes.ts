import { FastifyInstance } from 'fastify';
import { AuthService } from '../domains/auth/auth.service';
import { extractAuthPayload } from '../domains/auth/auth.middleware';
import { AppError } from '../shared/errors';
import { CommandRegistry, listCommandMetadata } from './command-registry';

export function registerCommandRoutes(
  app: FastifyInstance,
  commandRegistry: CommandRegistry,
  authService: AuthService,
) {
  app.get('/api/commands', async (req, reply) => {
    try {
      extractAuthPayload(authService, req.headers.authorization);
      return reply.send({ commands: listCommandMetadata(commandRegistry) });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
