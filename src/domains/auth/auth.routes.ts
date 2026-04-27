import { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { AuthService } from './auth.service';
import { AppError } from '../../shared/errors';

const registerSchema = z.object({
  username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  email: z.string(),
  password: z.string().min(1).max(72),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post('/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    try {
      const result = await authService.register(parsed.data);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    try {
      const result = await authService.login(parsed.data);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
