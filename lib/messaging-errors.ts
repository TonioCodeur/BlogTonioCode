/**
 * i18n error keys used by the messaging server actions.
 * Each value is a valid key in locales/*.ts (namespace: messages.errors.*),
 * so the client can call `t(result.errorKey)` directly.
 *
 * Lives outside lib/actions/messaging.ts because a "use server" file may
 * only export async functions.
 */
export const MessagingError = {
  Unauthorized: "messages.errors.unauthorized",
  Forbidden: "messages.errors.forbidden",
  EmailNotVerified: "messages.errors.emailNotVerified",
  Muted: "messages.errors.muted",
  Banned: "messages.errors.banned",
  RateLimit: "messages.errors.rateLimited",
  NotParticipant: "messages.errors.notParticipant",
  NotFound: "messages.errors.notFound",
  SelfMessaging: "messages.errors.selfMessaging",
  RecipientNotFound: "messages.errors.recipientNotFound",
  InvalidInput: "messages.errors.invalidInput",
  Empty: "messages.errors.empty",
  TooLong: "messages.errors.tooLong",
  Unknown: "messages.errors.unknown",
} as const;

export type MessagingErrorCode = (typeof MessagingError)[keyof typeof MessagingError];
