import type { Card } from '@spellfire/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, computeFacets, filterCards } from './filter.js';
import { buildIndex } from './search.js';

function card(p: Partial<Card> & Pick<Card, 'id' | 'setId' | 'number' | 'title'>): Card {
  return {
    text: '',
    typeId: 0,
    type: 'Realm',
    worldId: 0,
    world: 'Forgotten Realms',
    isAvatar: false,
    bonus: null,
    bonusRaw: '',
    rarity: 'C',
    blueLine: '',
    attrCodes: [],
    usesCodes: [],
    uses: [],
    weight: 1,
    image: null,
    ...p,
  };
}

const cards: Card[] = [
  card({ id: '1st/1', setId: '1st', number: 1, title: 'Waterdeep', type: 'Realm', rarity: 'M' }),
  card({
    id: 'FR/2',
    setId: 'FR',
    number: 2,
    title: 'Elminster',
    type: 'Wizard',
    rarity: 'R',
    text: 'a powerful mage',
  }),
  card({
    id: 'RL/3',
    setId: 'RL',
    number: 3,
    title: 'Strahd',
    type: 'Wizard',
    world: 'Ravenloft',
    rarity: 'U',
  }),
];

describe('computeFacets', () => {
  it('collects distinct sorted facet values', () => {
    const facets = computeFacets(cards);
    expect(facets.types).toEqual(['Realm', 'Wizard']);
    expect(facets.worlds).toEqual(['Forgotten Realms', 'Ravenloft']);
    expect(facets.rarities).toEqual(['M', 'R', 'U']);
  });
});

describe('filterCards', () => {
  it('returns everything with an empty filter', () => {
    expect(filterCards(cards, EMPTY_FILTER)).toHaveLength(3);
  });

  it('filters by set', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, set: 'FR' }).map((c) => c.id)).toEqual(['FR/2']);
  });

  it('filters by type', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, type: 'Wizard' }).map((c) => c.id)).toEqual([
      'FR/2',
      'RL/3',
    ]);
  });

  it('filters by world', () => {
    expect(filterCards(cards, { ...EMPTY_FILTER, world: 'Ravenloft' }).map((c) => c.id)).toEqual([
      'RL/3',
    ]);
  });

  it('applies a text query via the search index', () => {
    const index = buildIndex(cards);
    expect(
      filterCards(cards, { ...EMPTY_FILTER, query: 'Waterdeep' }, index).map((c) => c.id),
    ).toEqual(['1st/1']);
  });

  it('combines query and facet filters', () => {
    const index = buildIndex(cards);
    const result = filterCards(cards, { ...EMPTY_FILTER, query: 'mage', type: 'Wizard' }, index);
    expect(result.map((c) => c.id)).toEqual(['FR/2']);
  });
});
