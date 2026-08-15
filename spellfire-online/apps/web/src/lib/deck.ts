export interface DeckEntry {
  cardId: string;
  qty: number;
}

/**
 * Add `delta` copies of a card to the deck entries (immutably). A non-positive
 * resulting quantity removes the entry. Adding to a missing card with a
 * negative delta is a no-op.
 */
export function addEntry(entries: DeckEntry[], cardId: string, delta = 1): DeckEntry[] {
  const index = entries.findIndex((e) => e.cardId === cardId);
  const existing = index === -1 ? undefined : entries[index];
  if (!existing) {
    return delta > 0 ? [...entries, { cardId, qty: delta }] : entries;
  }
  const qty = existing.qty + delta;
  if (qty <= 0) return entries.filter((_, i) => i !== index);
  return entries.map((e, i) => (i === index ? { cardId, qty } : e));
}

export function removeEntry(entries: DeckEntry[], cardId: string): DeckEntry[] {
  return entries.filter((e) => e.cardId !== cardId);
}

export function totalCount(entries: DeckEntry[]): number {
  return entries.reduce((sum, e) => sum + e.qty, 0);
}
