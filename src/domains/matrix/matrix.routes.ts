import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MatrixService } from './matrix.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';

const jackInSchema = z.object({
  characterId: z.string(),
  roomId: z.string(),
});

const hackSchema = z.object({
  characterId: z.string(),
  type: z.enum(['brute', 'sleaze']),
});

export function registerMatrixRoutes(
  app: FastifyInstance,
  matrixService: MatrixService,
  authService: AuthService,
) {
  app.post('/matrix/jack-in', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const body = jackInSchema.parse(req.body);
      const result = await matrixService.jackIn(body.characterId, payload.accountId, body.roomId);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/matrix/jack-out', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const { characterId, isEmergency } = req.body as { characterId: string; isEmergency?: boolean };
      const result = await matrixService.jackOut(characterId, payload.accountId, isEmergency);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/matrix/hack', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const body = hackSchema.parse(req.body);
      const result = await matrixService.performHacking(body.characterId, payload.accountId, body.type);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
