import { randomUUID } from 'node:crypto';
import {
  type ChatMessage,
  DEFAULT_CHAT_CHANNEL,
  type Occupant,
  type PlayView,
  type TableSummary,
} from '@spellfire/shared';
import { PlayTable } from './play.js';

const MAX_HISTORY = 50;

interface TableState {
  id: string;
  name: string;
  occupants: Map<string, Occupant>; // socketId -> occupant
}

/**
 * In-memory chat channels, recent-message history, and table lobby.
 * One instance per Fastify process (ephemeral — not persisted).
 */
export class RealtimeHub {
  /** channel -> socketId -> occupant */
  private readonly channels = new Map<string, Map<string, Occupant>>();
  private readonly history = new Map<string, ChatMessage[]>();
  private readonly tables = new Map<string, TableState>();
  /** socketId -> set of channel names */
  private readonly socketChannels = new Map<string, Set<string>>();
  /** socketId -> table id (at most one table at a time) */
  private readonly socketTable = new Map<string, string>();
  /** tableId -> digital tabletop session */
  private readonly games = new Map<string, PlayTable>();

  joinChannel(socketId: string, occupant: Occupant, channel: string): ChatMessage[] {
    let members = this.channels.get(channel);
    if (!members) {
      members = new Map();
      this.channels.set(channel, members);
    }
    members.set(socketId, occupant);
    let joined = this.socketChannels.get(socketId);
    if (!joined) {
      joined = new Set();
      this.socketChannels.set(socketId, joined);
    }
    joined.add(channel);
    return this.history.get(channel) ?? [];
  }

  leaveChannel(socketId: string, channel: string): void {
    this.channels.get(channel)?.delete(socketId);
    this.socketChannels.get(socketId)?.delete(channel);
  }

  leaveAll(socketId: string): { channels: string[]; tableId: string | undefined } {
    const channels = [...(this.socketChannels.get(socketId) ?? [])];
    for (const channel of channels) this.leaveChannel(socketId, channel);
    this.socketChannels.delete(socketId);
    const tableId = this.leaveTable(socketId);
    return { channels, tableId };
  }

  isInChannel(socketId: string, channel: string): boolean {
    return this.socketChannels.get(socketId)?.has(channel) ?? false;
  }

  occupants(channel: string): Occupant[] {
    const unique = new Map<string, Occupant>();
    for (const occ of this.channels.get(channel)?.values() ?? []) {
      unique.set(occ.userId, occ);
    }
    return [...unique.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  recordSay(channel: string, from: Occupant, text: string): ChatMessage {
    const msg: ChatMessage = {
      id: randomUUID(),
      channel,
      from,
      text,
      ts: new Date().toISOString(),
      kind: 'say',
    };
    const list = this.history.get(channel) ?? [];
    list.push(msg);
    if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
    this.history.set(channel, list);
    return msg;
  }

  recordSystem(channel: string, text: string): ChatMessage {
    const msg: ChatMessage = {
      id: randomUUID(),
      channel,
      from: { userId: 'system', email: 'system' },
      text,
      ts: new Date().toISOString(),
      kind: 'system',
    };
    const list = this.history.get(channel) ?? [];
    list.push(msg);
    if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
    this.history.set(channel, list);
    return msg;
  }

  findOccupantByUserId(userId: string): Occupant | undefined {
    for (const members of this.channels.values()) {
      for (const occ of members.values()) {
        if (occ.userId === userId) return occ;
      }
    }
    return undefined;
  }

  socketIdsForUser(userId: string): string[] {
    const ids: string[] = [];
    for (const members of this.channels.values()) {
      for (const [socketId, occ] of members) {
        if (occ.userId === userId) ids.push(socketId);
      }
    }
    return [...new Set(ids)];
  }

  createTable(socketId: string, occupant: Occupant, name: string): TableSummary {
    this.leaveTable(socketId);
    const id = randomUUID();
    const occupants = new Map<string, Occupant>([[socketId, occupant]]);
    this.tables.set(id, { id, name, occupants });
    this.socketTable.set(socketId, id);
    const game = new PlayTable(id, name);
    game.sit(socketId, occupant);
    this.games.set(id, game);
    return this.tableSummary(id) as TableSummary;
  }

  joinTable(socketId: string, occupant: Occupant, tableId: string): TableSummary | null {
    const table = this.tables.get(tableId);
    if (!table) return null;
    this.leaveTable(socketId);
    table.occupants.set(socketId, occupant);
    this.socketTable.set(socketId, tableId);
    return this.tableSummary(tableId);
  }

  leaveTable(socketId: string): string | undefined {
    const tableId = this.socketTable.get(socketId);
    if (!tableId) return undefined;
    const table = this.tables.get(tableId);
    table?.occupants.delete(socketId);
    this.socketTable.delete(socketId);
    this.games.get(tableId)?.standBySocket(socketId);
    if (table && table.occupants.size === 0) {
      this.tables.delete(tableId);
      this.games.delete(tableId);
    }
    return tableId;
  }

  listTables(): TableSummary[] {
    return [...this.tables.keys()]
      .map((id) => this.tableSummary(id))
      .filter((t): t is TableSummary => t !== null);
  }

  tableSummary(tableId: string): TableSummary | null {
    const table = this.tables.get(tableId);
    if (!table) return null;
    const unique = new Map<string, Occupant>();
    for (const occ of table.occupants.values()) unique.set(occ.userId, occ);
    return {
      id: table.id,
      name: table.name,
      occupants: [...unique.values()],
      status: this.games.get(tableId)?.status ?? 'lobby',
      playerCount: this.games.get(tableId)?.playerCount ?? 0,
    };
  }

  currentTable(socketId: string): string | undefined {
    return this.socketTable.get(socketId);
  }

  socketIdsAtTable(tableId: string): string[] {
    return [...(this.tables.get(tableId)?.occupants.keys() ?? [])];
  }

  forEachTableSocket(tableId: string, fn: (socketId: string, userId: string) => void): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    for (const [socketId, occ] of table.occupants) fn(socketId, occ.userId);
  }

  getPlay(tableId: string): PlayTable | undefined {
    return this.games.get(tableId);
  }

  playView(tableId: string, viewerId: string): PlayView | null {
    const table = this.tables.get(tableId);
    const game = this.games.get(tableId);
    if (!table || !game) return null;
    const seated = new Set(game.seatedUserIds());
    const unique = new Map<string, Occupant>();
    for (const occ of table.occupants.values()) unique.set(occ.userId, occ);
    const spectators = [...unique.values()].filter((o) => !seated.has(o.userId));
    return game.viewFor(viewerId, spectators);
  }
}

export const DEFAULT_CHANNEL = DEFAULT_CHAT_CHANNEL;
