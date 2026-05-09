/**
 * Shared client-side types for the Bots admin feature.
 *
 * Lives outside `lib/actions/bots.ts` because a `"use server"` module can only
 * export async functions. The front-end imports these to stay decoupled from
 * the Prisma types.
 */

import type { ActionResult as MessagingActionResult } from "@/lib/messaging-types";

/** Discriminated union for server-action return values. Re-exported from messaging. */
export type ActionResult<T> = MessagingActionResult<T>;

/**
 * The 3 event triggers supported in the MVP. Must stay in sync with the
 * Prisma enum `BotTrigger`.
 */
export type BotTriggerValue = "USER_SIGNUP" | "ROLE_CHANGED" | "SANCTION_APPLIED";

/**
 * The 5 app roles. Must stay in sync with the Prisma `Role` enum. Duplicated
 * here (rather than imported from Prisma) so the front-end never pulls Prisma
 * types into its bundle.
 */
export type BotRoleValue = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export type BotAutoMessageData = {
  id: string;
  trigger: BotTriggerValue;
  content: string;
  isActive: boolean;
  createdAt: string | Date;
};

export type BotSummary = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: BotRoleValue;
  isBotActive: boolean;
  botDescription: string | null;
  autoMessagesCount: number;
  createdAt: string | Date;
};

export type BotDetail = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: BotRoleValue;
  isBotActive: boolean;
  botDescription: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  autoMessages: BotAutoMessageData[];
};

/** Lightweight user shape returned by the admin user-picker for bot messaging. */
export type BotMessagingUserSummary = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * i18n error keys returned by the bots server actions.
 * Each value maps to a key in locales/*.ts under `admin.bots.errors.*`.
 */
export const BotError = {
  Unauthorized: "admin.bots.errors.unauthorized",
  Forbidden: "admin.bots.errors.forbidden",
  NotFound: "admin.bots.errors.notFound",
  EmailTaken: "admin.bots.errors.emailTaken",
  InvalidInput: "admin.bots.errors.invalidInput",
  // Manual bot messaging
  BotInactive: "admin.bots.errors.botInactive",
  RecipientNotFound: "admin.bots.errors.recipientNotFound",
  RecipientIsBot: "admin.bots.errors.recipientIsBot",
  MessageEmpty: "admin.bots.errors.messageEmpty",
  MessageTooLong: "admin.bots.errors.messageTooLong",
  Unknown: "admin.bots.errors.unknown",
} as const;

export type BotErrorKey = (typeof BotError)[keyof typeof BotError];
