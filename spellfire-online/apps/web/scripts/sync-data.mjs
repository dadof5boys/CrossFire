// Copies the generated dataset from the data-pipeline package into the web
// app's public/ dir so Vite serves it as a static asset. Runs before dev/build.
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataSrc = join(webRoot, '..', '..', 'packages', 'data-pipeline', 'data');
const dest = join(webRoot, 'public', 'data');
const files = ['cards.json', 'decks.json', 'combos.json'];

await mkdir(dest, { recursive: true });
for (const file of files) {
  const from = join(dataSrc, file);
  try {
    await access(from);
  } catch {
    console.warn(`[sync-data] missing ${from} — run \`pnpm build:data\` first`);
    continue;
  }
  await cp(from, join(dest, file));
}
console.log(`[sync-data] copied dataset -> ${dest}`);
