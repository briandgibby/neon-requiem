import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';
import { SnapshotHistoryService } from './snapshot-history.service';

export function registerSnapshotHistoryRoutes(
  app: FastifyInstance,
  snapshotHistory: SnapshotHistoryService,
  authService: AuthService,
) {
  app.get('/admin/snapshots', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      return reply.send(await snapshotHistory.listSnapshots(payload.accountId, req.query));
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });
}
