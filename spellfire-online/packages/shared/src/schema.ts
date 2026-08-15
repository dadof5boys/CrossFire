import { z } from 'zod';

/**
 * Canonical data model for Spellfire Online.
 *
 * These Zod schemas are the single source of truth: the data pipeline validates
 * every converted record against them, and the inferred TypeScript types
 * (exported below) are intended to be shared by the future client and server.
 */

/** A card set / edition (e.g. "1st Edition", "Forgotten Realms"). */
export const CardSetSchema = z.object({
  /** Short set code used as the first segment of a card id, e.g. "1st", "FR". */
  id: z.string().min(1),
  /** Display name, e.g. "1st Edition". */
  name: z.string().min(1),
  /** Grouping class from the legacy data: ed, bost, stik, intl, all. */
  class: z.string().min(1),
  /** Print-run number limits (legacy `numLimits`). */
  numLimits: z.array(z.number().int()),
  /** Number of chase cards. */
  chaseQty: z.number().int().nonnegative(),
  /** Original Tcl data file name, kept for provenance. */
  tclFile: z.string(),
  /** SpellfireDB 2.x identifier (may be "na"). */
  sfdbId: z.string(),
});
export type CardSet = z.infer<typeof CardSetSchema>;

/** A card type (e.g. Realm, Wizard, Magical Item). */
export const CardTypeSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  /** Whether this type is a "champion" (Hero, Wizard, Monster, ...). */
  isChampion: z.boolean(),
  /** Legacy "usable" flag: 0 = not usable by others, 1 = usable, 2 = def/off. */
  usable: z.number().int(),
});
export type CardType = z.infer<typeof CardTypeSchema>;

/** A world / campaign setting (e.g. Forgotten Realms, Ravenloft). */
export const WorldSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  shortName: z.string(),
  /** base | fan */
  class: z.string().min(1),
});
export type World = z.infer<typeof WorldSchema>;

/** A single Spellfire card. */
export const CardSchema = z.object({
  /** Stable id: `${setId}/${number}`, e.g. "1st/1". */
  id: z.string().min(1),
  setId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string(),
  /** Rules / power text. */
  text: z.string(),
  typeId: z.number().int(),
  /** Resolved type name via the card-type table. */
  type: z.string(),
  worldId: z.number().int(),
  /** Resolved world name via the world table. */
  world: z.string(),
  isAvatar: z.boolean(),
  /** Numeric level bonus; null when empty or non-numeric (see {@link bonusRaw}). */
  bonus: z.number().int().nullable(),
  /**
   * Raw bonus token as authored. Usually numeric, but some cards use variable
   * bonuses like "?" or "+?"; empty string means no bonus.
   */
  bonusRaw: z.string(),
  /** Rarity / frequency code (M, UC, R, C, ...). */
  rarity: z.string(),
  /** The italic "blue line" subtype text (e.g. "Coast."). */
  blueLine: z.string(),
  /** Raw attribute codes (legacy `attrList`, index 10) — preserved verbatim. */
  attrCodes: z.array(z.string()),
  /** Raw "uses" codes (legacy `usesList`, index 11), e.g. "d19", "o19". */
  usesCodes: z.array(z.string()),
  /** Human-readable decode of {@link usesCodes} where resolvable. */
  uses: z.array(z.string()),
  /** Legacy print weight. */
  weight: z.number().int(),
  /** Repo-relative image path if an image exists, else null. */
  image: z.string().nullable(),
});
export type Card = z.infer<typeof CardSchema>;

/** Reference to a card by set + number (as used in decks/combos). */
export const CardRefSchema = z.object({
  setId: z.string().min(1),
  number: z.number().int().positive(),
});
export type CardRef = z.infer<typeof CardRefSchema>;

/** A saved deck (converted from a `.cfd` file). */
export const DeckSchema = z.object({
  title: z.string(),
  deckSize: z.number().int().nullable(),
  author: z.string(),
  authorEmail: z.string(),
  notes: z.string(),
  displayMode: z.string(),
  cards: z.array(CardRefSchema),
  altCards: z.array(CardRefSchema),
  /** Source file name, for provenance. */
  source: z.string(),
});
export type Deck = z.infer<typeof DeckSchema>;

/** A saved combo (converted from a `.cfc` file). */
export const ComboSchema = z.object({
  title: z.string(),
  author: z.string(),
  authorEmail: z.string(),
  text: z.string(),
  cards: z.array(CardRefSchema),
  source: z.string(),
});
export type Combo = z.infer<typeof ComboSchema>;

/** Top-level combined dataset written to `data/cards.json`. */
export const CardDatabaseSchema = z.object({
  /** ISO timestamp of generation. */
  generatedAt: z.string(),
  counts: z.object({
    cards: z.number().int(),
    sets: z.number().int(),
    cardTypes: z.number().int(),
    worlds: z.number().int(),
    images: z.number().int(),
  }),
  sets: z.array(CardSetSchema),
  cardTypes: z.array(CardTypeSchema),
  worlds: z.array(WorldSchema),
  cards: z.array(CardSchema),
});
export type CardDatabase = z.infer<typeof CardDatabaseSchema>;
