import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import {
  ChatJoinPayloadSchema,
  ChatLeavePayloadSchema,
  ChatSayPayloadSchema,
  ChatTellPayloadSchema,
  DEFAULT_CHAT_CHANNEL,
  type DeckEntry,
  PlayAllyPayloadSchema,
  PlayAttackPayloadSchema,
  PlayDeclineDefendPayloadSchema,
  PlayDefendPayloadSchema,
  PlayLoadDeckPayloadSchema,
  PlayMovePayloadSchema,
  PlayResolvePayloadSchema,
  PlaySetPhasePayloadSchema,
  PlayTableIdPayloadSchema,
  TableCreatePayloadSchema,
  TableJoinPayloadSchema,
  TableLeavePayloadSchema,
} from '@spellfire/shared';
import { Server } from 'socket.io';
import type { AuthIdentity, TokenVerifier } from '../auth.js';
import { DEFAULT_CHANNEL, RealtimeHub } from './hub.js';

declare module 'socket.io' {
  interface SocketData {
    identity: AuthIdentity;
  }
}

function channelRoom(channel: string): string {
  return `channel:${channel}`;
}

function tableRoom(tableId: string): string {
  return `table:${tableId}`;
}

export type DeckLoader = (
  userId: string,
  deckId: string,
) => Promise<{ name: string; cards: DeckEntry[] } | null>;

