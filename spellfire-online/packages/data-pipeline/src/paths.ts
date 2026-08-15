import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Walk up from `startDir` to locate the CrossFire checkout — the first ancestor
 * directory that contains `Scripts/CommonV.tcl`. Returns null if none is found.
 *
 * This keeps the pipeline independent of how deeply it is nested in the
 * workspace (e.g. `spellfire-online/packages/data-pipeline`).
 */
export function findCrossfireDir(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);
  for (;;) {
    if (existsSync(join(dir, 'Scripts', 'CommonV.tcl'))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}
