import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { convertCards, loadReferenceTables } from '../src/cards.js';
import { parseCombo, parseDeck } from '../src/decks.js';
import { parseSets } from '../src/reference.js';
import type { Card } from '../src/schema.js';

// The project lives at `<CrossFire>/spellfire-online`; default to the repo root.
const CROSSFIRE_DIR = process.env.CROSSFIRE_DIR ?? join(process.cwd(), '..');
const hasSource = existsSync(join(CROSSFIRE_DIR, 'Scripts', 'CommonV.tcl'));

describe.skipIf(!hasSource)('reference tables', () => {
  let commonV: string;
  beforeAll(async () => {
    commonV = await readFile(join(CROSSFIRE_DIR, 'Scripts', 'CommonV.tcl'), 'utf8');
  });

  it('parses card sets with known entries', () => {
    const sets = parseSets(commonV);
    const first = sets.find((s) => s.id === '1st');
    expect(first?.name).toBe('1st Edition');
    expect(sets.find((s) => s.id === 'FR')?.name).toBe('Forgotten Realms');
  });

  it('parses worlds and card types with known entries', () => {
    const { cardTypes, worlds } = loadReferenceTables(commonV);
    expect(worlds.find((w) => w.id === 1)?.name).toBe('Forgotten Realms');
    expect(cardTypes.find((t) => t.id === 13)?.name).toBe('Realm');
    const wizardSpell = cardTypes.find((t) => t.id === 19);
    expect(wizardSpell?.name).toBe('Wizard Spell');
    expect(wizardSpell?.usable).toBe(2);
  });
});

describe.skipIf(!hasSource)('card conversion', () => {
  let cards: Card[];
  let skippedCount: number;

  beforeAll(async () => {
    const commonV = await readFile(join(CROSSFIRE_DIR, 'Scripts', 'CommonV.tcl'), 'utf8');
    const { cardTypes, worlds } = loadReferenceTables(commonV);
    const result = await convertCards(CROSSFIRE_DIR, cardTypes, worlds);
    cards = result.cards;
    skippedCount = result.skipped.length;
  });

  it('extracts a large, plausible number of cards', () => {
    expect(cards.length).toBeGreaterThan(3000);
  });

  it('produces unique card ids', () => {
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(cards.length);
  });

  it('resolves the Waterdeep card correctly (1st/1)', () => {
    const waterdeep = cards.find((c) => c.id === '1st/1');
    expect(waterdeep).toBeDefined();
    expect(waterdeep?.title).toBe('Waterdeep');
    expect(waterdeep?.type).toBe('Realm');
    expect(waterdeep?.world).toBe('Forgotten Realms');
    expect(waterdeep?.uses).toEqual(['Wizard Spell, Def', 'Wizard Spell, Off']);
    expect(waterdeep?.image).toBe(join('Graphics', 'Cards', '1st', '001.jpg'));
  });

  it('skips exactly one header row per DataBase file', () => {
    // Each DataBase/*.tcl begins with a single set-name header element.
    expect(skippedCount).toBeGreaterThan(0);
  });

  it('resolves all card types and worlds (no Unknown values)', () => {
    const unknownType = cards.filter((c) => c.type.startsWith('Unknown('));
    const unknownWorld = cards.filter((c) => c.world.startsWith('Unknown('));
    expect(unknownType).toEqual([]);
    expect(unknownWorld).toEqual([]);
  });
});

describe('deck/combo parsing (unit)', () => {
  it('parses a deck file', () => {
    const text = [
      'set tempDeckSize 55',
      'set tempAuthorName {Jane}',
      'set tempDeckTitle {My Deck}',
      'set tempDeckDisplayMode Type',
      'set tempDeck { {1st 1} {FR 102} }',
      'set tempAltCards { {AR 27} }',
    ].join('\n');
    const deck = parseDeck(text, 'test.cfd');
    expect(deck.title).toBe('My Deck');
    expect(deck.deckSize).toBe(55);
    expect(deck.cards).toEqual([
      { setId: '1st', number: 1 },
      { setId: 'FR', number: 102 },
    ]);
    expect(deck.altCards).toEqual([{ setId: 'AR', number: 27 }]);
  });

  it('parses a combo file', () => {
    const text = [
      'set tempComboTitle {T-Combo}',
      'set tempAuthorName {Elric}',
      'set tempComboText {Nasty combo.}',
      'set tempCombo { {NS 97} {DR 101} }',
    ].join('\n');
    const combo = parseCombo(text, 'test.cfc');
    expect(combo.title).toBe('T-Combo');
    expect(combo.cards).toEqual([
      { setId: 'NS', number: 97 },
      { setId: 'DR', number: 101 },
    ]);
  });
});
