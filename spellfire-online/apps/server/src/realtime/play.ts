import { randomUUID } from 'node:crypto';
import {
  type Battlefield,
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
  championCanUse,
  combatTotal,
  expandDeck,
  isAllyType,
  isChampionType,
  isSpellType,
  resolveChampionCombat,
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
 * Enforces turn, zone-by-type, battlefield realm attacks, and ally attach.
 */
export class PlayTable {
  status: 'lobby' | 'playing' = 'lobby';
  activeSeat: 0 | 1 = 0;
  turnNumber = 1;
  phase: PlayPhase = 0;
  lastCombat: CombatResult | null = null;
  battlefield: Battlefield | null = null;
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
    this.battlefield = null;
    this.razed.clear();
    return null;
  }

  draw(userId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    const busy = this.requireIdle();
    if (busy) return busy;
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
    const busy = this.requireIdle();
    if (busy) return busy;
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
    const busy = this.requireIdle();
    if (busy) return busy;
    this.phase = phase;
    return null;
  }

  attack(userId: string, attackerInstanceId: string, targetInstanceId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    const busy = this.requireIdle();
    if (busy) return busy;
    if (this.phase === END_PHASE) return 'Cannot attack in the end phase';
    if (this.phase < COMBAT_PHASE) this.phase = COMBAT_PHASE;

    const opened = this.openBattlefield(attackerInstanceId, targetInstanceId);
    if (typeof opened === 'string') return opened;
    this.battlefield = opened;
    return null;
  }

  defend(userId: string, defenderInstanceId: string): string | null {
    const defErr = this.requireDefender(userId);
    if (defErr) return defErr;
    const bf = this.battlefield;
    if (!bf) return 'No attack to defend';
    if (bf.defenderInstanceId) return 'Already defending';
    const foe = this.seats[this.defendingSeat()];
    if (!foe) return 'Not seated';

    const defender = foe.pool.find((c) => c.instanceId === defenderInstanceId);
    if (!defender) return 'Defender must be in your pool';
    const defenderFacts = this.lookup(defender.cardId);
    if (!defenderFacts || !isChampionType(defenderFacts.typeId)) {
      return 'Defender must be a champion';
    }
    bf.defenderInstanceId = defender.instanceId;
    bf.defenderCardId = defender.cardId;
    return null;
  }

  resolveCombat(userId: string): string | null {
    const fightErr = this.requireFighter(userId);
    if (fightErr) return fightErr;
    const bf = this.battlefield;
    if (!bf) return 'No attack to resolve';
    if (!bf.defenderInstanceId) return 'Defend or decline first';
    const foe = this.seats[this.defendingSeat()];
    const attackerSeat = this.seats[this.activeSeat];
    if (!foe || !attackerSeat) return 'Not seated';

    const defender = foe.pool.find((c) => c.instanceId === bf.defenderInstanceId);
    if (!defender) return 'Defender is no longer in the pool';
    const defenderFacts = this.lookup(defender.cardId);
    if (!defenderFacts) return 'Unknown card';
    const attacker = attackerSeat.pool.find((c) => c.instanceId === bf.attackerInstanceId);
    if (!attacker) return 'Attacker is no longer in the pool';
    const attackerFacts = this.lookup(attacker.cardId);
    if (!attackerFacts) return 'Unknown card';
    const realm = foe.realms.find((c) => c.instanceId === bf.targetInstanceId);
    if (!realm) return 'Target realm is gone';

    const outcome = resolveChampionCombat(
      this.sideTotal(attackerFacts.bonus, bf.attackerAllies, bf.attackerSpells),
      this.sideTotal(defenderFacts.bonus, bf.defenderAllies, bf.defenderSpells),
    );
    this.discardAttachments();
    if (outcome.attackerWins) {
      this.razed.add(realm.instanceId);
      this.lastCombat = {
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: realm.instanceId,
        defenderInstanceId: defender.instanceId,
        attackerBonus: outcome.attackerBonus,
        defenderBonus: outcome.defenderBonus,
        razed: true,
        attackerDiscarded: false,
      };
    } else {
      const idx = attackerSeat.pool.findIndex((c) => c.instanceId === attacker.instanceId);
      if (idx >= 0) attackerSeat.pool.splice(idx, 1);
      attackerSeat.discard.push(attacker);
      this.lastCombat = {
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: realm.instanceId,
        defenderInstanceId: defender.instanceId,
        attackerBonus: outcome.attackerBonus,
        defenderBonus: outcome.defenderBonus,
        razed: false,
        attackerDiscarded: true,
      };
    }
    this.battlefield = null;
    return null;
  }

  declineDefend(userId: string): string | null {
    const defErr = this.requireDefender(userId);
    if (defErr) return defErr;
    const bf = this.battlefield;
    if (!bf) return 'No attack to defend';
    if (bf.defenderInstanceId) return 'Already defending';
    const foe = this.seats[this.defendingSeat()];
    const attackerSeat = this.seats[this.activeSeat];
    if (!foe || !attackerSeat) return 'Not seated';
    const attacker = attackerSeat.pool.find((c) => c.instanceId === bf.attackerInstanceId);
    if (!attacker) return 'Attacker is no longer in the pool';
    const attackerFacts = this.lookup(attacker.cardId);
    if (!attackerFacts) return 'Unknown card';
    const realm = foe.realms.find((c) => c.instanceId === bf.targetInstanceId);
    if (!realm) return 'Target realm is gone';
    const realmFacts = this.lookup(realm.cardId);
    if (!realmFacts) return 'Unknown card';

    const outcome = resolveRealmAttack(
      this.sideTotal(attackerFacts.bonus, bf.attackerAllies, bf.attackerSpells),
      realmFacts.bonus,
    );
    this.discardAttachments();
    this.lastCombat = {
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: realm.instanceId,
      defenderInstanceId: null,
      attackerBonus: outcome.attackerBonus,
      defenderBonus: outcome.defenderBonus,
      razed: outcome.razed,
      attackerDiscarded: false,
    };
    if (outcome.razed) this.razed.add(realm.instanceId);
    this.battlefield = null;
    return null;
  }

  ally(userId: string, instanceId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const bf = this.battlefield;
    if (!bf) return 'No attack to join';
    const seatIndex = this.seats.findIndex((s) => s.occupant?.userId === userId);
    if (seatIndex < 0) return 'Not seated';
    const isAttacker = seatIndex === this.activeSeat;
    const isDefender = seatIndex === this.defendingSeat();
    if (!isAttacker && !isDefender) return 'Not in this fight';
    if (isDefender && !bf.defenderInstanceId) return 'Defend with a champion first';

    const seat = this.seats[seatIndex];
    if (!seat) return 'Not seated';
    const handIdx = seat.hand.findIndex((c) => c.instanceId === instanceId);
    if (handIdx < 0) return 'Ally must be in your hand';
    const card = seat.hand[handIdx];
    if (!card) return 'Ally must be in your hand';
    const facts = this.lookup(card.cardId);
    if (!facts) return 'Unknown card';
    if (!isAllyType(facts.typeId)) return 'Only allies can join the battlefield';

    seat.hand.splice(handIdx, 1);
    if (isAttacker) bf.attackerAllies.push(card);
    else bf.defenderAllies.push(card);
    return null;
  }

  cast(userId: string, instanceId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    const bf = this.battlefield;
    if (!bf) return 'No attack to join';
    const seatIndex = this.seats.findIndex((s) => s.occupant?.userId === userId);
    if (seatIndex < 0) return 'Not seated';
    const isAttacker = seatIndex === this.activeSeat;
    const isDefender = seatIndex === this.defendingSeat();
    if (!isAttacker && !isDefender) return 'Not in this fight';
    if (isDefender && !bf.defenderInstanceId) return 'Defend with a champion first';

    const seat = this.seats[seatIndex];
    if (!seat) return 'Not seated';
    const handIdx = seat.hand.findIndex((c) => c.instanceId === instanceId);
    if (handIdx < 0) return 'Spell must be in your hand';
    const card = seat.hand[handIdx];
    if (!card) return 'Spell must be in your hand';
    const spellFacts = this.lookup(card.cardId);
    if (!spellFacts) return 'Unknown card';
    if (!isSpellType(spellFacts.typeId)) return 'Only spells can be cast';

    const championId = isAttacker ? bf.attackerCardId : bf.defenderCardId;
    if (!championId) return 'Defend with a champion first';
    const championFacts = this.lookup(championId);
    if (!championFacts) return 'Unknown card';
    if (!championCanUse(championFacts.usesCodes, spellFacts.typeId)) {
      return 'Champion cannot cast that spell';
    }

    seat.hand.splice(handIdx, 1);
    if (isAttacker) bf.attackerSpells.push(card);
    else bf.defenderSpells.push(card);
    return null;
  }

  passTurn(userId: string): string | null {
    const turnErr = this.requireActive(userId);
    if (turnErr) return turnErr;
    const busy = this.requireIdle();
    if (busy) return busy;
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
      battlefield: this.battlefieldView(),
    };
  }

  private defendingSeat(): 0 | 1 {
    return this.activeSeat === 0 ? 1 : 0;
  }

  private requireIdle(): string | null {
    if (this.battlefield) return 'Resolve the current attack first';
    return null;
  }

  private requireDefender(userId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    if (!this.battlefield) return 'No attack to defend';
    const foe = this.seats[this.defendingSeat()];
    if (!foe?.occupant) return 'No opponent';
    if (foe.occupant.userId !== userId) return 'Not the defending player';
    return null;
  }

  private requireFighter(userId: string): string | null {
    if (this.status !== 'playing') return 'Game has not started';
    if (!this.battlefield) return 'No attack to resolve';
    const seatIndex = this.seats.findIndex((s) => s.occupant?.userId === userId);
    if (seatIndex !== this.activeSeat && seatIndex !== this.defendingSeat()) {
      return 'Not in this fight';
    }
    return null;
  }

  private openBattlefield(
    attackerInstanceId: string,
    targetInstanceId: string,
  ): Battlefield | string {
    const mySeat = this.seats[this.activeSeat];
    if (!mySeat) return 'Not seated';
    const foe = this.seats[this.defendingSeat()];
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

    return {
      attackerInstanceId: attacker.instanceId,
      attackerCardId: attacker.cardId,
      targetInstanceId: target.instanceId,
      targetCardId: target.cardId,
      defenderInstanceId: null,
      defenderCardId: null,
      attackerAllies: [],
      defenderAllies: [],
      attackerSpells: [],
      defenderSpells: [],
      attackerTotal: 0,
      defenderTotal: 0,
    };
  }

  private battlefieldView(): Battlefield | null {
    const bf = this.battlefield;
    if (!bf) return null;
    const attackerSeat = this.seats[this.activeSeat];
    const foe = this.seats[this.defendingSeat()];
    const attacker = attackerSeat?.pool.find((c) => c.instanceId === bf.attackerInstanceId);
    const attackerBonus = attacker ? this.lookup(attacker.cardId)?.bonus : 0;
    let defenderBonus: number | null | undefined = 0;
    if (bf.defenderInstanceId) {
      const defender = foe?.pool.find((c) => c.instanceId === bf.defenderInstanceId);
      defenderBonus = defender ? this.lookup(defender.cardId)?.bonus : 0;
    } else {
      const realm = foe?.realms.find((c) => c.instanceId === bf.targetInstanceId);
      defenderBonus = realm ? this.lookup(realm.cardId)?.bonus : 0;
    }
    return {
      ...bf,
      attackerTotal: this.sideTotal(attackerBonus, bf.attackerAllies, bf.attackerSpells),
      defenderTotal: this.sideTotal(
        defenderBonus,
        bf.defenderInstanceId ? bf.defenderAllies : [],
        bf.defenderInstanceId ? bf.defenderSpells : [],
      ),
    };
  }

  private sideTotal(
    championBonus: number | null | undefined,
    allies: CardInstance[],
    spells: CardInstance[],
  ): number {
    return combatTotal(championBonus, [
      ...allies.map((card) => this.lookup(card.cardId)?.bonus),
      ...spells.map((card) => this.lookup(card.cardId)?.bonus),
    ]);
  }

  private discardAttachments(): void {
    const bf = this.battlefield;
    if (!bf) return;
    const attackerSeat = this.seats[this.activeSeat];
    const foe = this.seats[this.defendingSeat()];
    if (attackerSeat) {
      attackerSeat.discard.push(...bf.attackerAllies, ...bf.attackerSpells);
    }
    if (foe) foe.discard.push(...bf.defenderAllies, ...bf.defenderSpells);
    bf.attackerAllies = [];
    bf.defenderAllies = [];
    bf.attackerSpells = [];
    bf.defenderSpells = [];
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
