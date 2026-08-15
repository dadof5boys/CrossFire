import { create } from 'zustand';
import { type DeckEntry, addEntry, removeEntry, totalCount } from '../lib/deck.js';

interface DeckState {
  name: string;
  entries: DeckEntry[];
  /** Id of the saved (server) deck currently loaded (undefined = unsaved/new). */
  currentId: string | undefined;
  add: (cardId: string) => void;
  decrement: (cardId: string) => void;
  remove: (cardId: string) => void;
  setName: (name: string) => void;
  clear: () => void;
  load: (deck: { id?: string; name: string; entries: DeckEntry[] }) => void;
  count: () => number;
}

export const useDeckStore = create<DeckState>((set, get) => ({
  name: 'New Deck',
  entries: [],
  currentId: undefined,
  add: (cardId) => set((s) => ({ entries: addEntry(s.entries, cardId, 1) })),
  decrement: (cardId) => set((s) => ({ entries: addEntry(s.entries, cardId, -1) })),
  remove: (cardId) => set((s) => ({ entries: removeEntry(s.entries, cardId) })),
  setName: (name) => set({ name }),
  clear: () => set({ name: 'New Deck', entries: [], currentId: undefined }),
  load: (deck) => set({ name: deck.name, entries: deck.entries, currentId: deck.id }),
  count: () => totalCount(get().entries),
}));
