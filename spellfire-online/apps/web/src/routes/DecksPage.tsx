import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { type SavedDeck, db, deleteDeck } from '../db/db.js';
import { totalCount } from '../lib/deck.js';
import { useDeckStore } from '../store/deckStore.js';

function exportDeck(deck: SavedDeck): void {
  const payload = JSON.stringify({ name: deck.name, entries: deck.entries }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.name || 'deck'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DecksPage() {
  const decks = useLiveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray(), []);
  const load = useDeckStore((s) => s.load);
  const navigate = useNavigate();

  const onLoad = (deck: SavedDeck) => {
    load({ id: deck.id, name: deck.name, entries: deck.entries });
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-xl font-semibold">Saved decks</h2>
      {!decks ? (
        <p className="text-slate-400">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="text-slate-500">
          No saved decks yet. Build one in the browser and click <em>Save</em>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{deck.name}</p>
                <p className="text-xs text-slate-400">
                  {totalCount(deck.entries)} cards · updated{' '}
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
                onClick={() => deck.id !== undefined && deleteDeck(deck.id)}
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
