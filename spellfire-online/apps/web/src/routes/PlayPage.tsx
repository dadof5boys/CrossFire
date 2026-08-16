import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Card,
  CardInstance,
  HiddenPile,
  PlayPhase,
  PlayZone,
  SeatView,
} from '@spellfire/shared';
import {
  PHASE_LABELS,
  canMoveToZone,
  championCanUse,
  isAllyType,
  isSpellType,
} from '@spellfire/shared';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { CardDetailDialog } from '../components/CardDetailDialog.js';
import { PlayCard } from '../components/PlayCard.js';
import { useDataset } from '../data/DatasetProvider.js';
import { useDecksQuery } from '../hooks/useDecks.js';
import { useRealtime } from '../realtime/RealtimeProvider.js';
import { useChatStore } from '../store/chatStore.js';
import { usePlayStore } from '../store/playStore.js';

function isHidden(hand: SeatView['hand']): hand is HiddenPile {
  return !Array.isArray(hand);
}

function Zone({
  id,
  label,
  accept,
  children,
}: {
  id: string;
  label: string;
  accept: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !accept });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[6.5rem] rounded border border-slate-800 bg-slate-950/60 p-2 ${
        isOver ? 'border-emerald-500' : ''
      }`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FaceDownRow({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-slate-600">empty</span>;
  return (
    <span className="text-xs text-slate-400">
      {count} card{count === 1 ? '' : 's'}
    </span>
  );
}

function findInstance(seat: SeatView, instanceId: string): CardInstance | undefined {
  const piles = [
    ...(Array.isArray(seat.hand) ? seat.hand : []),
    ...seat.pool,
    ...seat.realms,
    ...seat.discard,
  ];
  return piles.find((c) => c.instanceId === instanceId);
}

export default function PlayPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const { isAuthed, user } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);
  const rt = useRealtime();
  const view = usePlayStore((s) => s.view);
  const tablesReady = useChatStore((s) => s.tablesReady);
  const { cardById } = useDataset();
  const decksQuery = useDecksQuery();
  const [deckId, setDeckId] = useState('');
  const [detail, setDetail] = useState<Card | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!tableId || !isAuthed || !tablesReady) return;
    // Always join this browser socket. Another tab/script may already list the
    // same user as an occupant; skipping join then leaves this socket outside
    // the table room so play:sync/play:state never arrive.
    rt.joinTable(tableId);
    rt.syncPlay(tableId);
  }, [tableId, isAuthed, tablesReady, rt]);

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <h2 className="mb-3 text-xl font-semibold">Play</h2>
        <p className="mb-4 text-slate-400">Sign in to sit at a table.</p>
        <button
          type="button"
          onClick={openAuth}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!tableId) {
    return <p className="p-6 text-slate-400">Missing table.</p>;
  }

  const youSeat = view?.youSeat ?? null;
  const you = youSeat !== null ? view?.seats[youSeat] : undefined;
  const foeSeat = youSeat === 0 ? 1 : youSeat === 1 ? 0 : 1;
  const foe = view?.seats[foeSeat];
  const myTurn = view?.status === 'playing' && youSeat !== null && view.activeSeat === youSeat;
  const inCombat = Boolean(view?.battlefield);
  const isAttacker = Boolean(view?.battlefield) && youSeat !== null && youSeat === view?.activeSeat;
  const isDefender = Boolean(view?.battlefield) && youSeat !== null && youSeat !== view?.activeSeat;
  const defenderCommitted = Boolean(view?.battlefield?.defenderInstanceId);
  const canAct = myTurn && !inCombat;
  const canPlayAlly = Boolean(isAttacker || (isDefender && defenderCommitted));
  const heldCard = you && held ? findInstance(you, held) : undefined;
  const heldTypeId = heldCard ? cardById.get(heldCard.cardId)?.typeId : undefined;
  const heldInPool = Boolean(held && you?.pool.some((c) => c.instanceId === held));
  const heldInHand = Boolean(
    held && Array.isArray(you?.hand) && you.hand.some((c) => c.instanceId === held),
  );
  const attackAttackerId = heldInPool ? held : (you?.pool[0]?.instanceId ?? null);
  const attackTargetId =
    target && foe && !foe.razedInstanceIds.includes(target)
      ? target
      : (foe?.realms.find((c) => !foe.razedInstanceIds.includes(c.instanceId))?.instanceId ?? null);
  const canAttack = Boolean(canAct && attackAttackerId && attackTargetId);
  const defendId = heldInPool ? held : (you?.pool[0]?.instanceId ?? null);
  const canDefend = Boolean(isDefender && !defenderCommitted && defendId);
  const handAllies = Array.isArray(you?.hand)
    ? you.hand.filter((c) => {
        const typeId = cardById.get(c.cardId)?.typeId;
        return typeId !== undefined && isAllyType(typeId);
      })
    : [];
  const allyId =
    heldInHand && heldTypeId !== undefined && isAllyType(heldTypeId)
      ? held
      : (handAllies[0]?.instanceId ?? null);
  const canAddAlly = Boolean(canPlayAlly && allyId);
  const myChampionCardId = isAttacker
    ? view?.battlefield?.attackerCardId
    : view?.battlefield?.defenderCardId;
  const myChampion = myChampionCardId ? cardById.get(myChampionCardId) : undefined;
  const handSpells = Array.isArray(you?.hand)
    ? you.hand.filter((c) => {
        const spell = cardById.get(c.cardId);
        return Boolean(
          spell && isSpellType(spell.typeId) && championCanUse(myChampion?.usesCodes, spell.typeId),
        );
      })
    : [];
  const spellId =
    heldInHand &&
    heldTypeId !== undefined &&
    isSpellType(heldTypeId) &&
    championCanUse(myChampion?.usesCodes, heldTypeId)
      ? held
      : (handSpells[0]?.instanceId ?? null);
  const canCastSpell = Boolean(canPlayAlly && spellId);

  const onDragEnd = (event: DragEndEvent) => {
    const instanceId = event.active.data.current?.instanceId as string | undefined;
    const overId = event.over?.id;
    if (!instanceId || typeof overId !== 'string' || !overId.startsWith('zone:')) return;
    const toZone = overId.slice('zone:'.length) as PlayZone;
    if (toZone === 'draw' || toZone === 'hand') return;
    rt.move(tableId, instanceId, toZone);
    setHeld(null);
  };

  const playHeld = (toZone: 'pool' | 'realms' | 'discard') => {
    if (!tableId || !held) return;
    rt.move(tableId, held, toZone);
    setHeld(null);
  };

  const loadDeck = (e: FormEvent) => {
    e.preventDefault();
    if (deckId) rt.loadDeck(tableId, deckId);
  };

  const renderCards = (
    cards: CardInstance[],
    opts: { draggable?: boolean; razedIds?: string[]; pickable?: boolean },
  ) =>
    cards.map((instance) => (
      <PlayCard
        key={instance.instanceId}
        instance={instance}
        card={cardById.get(instance.cardId)}
        draggable={opts.draggable}
        selected={held === instance.instanceId || target === instance.instanceId}
        razed={opts.razedIds?.includes(instance.instanceId)}
        onPick={opts.pickable ? setHeld : undefined}
        onSelect={setDetail}
      />
    ));

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
        <header className="flex flex-wrap items-center gap-3">
          <Link to="/chat" className="text-sm text-slate-400 hover:text-white">
            ← Chat
          </Link>
          <h2 className="text-lg font-semibold">{view?.tableName ?? 'Table'}</h2>
          <span className="text-xs text-slate-500">
            {view?.status === 'playing'
              ? `Turn ${view.turnNumber} · ${PHASE_LABELS[view.phase]} · ${view.seats[view.activeSeat].occupant?.email ?? 'empty'} to play`
              : 'Lobby — load a deck, then start'}
          </span>
          {youSeat === null ? (
            <button
              type="button"
              onClick={() => rt.sit(tableId)}
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold hover:bg-emerald-500"
            >
              Sit
            </button>
          ) : (
            <button
              type="button"
              onClick={() => rt.stand(tableId)}
              className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            >
              Stand
            </button>
          )}
        </header>

        {view?.status === 'playing' ? (
          <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
            <legend className="sr-only">Turn phase</legend>
            {PHASE_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                disabled={!canAct}
                aria-pressed={view.phase === i}
                onClick={() => rt.setPhase(tableId, i as PlayPhase)}
                className={`rounded px-2 py-1 text-xs ${
                  view.phase === i
                    ? 'bg-amber-700 font-semibold text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-40'
                }`}
              >
                {label}
              </button>
            ))}
          </fieldset>
        ) : null}

        {view?.battlefield ? (
          <section
            className="rounded-lg border border-amber-800 bg-amber-950/40 p-3"
            data-testid="battlefield"
          >
            <p className="text-sm font-semibold text-amber-200">Battlefield</p>
            <p className="text-sm text-slate-300">
              {cardById.get(view.battlefield.attackerCardId)?.title ??
                view.battlefield.attackerCardId}{' '}
              attacks{' '}
              {cardById.get(view.battlefield.targetCardId)?.title ?? view.battlefield.targetCardId}
              {view.battlefield.defenderCardId
                ? ` — defended by ${
                    cardById.get(view.battlefield.defenderCardId)?.title ??
                    view.battlefield.defenderCardId
                  }`
                : ''}
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-100" data-testid="combat-totals">
              Totals {view.battlefield.attackerTotal} vs {view.battlefield.defenderTotal}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Attacker allies:{' '}
              {view.battlefield.attackerAllies.length === 0
                ? 'none'
                : view.battlefield.attackerAllies
                    .map((c) => cardById.get(c.cardId)?.title ?? c.cardId)
                    .join(', ')}
              {' · '}
              Defender allies:{' '}
              {view.battlefield.defenderAllies.length === 0
                ? 'none'
                : view.battlefield.defenderAllies
                    .map((c) => cardById.get(c.cardId)?.title ?? c.cardId)
                    .join(', ')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Attacker spells:{' '}
              {view.battlefield.attackerSpells.length === 0
                ? 'none'
                : view.battlefield.attackerSpells
                    .map((c) => cardById.get(c.cardId)?.title ?? c.cardId)
                    .join(', ')}
              {' · '}
              Defender spells:{' '}
              {view.battlefield.defenderSpells.length === 0
                ? 'none'
                : view.battlefield.defenderSpells
                    .map((c) => cardById.get(c.cardId)?.title ?? c.cardId)
                    .join(', ')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isDefender && !defenderCommitted
                ? 'Choose a pool champion to defend, or decline and let the realm stand alone.'
                : defenderCommitted
                  ? 'Add allies or cast spells from your hand, then resolve combat.'
                  : 'Waiting for the defender to send a champion or decline. You may add allies or cast spells now.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {isDefender && !defenderCommitted ? (
                <>
                  {canDefend ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (defendId) rt.defend(tableId, defendId);
                      }}
                      className="rounded bg-sky-700 px-3 py-1 text-sm font-semibold hover:bg-sky-600"
                    >
                      Defend with champion
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => rt.declineDefend(tableId)}
                    className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                  >
                    Decline defense
                  </button>
                </>
              ) : null}
              {canAddAlly ? (
                <button
                  type="button"
                  onClick={() => {
                    if (allyId) {
                      rt.ally(tableId, allyId);
                      setHeld(null);
                    }
                  }}
                  className="rounded bg-violet-700 px-3 py-1 text-sm font-semibold hover:bg-violet-600"
                >
                  Add ally
                </button>
              ) : null}
              {canCastSpell ? (
                <button
                  type="button"
                  onClick={() => {
                    if (spellId) {
                      rt.cast(tableId, spellId);
                      setHeld(null);
                    }
                  }}
                  className="rounded bg-indigo-700 px-3 py-1 text-sm font-semibold hover:bg-indigo-600"
                >
                  Cast spell
                </button>
              ) : null}
              {defenderCommitted && (isAttacker || isDefender) ? (
                <button
                  type="button"
                  onClick={() => rt.resolveCombat(tableId)}
                  className="rounded bg-red-700 px-3 py-1 text-sm font-semibold hover:bg-red-600"
                >
                  Resolve combat
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {view?.lastCombat ? (
          <p className="text-sm text-slate-300" data-testid="last-combat">
            Combat: {view.lastCombat.attackerBonus} vs {view.lastCombat.defenderBonus}
            {view.lastCombat.defenderInstanceId
              ? view.lastCombat.razed
                ? ' — attacker wins, realm razed'
                : ' — defender holds, attacker discarded'
              : view.lastCombat.razed
                ? ' — realm razed'
                : ' — realm holds'}
          </p>
        ) : null}

        {foe ? (
          <section className="rounded-lg border border-slate-800 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-300">
              {foe.occupant?.email ?? 'Empty seat'}
              {foe.deckName ? ` · ${foe.deckName}` : ''}
            </h3>
            <div className="grid gap-2 md:grid-cols-4">
              <Zone
                id="foe-hand"
                label={`Hand (${isHidden(foe.hand) ? foe.hand.count : foe.hand.length})`}
                accept={false}
              >
                <FaceDownRow count={isHidden(foe.hand) ? foe.hand.count : foe.hand.length} />
              </Zone>
              <Zone id="foe-draw" label={`Draw (${foe.drawCount})`} accept={false}>
                <FaceDownRow count={foe.drawCount} />
              </Zone>
              <Zone id="foe-realms" label="Realms (click to target)" accept={false}>
                {foe.realms.map((instance) => (
                  <PlayCard
                    key={instance.instanceId}
                    instance={instance}
                    card={cardById.get(instance.cardId)}
                    selected={target === instance.instanceId}
                    razed={foe.razedInstanceIds.includes(instance.instanceId)}
                    onPick={
                      canAct
                        ? (id) => {
                            setTarget(id);
                          }
                        : undefined
                    }
                    onSelect={setDetail}
                  />
                ))}
              </Zone>
              <Zone id="foe-pool" label="Pool / champions" accept={false}>
                {renderCards(foe.pool, {})}
              </Zone>
            </div>
            {foe.discard.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Discard</p>
                <div className="flex flex-wrap gap-1">{renderCards(foe.discard, {})}</div>
              </div>
            ) : null}
          </section>
        ) : null}

        {youSeat !== null && you ? (
          <>
            <section className="rounded-lg border border-emerald-900/50 p-3">
              <h3 className="mb-2 text-sm font-semibold text-emerald-300">
                You ({user?.email}){you.deckName ? ` · ${you.deckName}` : ' · no deck'}
              </h3>
              <div className="grid gap-2 md:grid-cols-3">
                <Zone
                  id="zone:realms"
                  label="Realms"
                  accept={
                    canAct &&
                    (heldTypeId === undefined || canMoveToZone(heldTypeId, 'realms') === null)
                  }
                >
                  {renderCards(you.realms, {
                    draggable: canAct,
                    razedIds: you.razedInstanceIds,
                    pickable: canAct,
                  })}
                </Zone>
                <Zone
                  id="zone:pool"
                  label="Pool / champions"
                  accept={
                    canAct &&
                    (heldTypeId === undefined || canMoveToZone(heldTypeId, 'pool') === null)
                  }
                >
                  {renderCards(you.pool, {
                    draggable: canAct,
                    pickable: canAct || (isDefender && !defenderCommitted),
                  })}
                </Zone>
                <Zone id="zone:discard" label="Discard" accept={canAct}>
                  {renderCards(you.discard, { draggable: canAct, pickable: canAct })}
                </Zone>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Draw pile: {you.drawCount}</span>
                {view?.status === 'playing' ? (
                  <>
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => rt.draw(tableId)}
                      className="rounded bg-sky-700 px-3 py-1 text-sm font-semibold hover:bg-sky-600 disabled:opacity-40"
                    >
                      Draw
                    </button>
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => rt.passTurn(tableId)}
                      className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-40"
                    >
                      Pass turn
                    </button>
                    {canAttack ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (attackAttackerId && attackTargetId) {
                            rt.attack(tableId, attackAttackerId, attackTargetId);
                          }
                        }}
                        className="rounded bg-red-700 px-3 py-1 text-sm font-semibold hover:bg-red-600"
                      >
                        Attack realm
                      </button>
                    ) : null}
                    {held && canAct ? (
                      <>
                        {heldTypeId === undefined || canMoveToZone(heldTypeId, 'pool') === null ? (
                          <button
                            type="button"
                            onClick={() => playHeld('pool')}
                            className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold hover:bg-emerald-600"
                          >
                            Play to pool
                          </button>
                        ) : null}
                        {heldTypeId === undefined ||
                        canMoveToZone(heldTypeId, 'realms') === null ? (
                          <button
                            type="button"
                            onClick={() => playHeld('realms')}
                            className="rounded bg-emerald-800 px-3 py-1 text-sm font-semibold hover:bg-emerald-700"
                          >
                            Play to realms
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => playHeld('discard')}
                          className="rounded bg-slate-600 px-3 py-1 text-sm hover:bg-slate-500"
                        >
                          Discard
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <form onSubmit={loadDeck} className="flex gap-1">
                      <select
                        value={deckId}
                        onChange={(e) => setDeckId(e.target.value)}
                        aria-label="Choose deck"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                      >
                        <option value="">Choose a saved deck…</option>
                        {(decksQuery.data ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold hover:bg-slate-600"
                      >
                        Load
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => rt.start(tableId)}
                      className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold hover:bg-emerald-500"
                    >
                      Start game
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Your hand {Array.isArray(you.hand) ? `(${you.hand.length})` : ''} — click a card,
                then Play to pool / realms / discard (or drag). Select a pool champion and an
                opponent realm to attack. During a fight, select an ally or spell.
              </p>
              <Zone id="zone:hand" label="" accept={false}>
                {Array.isArray(you.hand) ? (
                  renderCards(you.hand, { draggable: canAct, pickable: canAct || canPlayAlly })
                ) : (
                  <FaceDownRow count={you.hand.count} />
                )}
              </Zone>
            </section>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Sit to load a deck and play. Spectators can watch public zones.
          </p>
        )}
      </div>
      <CardDetailDialog card={detail} onClose={() => setDetail(null)} />
    </DndContext>
  );
}