export function attachRealtime(
  httpServer: HttpServer,
  options: { verifyToken: TokenVerifier; hub?: RealtimeHub; loadDeck?: DeckLoader },
): { io: Server; hub: RealtimeHub } {
  const hub = options.hub ?? new RealtimeHub();
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    const raw = socket.handshake.auth?.token;
    const token = typeof raw === 'string' ? raw : null;
    const identity = token ? await options.verifyToken(token) : null;
    if (!identity) {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.identity = identity;
    next();
  });

  const broadcastPresence = (channel: string) => {
    io.to(channelRoom(channel)).emit('chat:presence', {
      channel,
      users: hub.occupants(channel),
    });
  };

  const broadcastTables = () => {
    io.emit('table:list', { tables: hub.listTables() });
  };

  const emitPlay = (tableId: string) => {
    hub.forEachTableSocket(tableId, (socketId, userId) => {
      const view = hub.playView(tableId, userId);
      if (view) io.to(socketId).emit('play:state', view);
    });
  };

  io.on('connection', (socket) => {
    const me = () => socket.data.identity;

    const join = (channel: string) => {
      const already = hub.isInChannel(socket.id, channel);
      const history = hub.joinChannel(socket.id, me(), channel);
      void socket.join(channelRoom(channel));
      socket.emit('chat:history', { channel, messages: history });
      if (!already) {
        const sys = hub.recordSystem(channel, `${me().email} has entered ${channel}`);
        io.to(channelRoom(channel)).emit('chat:message', sys);
      }
      broadcastPresence(channel);
    };

    join(DEFAULT_CHANNEL);
    socket.emit('table:list', { tables: hub.listTables() });

    socket.on('chat:join', (raw, ack?: (err: string | null) => void) => {
      const parsed = ChatJoinPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid channel');
        return;
      }
      join(parsed.data.channel);
      ack?.(null);
    });

    socket.on('chat:leave', (raw, ack?: (err: string | null) => void) => {
      const parsed = ChatLeavePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid channel');
        return;
      }
      const { channel } = parsed.data;
      if (channel === DEFAULT_CHAT_CHANNEL) {
        ack?.('Cannot leave the default channel');
        return;
      }
      hub.leaveChannel(socket.id, channel);
      void socket.leave(channelRoom(channel));
      const sys = hub.recordSystem(channel, `${me().email} has left ${channel}`);
      io.to(channelRoom(channel)).emit('chat:message', sys);
      broadcastPresence(channel);
      ack?.(null);
    });

    socket.on('chat:say', (raw, ack?: (err: string | null) => void) => {
      const parsed = ChatSayPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid message');
        return;
      }
      const { channel, text } = parsed.data;
      const msg = hub.recordSay(channel, me(), text);
      io.to(channelRoom(channel)).emit('chat:message', msg);
      ack?.(null);
    });

    socket.on('chat:tell', (raw, ack?: (err: string | null) => void) => {
      const parsed = ChatTellPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid whisper');
        return;
      }
      const target = hub.findOccupantByUserId(parsed.data.toUserId);
      if (!target) {
        ack?.('User is not online');
        return;
      }
      const whisper = {
        id: randomUUID(),
        from: me(),
        to: target,
        text: parsed.data.text,
        ts: new Date().toISOString(),
      };
      for (const id of hub.socketIdsForUser(target.userId)) {
        io.to(id).emit('chat:whisper', whisper);
      }
      socket.emit('chat:whisper', whisper);
      ack?.(null);
    });

    socket.on('table:create', (raw, ack?: (err: string | null, table?: unknown) => void) => {
      const parsed = TableCreatePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      const prev = hub.leaveTable(socket.id);
      if (prev) void socket.leave(tableRoom(prev));
      const table = hub.createTable(socket.id, me(), parsed.data.name);
      void socket.join(tableRoom(table.id));
      broadcastTables();
      emitPlay(table.id);
      ack?.(null, table);
    });

    socket.on('table:join', (raw, ack?: (err: string | null) => void) => {
      const parsed = TableJoinPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      const prev = hub.leaveTable(socket.id);
      if (prev) void socket.leave(tableRoom(prev));
      const table = hub.joinTable(socket.id, me(), parsed.data.tableId);
      if (!table) {
        ack?.('Table not found');
        return;
      }
      void socket.join(tableRoom(table.id));
      broadcastTables();
      emitPlay(table.id);
      ack?.(null);
    });

    socket.on('table:leave', (raw, ack?: (err: string | null) => void) => {
      const parsed = TableLeavePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      hub.leaveTable(socket.id);
      void socket.leave(tableRoom(parsed.data.tableId));
      broadcastTables();
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    const atTable = (tableId: string, ack?: (err: string | null) => void): boolean => {
      if (hub.currentTable(socket.id) !== tableId) {
        ack?.('Not at this table');
        return false;
      }
      return true;
    };

    socket.on('play:sync', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:sit', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const result = game.sit(socket.id, me());
      if (typeof result === 'string') {
        ack?.(result);
        return;
      }
      broadcastTables();
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:stand', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      hub.getPlay(parsed.data.tableId)?.standBySocket(socket.id);
      broadcastTables();
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:load-deck', async (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayLoadDeckPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid deck');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      if (!options.loadDeck) {
        ack?.('Decks unavailable');
        return;
      }
      const deck = await options.loadDeck(me().userId, parsed.data.deckId);
      if (!deck) {
        ack?.('Deck not found');
        return;
      }
      const err = game.loadDeck(me().userId, deck.name, deck.cards);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:start', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.start();
      if (err) {
        ack?.(err);
        return;
      }
      broadcastTables();
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:draw', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.draw(me().userId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:move', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayMovePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid move');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.move(me().userId, parsed.data.instanceId, parsed.data.toZone);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:pass-turn', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayTableIdPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid table');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.passTurn(me().userId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:set-phase', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlaySetPhasePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid phase');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.setPhase(me().userId, parsed.data.phase);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:attack', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayAttackPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid attack');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.attack(
        me().userId,
        parsed.data.attackerInstanceId,
        parsed.data.targetInstanceId,
      );
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:defend', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayDefendPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid defend');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.defend(me().userId, parsed.data.defenderInstanceId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:decline-defend', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayDeclineDefendPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid decline');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.declineDefend(me().userId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:resolve', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayResolvePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid resolve');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.resolveCombat(me().userId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('play:ally', (raw, ack?: (err: string | null) => void) => {
      const parsed = PlayAllyPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.('Invalid ally');
        return;
      }
      if (!atTable(parsed.data.tableId, ack)) return;
      const game = hub.getPlay(parsed.data.tableId);
      if (!game) {
        ack?.('Table not found');
        return;
      }
      const err = game.ally(me().userId, parsed.data.instanceId);
      if (err) {
        ack?.(err);
        return;
      }
      emitPlay(parsed.data.tableId);
      ack?.(null);
    });

    socket.on('disconnect', () => {
      const { channels, tableId } = hub.leaveAll(socket.id);
      for (const channel of channels) {
        const sys = hub.recordSystem(channel, `${me().email} has left ${channel}`);
        io.to(channelRoom(channel)).emit('chat:message', sys);
        broadcastPresence(channel);
      }
      broadcastTables();
      if (tableId) emitPlay(tableId);
    });
  });

  return { io, hub };
}
