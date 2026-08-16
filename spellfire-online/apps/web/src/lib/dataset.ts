import type { CardDatabase } from '@spellfire/shared';

/**
 * Load the combined card dataset produced by the data pipeline. It is served as
 * a static asset from `public/data/cards.json` (copied there by `sync-data`).
 * Build-time validation already guarantees the shape, so we don't re-run Zod
 * over 6k records on every page load.
 */
export async function fetchDataset(): Promise<CardDatabase> {
  const res = await fetch('/data/cards.json');
  if (!res.ok) {
    throw new Error(`Failed to load card data (HTTP ${res.status})`);
  }
  return (await res.json()) as CardDatabase;
}
