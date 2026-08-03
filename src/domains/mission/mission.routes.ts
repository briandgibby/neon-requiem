import { FastifyInstance } from 'fastify';
import { MissionService } from './mission.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';
import { z, ZodError } from 'zod';

const characterQuerySchema = z.object({ characterId: z.string().min(1) });
const acceptMissionSchema = z.object({
  templateSlug: z.string().min(1),
  characterId: z.string().min(1),
  partyId: z.string().min(1).optional(),
});
const missionCharacterSchema = z.object({ characterId: z.string().min(1) });
const completeMissionSchema = z.object({
  missionId: z.string().min(1),
  characterId: z.string().min(1),
});

export function registerMissionRoutes(
  app: FastifyInstance,
  missionService: MissionService,
  authService: AuthService
) {
  app.get('/mission/templates', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const { characterId } = characterQuerySchema.parse(request.query);
      return { missions: await missionService.listAvailableMissions(characterId, accountId) };
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });

  app.get('/mission/active', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const { characterId } = characterQuerySchema.parse(request.query);
      return { mission: await missionService.getActiveMission(characterId, accountId) };
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });

  app.post('/mission/accept', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const input = acceptMissionSchema.parse(request.body);

      const result = await missionService.acceptMission({
        templateSlug: input.templateSlug,
        characterId: input.characterId,
        accountId,
        partyId: input.partyId
      });

      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });

  app.post('/mission/deploy', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const { characterId } = missionCharacterSchema.parse(request.body);
      return await missionService.deployMission(characterId, accountId);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });

  app.post('/mission/complete', async (request, reply) => {
    try {
      const { accountId } = extractAuthPayload(authService, request.headers.authorization);
      const { missionId, characterId } = completeMissionSchema.parse(request.body);

      const result = await missionService.completeMission(characterId, accountId, missionId);

      return result;
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });
}
