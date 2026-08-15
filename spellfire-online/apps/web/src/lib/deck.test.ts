import { describe, expect, it } from 'vitest';
import { addEntry, removeEntry, totalCount } from './deck.js';

describe('deck logic', () => {
  it('adds a new card', () => {
    expect(addEntry([], '1st/1')).toEqual([{ cardId: '1st/1', qty: 1 }]);
  });

  it('increments an existing card', () => {
    const entries = addEntry([{ cardId: '1st/1', qty: 1 }], '1st/1');
    expect(entries).toEqual([{ cardId: '1st/1', qty: 2 }]);
  });

  it('decrements and removes at zero', () => {
    const entries = addEntry([{ cardId: '1st/1', qty: 1 }], '1st/1', -1);
    expect(entries).toEqual([]);
  });

  it('does not add on negative delta for a missing card', () => {
    expect(addEntry([], '1st/1', -1)).toEqual([]);
  });

  it('removes a card entirely', () => {
    const entries = removeEntry(
      [
        { cardId: '1st/1', qty: 3 },
        { cardId: 'FR/2', qty: 1 },
      ],
      '1st/1',
    );
    expect(entries).toEqual([{ cardId: 'FR/2', qty: 1 }]);
  });

  it('totals quantities', () => {
    expect(
      totalCount([
        { cardId: 'a', qty: 2 },
        { cardId: 'b', qty: 3 },
      ]),
    ).toBe(5);
  });
});
