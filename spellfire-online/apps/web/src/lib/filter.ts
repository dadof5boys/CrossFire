import type { Card } from '@spellfire/shared';
import type MiniSearch from 'minisearch';

export interface FilterState {
  query: string;
  set: string;
  type: string;
  world: string;
  rarity: string;
}

export const EMPTY_FILTER: FilterState = {
  query: '',
  set: '',
  type: '',
  world: '',
  rarity: '',
};

export interface Facets {
  types: string[];
  worlds: string[];
  rarities: string[];
}

/** Distinct, sorted facet values derived from the card collection. */
export function computeFacets(cards: Card[]): Facets {
  const types = new Set<string>();
  const worlds = new Set<string>();
  const rarities = new Set<string>();
  for (const card of cards) {
    types.add(card.type);
    worlds.add(card.world);
    if (card.rarity) rarities.add(card.rarity);
  }
  const sorted = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b));
  return { types: sorted(types), worlds: sorted(worlds), rarities: sorted(rarities) };
}

/**
 * Apply the text query (via the search index) and the facet filters. Pure and
 * synchronous so it is trivially unit-testable.
 */
export function filterCards(cards: Card[], filter: FilterState, index?: MiniSearch<Card>): Card[] {
  let result = cards;

  const query = filter.query.trim();
  if (query && index) {
    const matchedIds = new Set(index.search(query).map((r) => String(r.id)));
    result = result.filter((c) => matchedIds.has(c.id));
  }
  if (filter.set) result = result.filter((c) => c.setId === filter.set);
  if (filter.type) result = result.filter((c) => c.type === filter.type);
  if (filter.world) result = result.filter((c) => c.world === filter.world);
  if (filter.rarity) result = result.filter((c) => c.rarity === filter.rarity);

  return result;
}
