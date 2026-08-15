import { z } from 'zod';
import { OccupantSchema } from './realtime.js';

export const STARTING_HAND_SIZE = 5;
export const MAX_TABLE_PLAYERS = 2;

export const PlayZoneSchema = z.enum(['hand', 'draw', 'pool', 'realms', 'discard']);
export type PlayZone = z.infer<typeof PlayZoneSchema>;

export const CardInstanceSchema = z.object({
  instanceId: z.string(),
  cardId: z.string(),
});
export type CardInstance = z.infer<typeof CardInstanceSchema>;

export const HiddenPileSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type HiddenPile = z.infer<typeof HiddenPileSchema>;

export const PlayStatusSchema = z.enum(['lobby', 'playing']);
export type PlayStatus = z.infer<typeof PlayStatusSchema>;

export const SeatViewSchema = z.object({
  occupant: OccupantSchema.nullable(),
  deckName: z.string().nullable(),
  hand: z.union([z.array(CardInstanceSchema), HiddenPileSchema]),
  drawCount: z.number().int().nonnegative(),
  pool: z.array(CardInstanceSchema),
  realms: z.array(CardInstanceSchema),
  discard: z.array(CardInstanceSchema),
});
export type SeatView = z.infer<typeof SeatViewSchema>;

export const PlayViewSchema = z.object({
  tableId: z.string(),
  tableName: z.string(),
  status: PlayStatusSchema,
  activeSeat: z.union([z.literal(0), z.literal(1)]),
  turnNumber: z.number().int().positive(),
  youSeat: z.union([z.literal(0), z.literal(1)]).nullable(),
  seats: z.tuple([SeatViewSchema, SeatViewSchema]),
  spectators: z.array(OccupantSchema),
});
export type PlayView = z.infer<typeof PlayViewSchema>;

/** Client → server */
export const PlayTableIdPayloadSchema = z.object({ tableId: z.string().min(1) });
export const PlayLoadDeckPayloadSchema = z.object({
  tableId: z.string().min(1),
  deckId: z.string().min(1),
});
export const PlayMovePayloadSchema = z.object({
  tableId: z.string().min(1),
  instanceId: z.string().min(1),
  toZone: PlayZoneSchema.exclude(['draw']),
});
