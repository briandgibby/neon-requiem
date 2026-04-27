import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WorldService } from './world.service';
import { AuthService } from '../auth/auth.service';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { AuthPayload } from '../../shared/types';

const moveSchema = z.object({
  characterId: z.string(),
  direction: z.enum(['north', 'south', 'east', 'west', 'up', 'down', 'northeast', 'northwest', 'southeast', 'southwest']),
});

function extractAuth(authService: AuthService, authHeader: string | undefined): AuthPayload {
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing or invalid Authorization header');
  return authService.verifyToken(authHeader.slice(7));
}

export function registerWorldRoutes(
  app: FastifyInstance,
  worldService: WorldService,
  authService: AuthService,
) {
  app.get('/rooms/:slug', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const { slug } = req.params as { slug: string };
      return reply.send(await worldService.getRoom(slug));
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/world/move', async (req, reply) => {
    try {
      const payload = extractAuth(authService, req.headers.authorization);
      const body = moveSchema.parse(req.body);
      const result = await worldService.moveCharacter(body.characterId, payload.accountId, body.direction);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
