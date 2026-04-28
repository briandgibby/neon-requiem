import 'fastify';
import { AuthPayload } from './types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthPayload;
  }
}
