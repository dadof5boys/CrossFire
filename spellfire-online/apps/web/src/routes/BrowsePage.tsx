import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { Card } from '@spellfire/shared';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { CardDetailDialog } from '../components/CardDetailDialog.js';
import { CardTile } from '../components/CardTile.js';
import { DeckPanel } from '../components/DeckPanel.js';
import { FilterBar } from '../components/FilterBar.js';
import { useDataset } from '../data/DatasetProvider.js';
import { EMPTY_FILTER, computeFacets, filterCards } from '../lib/filter.js';
import { useDeckStore } from '../store/deckStore.js';

const PAGE_SIZE = 48;

export default function BrowsePage() {
  const { db, index } = useDataset();
  const add = useDeckStore((s) => s.add);
  const { isAuthed } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);

  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Card | null>(null);

  const facets = useMemo(() => computeFacets(db.cards), [db.cards]);
  const filtered = useMemo(() => filterCards(db.cards, filter, index), [db.cards, filter, index]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the result set changes
  useEffect(() => setPage(0), [filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const cardId = e.active.data.current?.cardId as string | undefined;
    if (e.over?.id !== 'deck-dropzone' || !cardId) return;
    if (!isAuthed) {
      openAuth();
      return;
    }
    add(cardId);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid h-full grid-cols-[240px_1fr_340px]">
        <FilterBar
          filter={filter}
          onChange={setFilter}
          facets={facets}
          sets={db.sets}
          resultCount={filtered.length}
          totalCount={db.cards.length}
        />

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={clampedPage === 0}
                onClick={() => setPage(clampedPage - 1)}
                className="rounded bg-slate-800 px-2 py-1 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-400">
                Page {clampedPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={clampedPage >= pageCount - 1}
                onClick={() => setPage(clampedPage + 1)}
                className="rounded bg-slate-800 px-2 py-1 text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {pageItems.length === 0 ? (
              <p className="mt-10 text-center text-slate-500">No cards match your filters.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pageItems.map((card) => (
                  <CardTile key={card.id} card={card} onSelect={setSelected} />
                ))}
              </div>
            )}
          </div>
        </section>

        <DeckPanel />
      </div>

      <CardDetailDialog card={selected} onClose={() => setSelected(null)} />
    </DndContext>
  );
}
