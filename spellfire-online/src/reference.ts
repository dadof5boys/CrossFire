import {
  type CardSet,
  CardSetSchema,
  type CardType,
  CardTypeSchema,
  type World,
  WorldSchema,
} from './schema.js';
import { extractBracedSet, splitList } from './tcl.js';

/**
 * Extracts the reference tables (card sets, worlds, card types) and the "uses"
 * code decoder from the legacy `Scripts/CommonV.tcl`, which defines them as
 * `cardSetInfo`, `worldInfo`, and `cardTypeInfo` data lists.
 */

function requireBlock(commonV: string, varName: string): string {
  const block = extractBracedSet(commonV, varName);
  if (block === null) {
    throw new Error(`Could not find '${varName}' in CommonV.tcl`);
  }
  return block;
}

/** Legacy `cardSetInfo`: {class id name numLimits chaseQty tclFile sfdbID [author]}. */
export function parseSets(commonV: string): CardSet[] {
  const rows = splitList(requireBlock(commonV, 'cardSetInfo'));
  return rows.map((row) => {
    const f = splitList(row);
    const numLimits = splitList(f[3] ?? '')
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => !Number.isNaN(n));
    return CardSetSchema.parse({
      class: f[0],
      id: f[1],
      name: f[2],
      numLimits,
      chaseQty: Number.parseInt(f[4] ?? '0', 10) || 0,
      tclFile: f[5] ?? '',
      sfdbId: f[6] ?? '',
    });
  });
}

/** Legacy `worldInfo`: {class worldID name imageName imageFile shortName}. */
export function parseWorlds(commonV: string): World[] {
  const rows = splitList(requireBlock(commonV, 'worldInfo'));
  return rows.map((row) => {
    const f = splitList(row);
    return WorldSchema.parse({
      class: f[0],
      id: Number.parseInt(f[1] ?? '', 10),
      name: f[2],
      shortName: f[5] ?? '',
    });
  });
}

/** Legacy `cardTypeInfo`: {id name championBool usableFlag iconName iconFile}. */
export function parseCardTypes(commonV: string): CardType[] {
  const rows = splitList(requireBlock(commonV, 'cardTypeInfo'));
  return rows.map((row) => {
    const f = splitList(row);
    return CardTypeSchema.parse({
      id: Number.parseInt(f[0] ?? '', 10),
      name: f[1],
      isChampion: f[2] === '1',
      usable: Number.parseInt(f[3] ?? '0', 10) || 0,
    });
  });
}

/**
 * Builds a decoder for the legacy "uses" codes found in card field 11.
 *
 * Codes are `<typeId>` (usable=1), or `d<typeId>` / `o<typeId>` (usable=2,
 * defensive / offensive). Two special ids (101/102) are defined separately in
 * CommonV.tcl for dragon/undead unarmed combat.
 */
export function buildUsesDecoder(cardTypes: CardType[]): (code: string) => string {
  const map = new Map<string, string>();
  for (const t of cardTypes) {
    if (t.usable === 1) {
      map.set(String(t.id), t.name);
    } else if (t.usable === 2) {
      map.set(`d${t.id}`, `${t.name}, Def`);
      map.set(`o${t.id}`, `${t.name}, Off`);
    }
  }
  // Special usable ids defined outside cardTypeInfo.
  for (const [id, name] of [
    [101, 'Dragon Unarmed Combat'],
    [102, 'Undead Unarmed Combat'],
  ] as const) {
    map.set(`d${id}`, `${name}, Def`);
    map.set(`o${id}`, `${name}, Off`);
  }
  return (code: string) => map.get(code) ?? code;
}
