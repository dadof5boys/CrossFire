import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { type TokenVerifier, verifySupabaseToken } from './auth.js';
import { registerDeckRoutes } from './routes/decks.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface BuildAppOptions {
  /** Override token verification (used by tests to inject a fixed user). */
  verifyToken?: TokenVerifier;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const verifyToken = options.verifyToken ?? verifySupabaseToken;
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true, credentials: true });

  app.decorateRequest('userId', '');
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const userId = token ? await verifyToken(token) : null;
    if (!userId) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    req.userId = userId;
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerDeckRoutes(app);

  return app;
}
