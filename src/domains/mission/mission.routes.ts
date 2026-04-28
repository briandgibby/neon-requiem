import { FastifyInstance } from 'fastify';
import { MissionService } from './mission.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';
import { AcceptMissionInput } from './mission.types';

export function registerMissionRoutes(
  app: FastifyInstance,
  missionService: MissionService,
  authService: AuthService
) {
  app.post('/mission/accept', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const input = request.body as { templateSlug: string; characterId: string; partyId?: string };

      const result = await missionService.acceptMission({
        templateSlug: input.templateSlug,
        characterId: input.characterId,
        accountId,
        partyId: input.partyId
      });

      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post('/mission/complete', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const { missionId, characterId, successRating } = request.body as { missionId: string; characterId: string; successRating: number };

      const result = await missionService.completeMission(characterId, accountId, missionId, successRating);

      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
