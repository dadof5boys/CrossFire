import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Card, CardInstance, HiddenPile, PlayZone, SeatView } from '@spellfire/shared';
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

export default function PlayPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const { isAuthed, user } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);
  const rt = useRealtime();
  const view = usePlayStore((s) => s.view);
  const tables = useChatStore((s) => s.tables);
  const { cardById } = useDataset();
  const decksQuery = useDecksQuery();
  const [deckId, setDeckId] = useState('');
  const [detail, setDetail] = useState<Card | null>(null);
  const [held, setHeld] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!tableId || !isAuthed) return;
    const alreadyHere = tables.some(
      (t) => t.id === tableId && t.occupants.some((o) => o.userId === user?.id),
    );
    if (!alreadyHere) rt.joinTable(tableId);
    rt.syncPlay(tableId);
  }, [tableId, isAuthed, tables, user?.id, rt]);

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

  const onDragEnd = (event: DragEndEvent) => {
    const instanceId = event.active.data.current?.instanceId as string | undefined;
    const overId = event.over?.id;
    if (!instanceId || typeof overId !== 'string' || !overId.startsWith('zone:')) return;
    const toZone = overId.slice('zone:'.length) as PlayZone;
    if (toZone === 'draw') return;
    rt.move(tableId, instanceId, toZone);
    setHeld(null);
  };

  const playHeld = (toZone: PlayZone) => {
    if (!tableId || !held || toZone === 'draw') return;
    rt.move(tableId, held, toZone);
    setHeld(null);
  };

  const loadDeck = (e: FormEvent) => {
    e.preventDefault();
    if (deckId) rt.loadDeck(tableId, deckId);
  };

  const renderCards = (cards: CardInstance[], draggable: boolean) =>
    cards.map((instance) => (
      <PlayCard
        key={instance.instanceId}
        instance={instance}
        card={cardById.get(instance.cardId)}
        draggable={draggable}
        selected={held === instance.instanceId}
        onPick={draggable ? setHeld : undefined}
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
              ? `Turn ${view.turnNumber} · ${view.seats[view.activeSeat].occupant?.email ?? 'empty'} to play`
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
              <Zone id="foe-realms" label="Realms" accept={false}>
                {renderCards(foe.realms, false)}
              </Zone>
              <Zone id="foe-pool" label="Pool / champions" accept={false}>
                {renderCards(foe.pool, false)}
              </Zone>
            </div>
            {foe.discard.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Discard</p>
                <div className="flex flex-wrap gap-1">{renderCards(foe.discard, false)}</div>
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
                <Zone id="zone:realms" label="Realms" accept={view?.status === 'playing'}>
                  {renderCards(you.realms, view?.status === 'playing')}
                </Zone>
                <Zone id="zone:pool" label="Pool / champions" accept={view?.status === 'playing'}>
                  {renderCards(you.pool, view?.status === 'playing')}
                </Zone>
                <Zone id="zone:discard" label="Discard" accept={view?.status === 'playing'}>
                  {renderCards(you.discard, view?.status === 'playing')}
                </Zone>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Draw pile: {you.drawCount}</span>
                {view?.status === 'playing' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => rt.draw(tableId)}
                      className="rounded bg-sky-700 px-3 py-1 text-sm font-semibold hover:bg-sky-600"
                    >
                      Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => rt.passTurn(tableId)}
                      className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                    >
                      Pass turn
                    </button>
                    {held ? (
                      <>
                        <button
                          type="button"
                          onClick={() => playHeld('pool')}
                          className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold hover:bg-emerald-600"
                        >
                          Play to pool
                        </button>
                        <button
                          type="button"
                          onClick={() => playHeld('realms')}
                          className="rounded bg-emerald-800 px-3 py-1 text-sm font-semibold hover:bg-emerald-700"
                        >
                          Play to realms
                        </button>
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
                then Play to pool / realms / discard (or drag)
              </p>
              <Zone id="zone:hand" label="" accept={view?.status === 'playing'}>
                {Array.isArray(you.hand) ? (
                  renderCards(you.hand, view?.status === 'playing')
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
