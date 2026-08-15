import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildUsesDecoder, parseCardTypes, parseWorlds } from './reference.js';
import { type Card, CardSchema, type CardType, type World } from './schema.js';
import { extractBracedSet, splitList } from './tcl.js';

/** Number of positional fields in a card record (indices 0..12). */
const CARD_FIELD_COUNT = 13;

export interface ConvertCardsResult {
  cards: Card[];
  /** Non-card rows skipped (e.g. the leading set-name header in each file). */
  skipped: { file: string; fieldCount: number; raw: string }[];
  /** Rows that parsed but tripped a soft anomaly (recorded, not fatal). */
  anomalies: string[];
}

function imagePathFor(setId: string, num: number): string {
  return join('Graphics', 'Cards', setId, `${String(num).padStart(3, '0')}.jpg`);
}

function parseCardRow(
  fields: string[],
  ctx: {
    file: string;
    crossfireDir: string;
    typeName: Map<number, string>;
    worldName: Map<number, string>;
    decodeUses: (code: string) => string;
    anomalies: string[];
  },
): Card {
  const setId = fields[0] ?? '';
  const number = Number.parseInt(fields[1] ?? '', 10);

  // Field 2 is the level bonus. It is usually numeric, but some cards use a
  // variable bonus ("?", "+?"). Preserve the raw token and expose a numeric
  // value only when it parses cleanly.
  const bonusRaw = (fields[2] ?? '').trim();
  const bonusNum = Number.parseInt(bonusRaw, 10);
  const bonus = bonusRaw !== '' && !Number.isNaN(bonusNum) ? bonusNum : null;

  const typeId = Number.parseInt(fields[3] ?? '', 10);
  const worldId = Number.parseInt(fields[4] ?? '', 10);
  const weightRaw = (fields[12] ?? '').trim();
  const weight = weightRaw === '' ? 1 : Number.parseInt(weightRaw, 10) || 1;

  const usesCodes = splitList(fields[11] ?? '');
  const relImage = imagePathFor(setId, number);
  const hasImage = existsSync(join(ctx.crossfireDir, relImage));

  return CardSchema.parse({
    id: `${setId}/${number}`,
    setId,
    number,
    title: fields[6] ?? '',
    text: fields[7] ?? '',
    typeId,
    type: ctx.typeName.get(typeId) ?? `Unknown(${typeId})`,
    worldId,
    world: ctx.worldName.get(worldId) ?? `Unknown(${worldId})`,
    isAvatar: fields[5] === '1',
    bonus,
    bonusRaw,
    rarity: fields[8] ?? '',
    blueLine: fields[9] ?? '',
    attrCodes: splitList(fields[10] ?? ''),
    usesCodes,
    uses: usesCodes.map(ctx.decodeUses),
    weight,
    image: hasImage ? relImage : null,
  });
}

/**
 * Convert every `DataBase/*.tcl` file in a CrossFire checkout into typed cards.
 * Each file assigns `CrossFire::cardDataBase` to a list whose first element is
 * the set-name header (skipped) followed by one element per card.
 */
export async function convertCards(
  crossfireDir: string,
  cardTypes: CardType[],
  worlds: World[],
): Promise<ConvertCardsResult> {
  const typeName = new Map(cardTypes.map((t) => [t.id, t.name]));
  const worldName = new Map(worlds.map((w) => [w.id, w.name]));
  const decodeUses = buildUsesDecoder(cardTypes);

  const dbDir = join(crossfireDir, 'DataBase');
  const files = (await readdir(dbDir)).filter((f) => f.endsWith('.tcl')).sort();

  const cards: Card[] = [];
  const skipped: ConvertCardsResult['skipped'] = [];
  const anomalies: string[] = [];

  for (const file of files) {
    const text = await readFile(join(dbDir, file), 'utf8');
    const block = extractBracedSet(text, 'CrossFire::cardDataBase');
    if (block === null) {
      anomalies.push(`${file}: no CrossFire::cardDataBase found`);
      continue;
    }
    for (const row of splitList(block)) {
      const fields = splitList(row);
      if (fields.length < CARD_FIELD_COUNT) {
        skipped.push({ file, fieldCount: fields.length, raw: row.trim() });
        continue;
      }
      if (fields.length > CARD_FIELD_COUNT) {
        anomalies.push(
          `${file}: row has ${fields.length} fields (>${CARD_FIELD_COUNT}): ${row.trim().slice(0, 60)}`,
        );
      }
      cards.push(
        parseCardRow(fields, { file, crossfireDir, typeName, worldName, decodeUses, anomalies }),
      );
    }
  }

  return { cards, skipped, anomalies };
}

/** Convenience: parse reference tables straight from CommonV.tcl text. */
export function loadReferenceTables(commonV: string): { cardTypes: CardType[]; worlds: World[] } {
  return { cardTypes: parseCardTypes(commonV), worlds: parseWorlds(commonV) };
}
