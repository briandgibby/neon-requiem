import { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { CharacterService } from './character.service';
import { AuthService } from '../auth/auth.service';
import { extractAuthPayload } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors';

const createSchema = z.object({
  name: z.string().min(2).max(30),
  faction: z.enum(['shadow', 'corp']),
  race: z.enum(['human', 'surge', 'elf', 'dark-elf', 'dwarf', 'gnome', 'halfling', 'goblin', 'ork', 'oni', 'troll', 'minotaur']),
  className: z.enum([
    'street-samurai', 'razorboy', 'bounty-hunter', 'mercenary',
    'face', 'infiltrator', 'rigger', 'smuggler',
    'decker', 'technomancer',
    'mage-hermetic', 'shaman', 'street-doc', 'weapons-adept',
  ]),
  streetDocPath: z.enum(['magic', 'tech']).optional(),
  body:      z.number().int().min(1).max(12),
  agility:   z.number().int().min(1).max(12),
  dexterity: z.number().int().min(1).max(12),
  strength:  z.number().int().min(1).max(12),
  logic:     z.number().int().min(1).max(12),
  intuition: z.number().int().min(1).max(12),
  willpower: z.number().int().min(1).max(12),
  charisma:  z.number().int().min(1).max(12),
  luck:      z.number().int().min(1).max(12),
  mentorSpirit: z.enum(['bear', 'gator', 'cat', 'eagle', 'wolf', 'rat', 'valkyrie', 'chaos']).optional(),
});

export function registerCharacterRoutes(
  app: FastifyInstance,
  characterService: CharacterService,
  authService: AuthService,
) {
  app.post('/characters', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      const body = createSchema.parse(req.body);
      const character = await characterService.createCharacter({ accountId: payload.accountId, ...body });
      return reply.code(201).send(character);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      if (err instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: err.flatten() });
      }
      throw err;
    }
  });

  app.get('/characters', async (req, reply) => {
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      return reply.send(await characterService.listCharacters(payload.accountId));
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get('/characters/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const payload = extractAuthPayload(authService, req.headers.authorization);
      return reply.send(await characterService.getCharacter(id, payload.accountId));
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
