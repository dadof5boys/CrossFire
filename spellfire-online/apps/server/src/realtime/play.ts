import { randomUUID } from 'node:crypto';
import {
  type CardInstance,
  type DeckEntry,
  MAX_TABLE_PLAYERS,
  type Occupant,
  type PlayView,
  type PlayZone,
  STARTING_HAND_SIZE,
  type SeatView,
  expandDeck,
} from '@spellfire/shared';

export type PlayZoneName = PlayZone;

interface SeatState {
  occupant: Occupant | null;
  socketId: string | null;
  deckName: string | null;
  hand: CardInstance[];
  draw: CardInstance[];
  pool: CardInstance[];
  realms: CardInstance[];
  discard: CardInstance[];
}

function emptySeat(): SeatState {
  return {
    occupant: null,
    socketId: null,
    deckName: null,
    hand: [],
    draw: [],
    pool: [],
    realms: [],
    discard: [],
  };
}

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = list[i];
    const b = list[j];
    if (a === undefined || b === undefined) continue;
    list[i] = b;
    list[j] = a;
  }
  return list;
}

function toInstances(cardIds: string[]): CardInstance[] {
  return cardIds.map((cardId) => ({ instanceId: randomUUID(), cardId }));
}

const PUBLIC_MOVE_ZONES = ['hand', 'pool', 'realms', 'discard'] as const;

/**
 * In-memory digital tabletop for one lobby table. No rules enforcement —
 * seated players may draw and move their own cards freely.
 */
export class PlayTable {
  status: 'lobby' | 'playing' = 'lobby';
  activeSeat: 0 | 1 = 0;
  turnNumber = 1;
  readonly seats: [SeatState, SeatState] = [emptySeat(), emptySeat()];

  constructor(
    readonly tableId: string,
    readonly tableName: string,
  ) {}

  get playerCount(): number {
    return this.seats.filter((s) => s.occupant).length;
  }

  seatedUserIds(): string[] {
    return this.seats.map((s) => s.occupant?.userId).filter((id): id is string => Boolean(id));
  }

  sit(socketId: string, occupant: Occupant): number | string {
    const existing = this.seats.findIndex((s) => s.occupant?.userId === occupant.userId);
    if (existing >= 0) {
      const seat = this.seats[existing];
      if (seat) seat.socketId = socketId;
      return existing;
    }
    const empty = this.seats.findIndex((s) => !s.occupant);
    if (empty < 0) return 'Seats full';
    this.seats[empty] = {
      ...emptySeat(),
      occupant,
      socketId,
    };
    return empty;
  }

  standBySocket(socketId: string): void {
    for (let i = 0; i < MAX_TABLE_PLAYERS; i++) {
      const seat = this.seats[i];
      if (!seat || seat.socketId !== socketId) continue;
      if (this.status === 'playing') {
        seat.socketId = null;
      } else {
        this.seats[i] = emptySeat();
      }
    }
  }

  loadDeck(userId: string, deckName: string, entries: DeckEntry[]): string | null {
    if (this.status !== 'lobby') return 'Game already started';
    const seat = this.seatForUser(userId);
    if (!seat) return 'Not seated';
    const ids = expandDeck(entries);
    if (ids.length === 0) return 'Deck is empty';
    seat.deckName = deckName;
    seat.draw = toInstances(ids);
    seat.hand = [];
    seat.pool = [];
    seat.realms = [];
    seat.discard = [];
    return null;
  }

  start(): string | null {
    if (this.status === 'playing') return 'Game already started';
    const occupied = this.seats.filter((s) => s.occupant);
    if (occupied.length === 0) return 'Need a seated player';
    if (occupied.some((s) => !s.deckName || s.draw.length === 0)) {
      return 'Every seated player needs a loaded deck';
    }
    for (const seat of occupied) {
      seat.draw = shuffle(seat.draw);
      const n = Math.min(STARTING_HAND_SIZE, seat.draw.length);
      seat.hand = seat.draw.splice(0, n);
    }
    this.status = 'playing';
    this.activeSeat = this.seats[0]?.occupant ? 0 : 1;
    this.turnNumber = 1;
    return null;
  }

  draw(userId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const seat = this.seatForUser(userId);
    if (!seat) return 'Not seated';
    const card = seat.draw.shift();
    if (!card) return 'Draw pile is empty';
    seat.hand.push(card);
    return null;
  }

  move(
    userId: string,
    instanceId: string,
    toZone: (typeof PUBLIC_MOVE_ZONES)[number],
  ): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const seat = this.seatForUser(userId);
    if (!seat) return 'Not seated';
    const found = this.findInSeat(seat, instanceId);
    if (!found) return 'Card not found';
    if (found.zone === 'draw') return 'Draw with the Draw action';
    const [card] = seat[found.zone].splice(found.index, 1);
    if (!card) return 'Card not found';
    seat[toZone].push(card);
    return null;
  }

  passTurn(userId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const seatIndex = this.seats.findIndex((s) => s.occupant?.userId === userId);
    if (seatIndex < 0) return 'Not seated';
    if (seatIndex !== this.activeSeat) return 'Not your turn';
    const other = (seatIndex === 0 ? 1 : 0) as 0 | 1;
    if (this.seats[other]?.occupant) this.activeSeat = other;
    this.turnNumber += 1;
    return null;
  }

  viewFor(viewerId: string, spectators: Occupant[]): PlayView {
    const youSeatIndex = this.seats.findIndex((s) => s.occupant?.userId === viewerId);
    const youSeat = youSeatIndex === 0 || youSeatIndex === 1 ? youSeatIndex : null;
    return {
      tableId: this.tableId,
      tableName: this.tableName,
      status: this.status,
      activeSeat: this.activeSeat,
      turnNumber: this.turnNumber,
      youSeat,
      seats: [
        this.seatView(this.seats[0] as SeatState, youSeat === 0),
        this.seatView(this.seats[1] as SeatState, youSeat === 1),
      ],
      spectators,
    };
  }

  private seatView(seat: SeatState, revealHand: boolean): SeatView {
    return {
      occupant: seat.occupant,
      deckName: seat.deckName,
      hand: revealHand ? seat.hand : { count: seat.hand.length },
      drawCount: seat.draw.length,
      pool: seat.pool,
      realms: seat.realms,
      discard: seat.discard,
    };
  }

  private seatForUser(userId: string): SeatState | undefined {
    return this.seats.find((s) => s.occupant?.userId === userId);
  }

  private findInSeat(
    seat: SeatState,
    instanceId: string,
  ): { zone: PlayZoneName; index: number } | undefined {
    for (const zone of ['hand', 'draw', 'pool', 'realms', 'discard'] as const) {
      const index = seat[zone].findIndex((c) => c.instanceId === instanceId);
      if (index >= 0) return { zone, index };
    }
    return undefined;
  }
}
