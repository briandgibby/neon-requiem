import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CombatService } from './combat.service';
import { AuthService } from '../auth/auth.service';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { AuthPayload } from '../../shared/types';

const actionSchema = z.object({
  characterId: z.string(),
  targetId: z.string(),
  move: z.enum(['attack', 'guard', 'backstab', 'scattershot', 'aimed-shot', 'trip', 'flee', 'consume']),
});

const joinSchema = z.object({
  characterId: z.string(),
  roomId: z.string(),
});

function extractAuth(authService: AuthService, authHeader: string | undefined): AuthPayload {
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing or invalid Authorization header');
  return authService.verifyToken(authHeader.slice(7));
}

export function registerCombatRoutes(
  app: FastifyInstance,
  combatService: CombatService,
  authService: AuthService,
) {
  app.post('/combat/join', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const body = joinSchema.parse(req.body);
      await combatService.joinCombat(body.characterId, body.roomId);
      return reply.code(200).send({ message: 'Joined combat' });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/combat/action', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const body = actionSchema.parse(req.body);
      const result = await combatService.performMove(body);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
