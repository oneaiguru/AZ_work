import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';

export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: 'admin' | 'player' | 'nikita';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: AuthTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

export const authPlugin = fastifyPlugin(async (app: FastifyInstance) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      reply.status(401).send({ message: 'Unauthorized' });
      throw error;
    }
  });

  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(request, reply);
    if (request.user?.role !== 'admin') {
      reply.status(403).send({ message: 'Forbidden' });
      throw new Error('Forbidden');
    }
  });
});
