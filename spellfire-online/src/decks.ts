import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  type CardRef,
  CardRefSchema,
  type Combo,
  ComboSchema,
  type Deck,
  DeckSchema,
} from './schema.js';
import { parseSetVars, splitList } from './tcl.js';

/** Parse a `{set num} {set num} ...` list into typed card references. */
export function parseCardRefs(listStr: string | undefined): CardRef[] {
  if (!listStr) return [];
  const refs: CardRef[] = [];
  for (const pair of splitList(listStr)) {
    const parts = splitList(pair);
    if (parts.length < 2) continue;
    const number = Number.parseInt(parts[1] ?? '', 10);
    if (Number.isNaN(number)) continue;
    refs.push(CardRefSchema.parse({ setId: parts[0], number }));
  }
  return refs;
}

export function parseDeck(text: string, source: string): Deck {
  const v = parseSetVars(text);
  const sizeRaw = v.get('tempDeckSize');
  const deckSize = sizeRaw ? Number.parseInt(sizeRaw, 10) : Number.NaN;
  return DeckSchema.parse({
    title: v.get('tempDeckTitle') ?? '',
    deckSize: Number.isNaN(deckSize) ? null : deckSize,
    author: v.get('tempAuthorName') ?? '',
    authorEmail: v.get('tempAuthorEmail') ?? '',
    notes: v.get('tempNotes') ?? '',
    displayMode: v.get('tempDeckDisplayMode') ?? '',
    cards: parseCardRefs(v.get('tempDeck')),
    altCards: parseCardRefs(v.get('tempAltCards')),
    source,
  });
}

export function parseCombo(text: string, source: string): Combo {
  const v = parseSetVars(text);
  return ComboSchema.parse({
    title: v.get('tempComboTitle') ?? '',
    author: v.get('tempAuthorName') ?? '',
    authorEmail: v.get('tempAuthorEmail') ?? '',
    text: v.get('tempComboText') ?? '',
    cards: parseCardRefs(v.get('tempCombo')),
    source,
  });
}

/** Recursively list files under `dir` whose name ends with `ext`. */
async function walk(dir: string, ext: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, ext)));
    } else if (entry.name.toLowerCase().endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

export async function convertDecks(crossfireDir: string): Promise<Deck[]> {
  const files = (await walk(join(crossfireDir, 'Decks'), '.cfd')).sort();
  const decks: Deck[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    decks.push(parseDeck(text, relative(crossfireDir, file)));
  }
  return decks;
}

export async function convertCombos(crossfireDir: string): Promise<Combo[]> {
  const files = (await walk(join(crossfireDir, 'Combos'), '.cfc')).sort();
  const combos: Combo[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    combos.push(parseCombo(text, relative(crossfireDir, file)));
  }
  return combos;
}
