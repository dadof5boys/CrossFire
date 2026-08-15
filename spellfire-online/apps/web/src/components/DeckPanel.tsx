import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { useDataset } from '../data/DatasetProvider.js';
import { useCreateDeck, useUpdateDeck } from '../hooks/useDecks.js';
import { useDeckStore } from '../store/deckStore.js';

export function DeckPanel() {
  const { cardById } = useDataset();
  const { isAuthed } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);

  const name = useDeckStore((s) => s.name);
  const entries = useDeckStore((s) => s.entries);
  const currentId = useDeckStore((s) => s.currentId);
  const setName = useDeckStore((s) => s.setName);
  const add = useDeckStore((s) => s.add);
  const decrement = useDeckStore((s) => s.decrement);
  const remove = useDeckStore((s) => s.remove);
  const clear = useDeckStore((s) => s.clear);
  const load = useDeckStore((s) => s.load);

  const { isOver, setNodeRef } = useDroppable({ id: 'deck-dropzone' });
  const createDeck = useCreateDeck();
  const updateDeck = useUpdateDeck();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = entries.reduce((n, e) => n + e.qty, 0);
  const saving = createDeck.isPending || updateDeck.isPending;

  const onSave = async () => {
    setError(null);
    try {
      const input = { name, cards: entries };
      const saved = currentId
        ? await updateDeck.mutateAsync({ id: currentId, input })
        : await createDeck.mutateAsync(input);
      load({ id: saved.id, name: saved.name, entries: saved.cards });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <aside
      ref={setNodeRef}
      className={`flex flex-col border-l border-slate-800 bg-slate-900/50 ${
        isOver ? 'ring-2 ring-inset ring-emerald-500' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 p-3">
        <h2 className="font-semibold">Deck ({total})</h2>
        <Link to="/decks" className="text-xs text-sky-400 hover:underline">
          Saved decks →
        </Link>
      </div>

      {!isAuthed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-slate-400">Sign in to build and save decks.</p>
          <button
            type="button"
            onClick={openAuth}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              aria-label="Deck name"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || entries.length === 0}
                className="flex-1 rounded bg-sky-600 px-2 py-1.5 text-sm font-semibold hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : currentId ? 'Save' : 'Create deck'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clear();
                  setSavedAt(null);
                  setError(null);
                }}
                className="rounded bg-slate-700 px-2 py-1.5 text-sm hover:bg-slate-600"
              >
                New
              </button>
            </div>
            {savedAt && <p className="text-xs text-emerald-400">Saved at {savedAt}</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {entries.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-500">
                Drag cards here, or click <span className="text-emerald-400">+ Add</span>.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {entries.map((e) => {
                  const card = cardById.get(e.cardId);
                  return (
                    <li
                      key={e.cardId}
                      className="flex items-center gap-2 rounded bg-slate-800/70 px-2 py-1 text-sm"
                    >
                      <span className="w-6 text-right tabular-nums text-slate-400">{e.qty}×</span>
                      <span className="min-w-0 flex-1 truncate" title={card?.title ?? e.cardId}>
                        {card?.title ?? e.cardId}
                        <span className="ml-1 text-xs text-slate-500">{e.cardId}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => decrement(e.cardId)}
                        className="rounded bg-slate-700 px-1.5 hover:bg-slate-600"
                        aria-label={`Remove one ${card?.title ?? e.cardId}`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => add(e.cardId)}
                        className="rounded bg-slate-700 px-1.5 hover:bg-slate-600"
                        aria-label={`Add one ${card?.title ?? e.cardId}`}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(e.cardId)}
                        className="rounded px-1.5 text-red-400 hover:bg-red-500/20"
                        aria-label={`Remove ${card?.title ?? e.cardId}`}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
