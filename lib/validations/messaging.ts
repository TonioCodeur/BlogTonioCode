import { z } from "zod";

/**
 * Max length for a single message body (plain text, MVP).
 */
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * Page size for loading older messages in a conversation thread.
 */
export const MESSAGES_PAGE_SIZE = 30;

/**
 * Page size for inbox (conversation list) pagination.
 */
export const CONVERSATIONS_PAGE_SIZE = 20;

export const getOrCreateConversationSchema = z.object({
  recipientUserId: z.string().min(1),
});

export const getMessagesSchema = z.object({
  conversationId: z.string().min(1),
  // Opaque cursor: the createdAt ISO string of the oldest message already loaded.
  // When set, return messages older than this timestamp.
  cursor: z.string().datetime().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z
    .string()
    .min(1)
    .max(MESSAGE_MAX_LENGTH)
    .refine((v) => v.trim().length > 0, {
      message: "messages.errors.empty",
    }),
});

export const getConversationSchema = z.object({
  conversationId: z.string().min(1),
});

export const markConversationReadSchema = z.object({
  conversationId: z.string().min(1),
});

export const deleteMyMessageSchema = z.object({
  messageId: z.string().min(1),
});

export const searchUsersForMessagingSchema = z.object({
  query: z.string().max(200),
});

export const adminDeleteMessageSchema = z.object({
  messageId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export const listConversationsSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
});

export const adminListConversationsSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetOrCreateConversationInput = z.infer<typeof getOrCreateConversationSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
