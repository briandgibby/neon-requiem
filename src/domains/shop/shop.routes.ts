import { FastifyInstance } from 'fastify';
import { ShopService } from './shop.service';
import { AuthService } from '../auth/auth.service';
import { BuyItemInput } from './shop.types';
import { z, ZodError } from 'zod';
import { AppError } from '../../shared/errors';

const roomParamsSchema = z.object({ roomId: z.string().min(1) });
const buyItemSchema = z.object({
  characterId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});

export function registerShopRoutes(app: FastifyInstance, shopService: ShopService, authService: AuthService) {
  app.get('/api/shop/:roomId', {
    preHandler: [authService.getAuthMiddleware()],
  }, async (request, reply) => {
    try {
      const { roomId } = roomParamsSchema.parse(request.params);
      const inventory = await shopService.getShopInventory(roomId);
      return inventory;
    } catch (error) {
      if (error instanceof AppError) return reply.status(error.statusCode).send({ error: error.message });
      if (error instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: error.flatten() });
      }
      throw error;
    }
  });

  app.post('/api/shop/:roomId/buy', {
    preHandler: [authService.getAuthMiddleware()]
  }, async (request, reply) => {
    try {
      const { roomId } = roomParamsSchema.parse(request.params);
      const { characterId, itemId, quantity } = buyItemSchema.parse(request.body);
      const accountId = request.user!.accountId;

      const input: BuyItemInput = {
        characterId,
        accountId,
        roomId,
        itemId,
        quantity,
      };

      const result = await shopService.buyItem(input);
      return result;
    } catch (error) {
      if (error instanceof AppError) return reply.status(error.statusCode).send({ error: error.message });
      if (error instanceof ZodError) {
        return reply.code(422).send({ error: 'Validation failed', details: error.flatten() });
      }
      throw error;
    }
  });
}
