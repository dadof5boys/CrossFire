import type { Card, CardDatabase } from '@spellfire/shared';
import type MiniSearch from 'minisearch';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { fetchDataset } from '../lib/dataset.js';
import { buildIndex } from '../lib/search.js';

interface DatasetValue {
  db: CardDatabase;
  index: MiniSearch<Card>;
  cardById: Map<string, Card>;
  setNameById: Map<string, string>;
}

const DatasetContext = createContext<DatasetValue | null>(null);

export function useDataset(): DatasetValue {
  const value = useContext(DatasetContext);
  if (!value) throw new Error('useDataset must be used within <DatasetProvider>');
  return value;
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<DatasetValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDataset()
      .then((db) => {
        if (!alive) return;
        setValue({
          db,
          index: buildIndex(db.cards),
          cardById: new Map(db.cards.map((c) => [c.id, c])),
          setNameById: new Map(db.sets.map((s) => [s.id, s.name])),
        });
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <div className="p-8 text-red-400">Failed to load card data: {error}</div>;
  }
  if (!value) {
    return <div className="p-8 text-slate-400">Loading card database…</div>;
  }
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}
