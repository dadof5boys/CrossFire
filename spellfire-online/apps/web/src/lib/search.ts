import type { Card } from '@spellfire/shared';
import MiniSearch from 'minisearch';

/** Build a full-text search index over the card collection. */
export function buildIndex(cards: Card[]): MiniSearch<Card> {
  const index = new MiniSearch<Card>({
    idField: 'id',
    fields: ['title', 'text', 'type', 'world', 'blueLine', 'setId'],
    storeFields: ['id'],
    searchOptions: { prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  });
  index.addAll(cards);
  return index;
}
