import { FastifyInstance } from 'fastify';
import { MissionService } from './mission.service';
import { AuthService } from '../auth/auth.service';
import { AcceptMissionInput } from './mission.types';

export function registerMissionRoutes(
  app: FastifyInstance,
  missionService: MissionService,
  authService: AuthService
) {
  app.post('/mission/accept', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.split(' ')[1];
    const { accountId } = authService.verifyToken(token);
    
    // For now, we expect characterId in body since verifyToken only returns account info
    const input = request.body as { templateSlug: string; characterId: string; partyId?: string };

    const result = await missionService.acceptMission({
      templateSlug: input.templateSlug,
      characterId: input.characterId,
      partyId: input.partyId
    });

    return result;
  });

  app.post('/mission/complete', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.split(' ')[1];
    const { accountId } = authService.verifyToken(token);

    const { missionId, characterId, successRating } = request.body as { missionId: string; characterId: string; successRating: number };

    const result = await missionService.completeMission(characterId, missionId, successRating);

    return result;
  });
}
