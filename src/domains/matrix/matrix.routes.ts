import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MatrixService } from './matrix.service';
import { AuthService } from '../auth/auth.service';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { AuthPayload } from '../../shared/types';

const jackInSchema = z.object({
  characterId: z.string(),
  roomId: z.string(),
});

const hackSchema = z.object({
  characterId: z.string(),
  type: z.enum(['brute', 'sleaze']),
});

function extractAuth(authService: AuthService, authHeader: string | undefined): AuthPayload {
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing or invalid Authorization header');
  return authService.verifyToken(authHeader.slice(7));
}

export function registerMatrixRoutes(
  app: FastifyInstance,
  matrixService: MatrixService,
  authService: AuthService,
) {
  app.post('/matrix/jack-in', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const body = jackInSchema.parse(req.body);
      const result = await matrixService.jackIn(body.characterId, body.roomId);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/matrix/jack-out', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const { characterId, isEmergency } = req.body as { characterId: string; isEmergency?: boolean };
      const result = await matrixService.jackOut(characterId, isEmergency);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/matrix/hack', async (req, reply) => {
    try {
      extractAuth(authService, req.headers.authorization);
      const body = hackSchema.parse(req.body);
      const result = await matrixService.performHacking(body.characterId, body.type);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
