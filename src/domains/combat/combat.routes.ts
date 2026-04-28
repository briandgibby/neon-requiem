import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CombatService } from './combat.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';

const actionSchema = z.object({
  characterId: z.string(),
  targetId: z.string(),
  move: z.enum(['attack', 'guard', 'backstab', 'scattershot', 'aimed-shot', 'trip', 'flee', 'consume']),
});

const joinSchema = z.object({
  characterId: z.string(),
  roomId: z.string(),
});

export function registerCombatRoutes(
  app: FastifyInstance,
  combatService: CombatService,
  authService: AuthService,
) {
  app.post('/combat/join', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const body = joinSchema.parse(req.body);
      await combatService.joinCombat(body.characterId, payload.accountId, body.roomId);
      return reply.code(200).send({ message: 'Joined combat' });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/combat/action', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const body = actionSchema.parse(req.body);
      const result = await combatService.performMove({ ...body, accountId: payload.accountId });
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
