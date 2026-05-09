import { z } from "zod";

export const BOT_AUTO_MESSAGE_MAX_LENGTH = 2000;
export const BOT_MANUAL_MESSAGE_MAX_LENGTH = 2000;

const optionalImageUrl = z
  .union([z.literal(""), z.string().url().max(2048)])
  .optional()
  .nullable();

/** Must match the Prisma `Role` enum. */
export const roleSchema = z.enum([
  "USER",
  "CUSTOMER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
]);

/** Must match the Prisma `BotTrigger` enum. */
export const botTriggerSchema = z.enum([
  "USER_SIGNUP",
  "ROLE_CHANGED",
  "SANCTION_APPLIED",
]);

// User IDs in this project are issued by Better Auth (UUID format) and bot
// ids are produced via `randomUUID()` — `.cuid()` would reject them, so we
// validate as a plain non-empty string here. BotAutoMessage row ids are
// CUIDs from Prisma, but we accept the same loose shape for consistency.
export const botIdSchema = z.object({
  id: z.string().min(1),
});

export const createBotSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  image: optionalImageUrl,
  role: roleSchema,
  botDescription: z.string().max(1000).optional().nullable(),
  isBotActive: z.boolean(),
});

/**
 * Update schema: all body fields are optional (partial patch) so a caller
 * can send only the fields it wants to change. The `id` identifies the
 * target bot.
 */
export const updateBotSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().max(255).optional(),
  name: z.string().min(1).max(100).optional(),
  image: optionalImageUrl,
  role: roleSchema.optional(),
  botDescription: z.string().max(1000).optional().nullable(),
  isBotActive: z.boolean().optional(),
});

export const createBotAutoMessageSchema = z.object({
  botUserId: z.string().min(1),
  trigger: botTriggerSchema,
  content: z.string().min(1).max(BOT_AUTO_MESSAGE_MAX_LENGTH),
  isActive: z.boolean(),
});

export const updateBotAutoMessageSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(BOT_AUTO_MESSAGE_MAX_LENGTH).optional(),
  isActive: z.boolean().optional(),
});

export const deleteBotAutoMessageSchema = z.object({
  id: z.string().min(1),
});

/**
 * Admin-initiated manual message: pick a bot, pick a recipient, send content.
 * Note: user IDs are accepted as plain non-empty strings because Better Auth
 * issues UUID-format ids — `.cuid()` would reject them.
 */
export const sendBotMessageSchema = z.object({
  botUserId: z.string().min(1),
  recipientUserId: z.string().min(1),
  content: z
    .string()
    .min(1)
    .max(BOT_MANUAL_MESSAGE_MAX_LENGTH)
    .refine((v) => v.trim().length > 0, {
      message: "admin.bots.errors.messageEmpty",
    }),
});

/**
 * Admin user-picker query (for the manual bot-messaging UI).
 */
export const searchUsersForBotMessagingSchema = z.object({
  query: z.string().max(200),
});

export type CreateBotInput = z.infer<typeof createBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
export type CreateBotAutoMessageInput = z.infer<typeof createBotAutoMessageSchema>;
export type UpdateBotAutoMessageInput = z.infer<typeof updateBotAutoMessageSchema>;
export type SendBotMessageInput = z.infer<typeof sendBotMessageSchema>;
