/**
 * Shared client-side types for the messaging feature.
 *
 * These types describe the shapes returned by server actions from
 * `lib/actions/messaging.ts` (owned by dev-back). The front-end
 * imports from here to stay independent while the back-end converges.
 */

export type MessagingUserSummary = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type ConversationListItemData = {
  id: string;
  otherUser: MessagingUserSummary | null;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string | Date;
    authorId: string | null;
    deletedAt: string | Date | null;
    deletedByAdminId: string | null;
  } | null;
  lastMessageAt: string | Date | null;
  unreadCount: number;
  // True once the current user has opened this conversation at least once.
  hasViewed: boolean;
};

export type MessageData = {
  id: string;
  conversationId: string;
  authorId: string | null;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt: string | Date | null;
  deletedByAdminId: string | null;
  author: MessagingUserSummary | null;
};

export type ConversationDetail = {
  id: string;
  otherUser: MessagingUserSummary | null;
  messages: MessageData[];
  hasMore: boolean;
};

export type MuteInfo = {
  isMuted: boolean;
  isBanned: boolean;
  mutedUntil: string | Date | null;
};

export type AdminConversationListItem = {
  id: string;
  participants: MessagingUserSummary[];
  lastMessage: {
    id: string;
    content: string;
    createdAt: string | Date;
    deletedAt: string | Date | null;
  } | null;
  lastMessageAt: string | Date | null;
  messageCount: number;
};

/**
 * Server actions return { ok: true, ... } on success, or
 * { ok: false, errorKey: "messages.errors.<key>" } for i18n.
 */
export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; errorKey: string };
