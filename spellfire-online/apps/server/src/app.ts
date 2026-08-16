import cors from '@fastify/cors';
import type { DeckEntry } from '@spellfire/shared';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { type TokenVerifier, verifySupabaseToken } from './auth.js';
import { prisma } from './prisma.js';
import { attachRealtime } from './realtime/socket.js';
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
  /** Override saved-deck lookup for play:load-deck (tests inject a fixture). */
  loadDeck?: (
    userId: string,
    deckId: string,
  ) => Promise<{ name: string; cards: DeckEntry[] } | null>;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const verifyToken = options.verifyToken ?? verifySupabaseToken;
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true, credentials: true });

  app.decorateRequest('userId', '');
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const identity = token ? await verifyToken(token) : null;
    if (!identity) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    req.userId = identity.userId;
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerDeckRoutes(app);

  const loadDeck =
    options.loadDeck ??
    (async (userId, deckId) => {
      const deck = await prisma.deck.findFirst({ where: { id: deckId, userId } });
      if (!deck) return null;
      return { name: deck.name, cards: deck.cards as DeckEntry[] };
    });

  const { io } = attachRealtime(app.server, { verifyToken, loadDeck });
  app.addHook('onClose', async () => {
    io.close();
  });

  return app;
}
