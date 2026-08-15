import Dexie, { type Table } from 'dexie';
import type { DeckEntry } from '../lib/deck.js';

export interface SavedDeck {
  id?: number;
  name: string;
  entries: DeckEntry[];
  updatedAt: number;
}

/** Local-first storage for user decks (IndexedDB via Dexie). */
class SpellfireDB extends Dexie {
  decks!: Table<SavedDeck, number>;

  constructor() {
    super('spellfire-online');
    this.version(1).stores({ decks: '++id, name, updatedAt' });
  }
}

export const db = new SpellfireDB();

export async function saveDeck(deck: Omit<SavedDeck, 'updatedAt'>): Promise<number> {
  return db.decks.put({ ...deck, updatedAt: Date.now() });
}

export async function deleteDeck(id: number): Promise<void> {
  await db.decks.delete(id);
}
