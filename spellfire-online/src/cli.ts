import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { convertCards, loadReferenceTables } from './cards.js';
import { convertCombos, convertDecks } from './decks.js';
import { parseSets } from './reference.js';
import { CardDatabaseSchema } from './schema.js';

// This project lives at `<CrossFire>/spellfire-online`, so the legacy source
// defaults to the parent directory (the CrossFire repo root).
const DEFAULT_CROSSFIRE_DIR = join(process.cwd(), '..');

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const crossfireDir = process.argv[2] ?? process.env.CROSSFIRE_DIR ?? DEFAULT_CROSSFIRE_DIR;
  const outDir = join(process.cwd(), 'data');
  await mkdir(outDir, { recursive: true });

  console.log(`Reading CrossFire source from: ${crossfireDir}`);
  const commonV = await readFile(join(crossfireDir, 'Scripts', 'CommonV.tcl'), 'utf8');

  const sets = parseSets(commonV);
  const { cardTypes, worlds } = loadReferenceTables(commonV);

  const { cards, skipped, anomalies } = await convertCards(crossfireDir, cardTypes, worlds);
  const imageCount = cards.filter((c) => c.image !== null).length;

  const database = CardDatabaseSchema.parse({
    generatedAt: new Date().toISOString(),
    counts: {
      cards: cards.length,
      sets: sets.length,
      cardTypes: cardTypes.length,
      worlds: worlds.length,
      images: imageCount,
    },
    sets,
    cardTypes,
    worlds,
    cards,
  });

  await writeJson(join(outDir, 'cards.json'), database);

  const decks = await convertDecks(crossfireDir);
  const combos = await convertCombos(crossfireDir);
  await writeJson(join(outDir, 'decks.json'), decks);
  await writeJson(join(outDir, 'combos.json'), combos);

  console.log('\n=== Spellfire Online data pipeline ===');
  console.log(`  cards      : ${cards.length}`);
  console.log(`  sets       : ${sets.length}`);
  console.log(`  cardTypes  : ${cardTypes.length}`);
  console.log(`  worlds     : ${worlds.length}`);
  console.log(`  with image : ${imageCount} / ${cards.length}`);
  console.log(`  decks      : ${decks.length}`);
  console.log(`  combos     : ${combos.length}`);
  console.log(`  skipped rows (headers): ${skipped.length}`);
  if (anomalies.length > 0) {
    console.log(`\n  anomalies (${anomalies.length}):`);
    for (const a of anomalies.slice(0, 20)) console.log(`    - ${a}`);
    if (anomalies.length > 20) console.log(`    ... and ${anomalies.length - 20} more`);
  }
  console.log(`\nWrote: ${join(outDir, 'cards.json')} (+ decks.json, combos.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
