import { randomUUID } from 'node:crypto';
import {
  COMBAT_PHASE,
  type CardInstance,
  type CombatResult,
  type DeckEntry,
  END_PHASE,
  MAX_TABLE_PLAYERS,
  type Occupant,
  type PlayPhase,
  type PlayView,
  type PlayZone,
  REALM_TYPE_ID,
  STARTING_HAND_SIZE,
  type SeatView,
  canMoveToZone,
  expandDeck,
  isChampionType,
  resolveRealmAttack,
} from '@spellfire/shared';
import { type CardLookup, getCardFacts } from '../cards/catalog.js';

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

const PUBLIC_MOVE_ZONES = ['pool', 'realms', 'discard'] as const;

/**
 * In-memory digital tabletop for one lobby table.
 * Enforces turn, zone-by-type, and a first-slice realm attack.
 */
export class PlayTable {
  status: 'lobby' | 'playing' = 'lobby';
  activeSeat: 0 | 1 = 0;
  turnNumber = 1;
  phase: PlayPhase = 0;
  lastCombat: CombatResult | null = null;
  readonly razed = new Set<string>();
  readonly seats: [SeatState, SeatState] = [emptySeat(), emptySeat()];

  constructor(
    readonly tableId: string,
    readonly tableName: string,
    private readonly lookup: CardLookup = getCardFacts,
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
    this.phase = 0;
    this.lastCombat = null;
    this.razed.clear();
    return null;
  }

  draw(userId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
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
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    const seat = this.seatForUser(userId);
    if (!seat) return 'Not seated';
    const found = this.findInSeat(seat, instanceId);
    if (!found) return 'Card not found';
    if (found.zone === 'draw') return 'Draw with the Draw action';
    const facts = this.lookup(found.card.cardId);
    if (!facts) return 'Unknown card';
    const zoneErr = canMoveToZone(facts.typeId, toZone);
    if (zoneErr) return zoneErr;
    const [card] = seat[found.zone].splice(found.index, 1);
    if (!card) return 'Card not found';
    if (toZone !== 'realms') this.razed.delete(card.instanceId);
    seat[toZone].push(card);
    return null;
  }

  setPhase(userId: string, phase: PlayPhase): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    this.phase = phase;
    return null;
  }

  attack(userId: string, attackerInstanceId: string, targetInstanceId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    if (this.phase === END_PHASE) return 'Cannot attack in the end phase';
    if (this.phase < COMBAT_PHASE) this.phase = COMBAT_PHASE;

    const mySeat = this.seats[this.activeSeat];
    if (!mySeat) return 'Not seated';
    const other = (this.activeSeat === 0 ? 1 : 0) as 0 | 1;
    const foe = this.seats[other];
    if (!foe?.occupant) return 'No opponent';

    const attacker = mySeat.pool.find((c) => c.instanceId === attackerInstanceId);
    if (!attacker) return 'Attacker must be in your pool';
    const attackerFacts = this.lookup(attacker.cardId);
    if (!attackerFacts || !isChampionType(attackerFacts.typeId)) {
      return 'Attacker must be a champion';
    }

    const target = foe.realms.find((c) => c.instanceId === targetInstanceId);
    if (!target) return 'Target must be an opponent realm';
    if (this.razed.has(target.instanceId)) return 'Realm is already razed';
    const targetFacts = this.lookup(target.cardId);
    if (!targetFacts || targetFacts.typeId !== REALM_TYPE_ID) {
      return 'Target must be a realm';
    }

    const outcome = resolveRealmAttack(attackerFacts.bonus, targetFacts.bonus);
    this.lastCombat = {
      attackerInstanceId,
      targetInstanceId,
      attackerBonus: outcome.attackerBonus,
      defenderBonus: outcome.defenderBonus,
      razed: outcome.razed,
    };
    if (outcome.razed) this.razed.add(target.instanceId);
    return null;
  }

  passTurn(userId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    const other = (this.activeSeat === 0 ? 1 : 0) as 0 | 1;
    if (this.seats[other]?.occupant) this.activeSeat = other;
    this.turnNumber += 1;
    this.phase = 0;
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
      phase: this.phase,
      youSeat,
      seats: [
        this.seatView(this.seats[0] as SeatState, youSeat === 0),
        this.seatView(this.seats[1] as SeatState, youSeat === 1),
      ],
      spectators,
      lastCombat: this.lastCombat,
    };
  }

  private requireActive(userId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const seatIndex = this.seats.findIndex((s) => s.occupant?.userId === userId);
    if (seatIndex < 0) return 'Not seated';
    if (seatIndex !== this.activeSeat) return 'Not your turn';
    return null;
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
      razedInstanceIds: seat.realms
        .filter((c) => this.razed.has(c.instanceId))
        .map((c) => c.instanceId),
    };
  }

  private seatForUser(userId: string): SeatState | undefined {
    return this.seats.find((s) => s.occupant?.userId === userId);
  }

  private findInSeat(
    seat: SeatState,
    instanceId: string,
  ): { zone: PlayZoneName; index: number; card: CardInstance } | undefined {
    for (const zone of ['hand', 'draw', 'pool', 'realms', 'discard'] as const) {
      const index = seat[zone].findIndex((c) => c.instanceId === instanceId);
      if (index >= 0) {
        const card = seat[zone][index];
        if (card) return { zone, index, card };
      }
    }
    return undefined;
  }
}
