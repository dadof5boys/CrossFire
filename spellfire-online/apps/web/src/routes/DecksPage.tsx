import type { SavedDeck } from '@spellfire/shared';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { useDecksQuery, useDeleteDeck } from '../hooks/useDecks.js';
import { totalCount } from '../lib/deck.js';
import { useDeckStore } from '../store/deckStore.js';

function exportDeck(deck: SavedDeck): void {
  const payload = JSON.stringify({ name: deck.name, cards: deck.cards }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.name || 'deck'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DecksPage() {
  const { isAuthed } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);
  const decksQuery = useDecksQuery();
  const deleteDeck = useDeleteDeck();
  const load = useDeckStore((s) => s.load);
  const navigate = useNavigate();

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <h2 className="mb-3 text-xl font-semibold">Saved decks</h2>
        <p className="mb-4 text-slate-400">Sign in to view and manage your decks.</p>
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

  const onLoad = (deck: SavedDeck) => {
    load({ id: deck.id, name: deck.name, entries: deck.cards });
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-xl font-semibold">Saved decks</h2>
      {decksQuery.isLoading ? (
        <p className="text-slate-400">Loading…</p>
      ) : decksQuery.isError ? (
        <p className="text-red-400">Failed to load decks.</p>
      ) : !decksQuery.data || decksQuery.data.length === 0 ? (
        <p className="text-slate-500">
          No saved decks yet. Build one in the browser and click <em>Create deck</em>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {decksQuery.data.map((deck) => (
            <li
              key={deck.id}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{deck.name}</p>
                <p className="text-xs text-slate-400">
                  {totalCount(deck.cards)} cards · updated{' '}
                  {new Date(deck.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLoad(deck)}
                className="rounded bg-sky-600 px-2.5 py-1 text-sm font-semibold hover:bg-sky-500"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => exportDeck(deck)}
                className="rounded bg-slate-700 px-2.5 py-1 text-sm hover:bg-slate-600"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => deleteDeck.mutate(deck.id)}
                className="rounded px-2.5 py-1 text-sm text-red-400 hover:bg-red-500/20"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
