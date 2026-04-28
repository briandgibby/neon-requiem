import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors';
import { AuthPayload } from '../../shared/types';

export interface AuthVerifier {
  verifyToken(token: string): AuthPayload;
}

export function extractAuthPayload(auth: AuthVerifier, authHeader: string | undefined): AuthPayload {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  return auth.verifyToken(authHeader.slice(7));
}

export function getAuthMiddleware(auth: AuthVerifier) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = extractAuthPayload(auth, request.headers.authorization);
  };
}
