import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import {
  ChatJoinPayloadSchema,
  ChatLeavePayloadSchema,
  ChatSayPayloadSchema,
  ChatTellPayloadSchema,
  DEFAULT_CHAT_CHANNEL,
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

export function attachRealtime(
  httpServer: HttpServer,
  options: { verifyToken: TokenVerifier; hub?: RealtimeHub },
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
      ack?.(null);
    });

    socket.on('disconnect', () => {
      const { channels } = hub.leaveAll(socket.id);
      for (const channel of channels) {
        const sys = hub.recordSystem(channel, `${me().email} has left ${channel}`);
        io.to(channelRoom(channel)).emit('chat:message', sys);
        broadcastPresence(channel);
      }
      broadcastTables();
    });
  });

  return { io, hub };
}
