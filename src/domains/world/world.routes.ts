import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WorldService } from './world.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';

const moveSchema = z.object({
  characterId: z.string(),
  direction: z.enum(['north', 'south', 'east', 'west', 'up', 'down', 'northeast', 'northwest', 'southeast', 'southwest']),
});

export function registerWorldRoutes(
  app: FastifyInstance,
  worldService: WorldService,
  authService: AuthService,
) {
  app.get('/rooms/:slug', async (req, reply) => {
    try {
      extractAuthPayload(authService, req.headers.authorization);
      const { slug } = req.params as { slug: string };
      return reply.send(await worldService.getRoom(slug));
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/world/move', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
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
