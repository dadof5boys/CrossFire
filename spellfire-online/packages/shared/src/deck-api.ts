import { z } from 'zod';

/**
 * Shared contracts for the deck persistence API. Used by both the Fastify
 * server (request validation + response typing) and the web client.
 */

/** A single card entry within a deck (card id + quantity). */
export const DeckEntrySchema = z.object({
  cardId: z.string().min(1),
  qty: z.number().int().positive(),
});
export type DeckEntry = z.infer<typeof DeckEntrySchema>;

/** Payload for creating or updating a deck. */
export const DeckInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  cards: z.array(DeckEntrySchema),
});
export type DeckInput = z.infer<typeof DeckInputSchema>;

/** A persisted deck as returned by the API. */
export const SavedDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  cards: z.array(DeckEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedDeck = z.infer<typeof SavedDeckSchema>;
