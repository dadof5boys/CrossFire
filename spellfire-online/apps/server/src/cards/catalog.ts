import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CardFacts {
  typeId: number;
  bonus: number | null;
}

export type CardLookup = (cardId: string) => CardFacts | undefined;

let cache: Map<string, CardFacts> | null = null;

function findCardsJson(): string {
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const candidate = resolve(dir, 'packages/data-pipeline/data/cards.json');
      if (existsSync(candidate)) return candidate;
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('cards.json not found (walked up from catalog.ts and cwd)');
}

export function loadCatalog(): Map<string, CardFacts> {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(findCardsJson(), 'utf8')) as {
    cards?: { id: string; typeId: number; bonus: number | null }[];
  };
  if (!Array.isArray(raw.cards)) {
    throw new Error('cards.json is missing a cards array');
  }
  cache = new Map(raw.cards.map((c) => [c.id, { typeId: c.typeId, bonus: c.bonus }]));
  return cache;
}

export function getCardFacts(cardId: string): CardFacts | undefined {
  return loadCatalog().get(cardId);
}
