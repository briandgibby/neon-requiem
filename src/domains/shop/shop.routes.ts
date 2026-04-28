import { FastifyInstance } from 'fastify';
import { ShopService } from './shop.service';
import { AuthService } from '../auth/auth.service';
import { BuyItemInput } from './shop.types';

export function registerShopRoutes(app: FastifyInstance, shopService: ShopService, authService: AuthService) {
  app.get('/api/shop/:roomId', async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const inventory = await shopService.getShopInventory(roomId);
      return inventory;
    } catch (error: any) {
      const status = error.name === 'NotFoundError' ? 404 : 400;
      reply.status(status).send({ error: error.message });
    }
  });

  app.post('/api/shop/:roomId/buy', {
    preHandler: [authService.getAuthMiddleware()]
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const { characterId, itemId, quantity } = request.body as { characterId: string; itemId: string; quantity?: number };
      const accountId = request.user!.accountId;

      const input: BuyItemInput = {
        characterId,
        accountId,
        roomId,
        itemId,
        quantity: quantity || 1
      };

      const result = await shopService.buyItem(input);
      return result;
    } catch (error: any) {
      const status = error.name === 'NotFoundError' ? 404 : 400;
      reply.status(status).send({ error: error.message });
    }
  });
}
