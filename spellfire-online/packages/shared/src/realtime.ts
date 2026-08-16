import { z } from 'zod';

/**
 * Realtime chat + table-lobby contracts (Socket.IO events).
 * Payloads are Zod-validated on the server; the web client uses the inferred types.
 */

export const DEFAULT_CHAT_CHANNEL = 'Main';
export const MAX_CHAT_TEXT = 500;
export const MAX_CHANNEL_NAME = 32;

export const ChannelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHANNEL_NAME)
  .regex(/^[A-Za-z][A-Za-z0-9 _-]*$/, 'Channel names must start with a letter');

export const OccupantSchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
});
export type Occupant = z.infer<typeof OccupantSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  channel: z.string(),
  from: OccupantSchema,
  text: z.string(),
  ts: z.string(),
  kind: z.enum(['say', 'system']),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const WhisperSchema = z.object({
  id: z.string(),
  from: OccupantSchema,
  to: OccupantSchema,
  text: z.string(),
  ts: z.string(),
});
export type Whisper = z.infer<typeof WhisperSchema>;

export const TableSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  occupants: z.array(OccupantSchema),
  status: z.enum(['lobby', 'playing']).default('lobby'),
  playerCount: z.number().int().nonnegative().default(0),
});
export type TableSummary = z.infer<typeof TableSummarySchema>;

/** Client → server */
export const ChatJoinPayloadSchema = z.object({ channel: ChannelNameSchema });
export const ChatLeavePayloadSchema = z.object({ channel: ChannelNameSchema });
export const ChatSayPayloadSchema = z.object({
  channel: ChannelNameSchema,
  text: z.string().trim().min(1).max(MAX_CHAT_TEXT),
});
export const ChatTellPayloadSchema = z.object({
  toUserId: z.string().min(1),
  text: z.string().trim().min(1).max(MAX_CHAT_TEXT),
});
export const TableCreatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(40),
});
export const TableJoinPayloadSchema = z.object({ tableId: z.string().min(1) });
export const TableLeavePayloadSchema = z.object({ tableId: z.string().min(1) });
