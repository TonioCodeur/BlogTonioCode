"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessagingError } from "@/lib/messaging-errors";
import type {
  ActionResult,
  AdminConversationListItem,
  ConversationDetail,
  ConversationListItemData,
  MessageData,
  MessagingUserSummary,
  MuteInfo,
} from "@/lib/messaging-types";
import {
  CONVERSATIONS_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
  adminDeleteMessageSchema,
  adminListConversationsSchema,
  deleteMyMessageSchema,
  getConversationSchema,
  getMessagesSchema,
  getOrCreateConversationSchema,
  listConversationsSchema,
  markConversationReadSchema,
  searchUsersForMessagingSchema,
  sendMessageSchema,
} from "@/lib/validations/messaging";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
const BLOCKING_SANCTION_TYPES = ["MUTE", "TEMPORARY_BAN", "PERMANENT_BAN"] as const;

// ─── Internal control-flow error ──────────────────────────────────────────────
//
// Internal-only: lets nested helpers surface a typed i18n errorKey without
// leaking a stack trace to the client. Caught at the action boundary and
// converted to `{ ok: false, errorKey }`.
class MessagingFailure extends Error {
  readonly errorKey: string;
  constructor(errorKey: string) {
    super(errorKey);
    this.errorKey = errorKey;
  }
}

function fail(errorKey: string): { ok: false; errorKey: string } {
  return { ok: false, errorKey };
}

/**
 * Wraps an action body: any `MessagingFailure` is converted to a typed error
 * result; anything else is logged and surfaced as `unknown`. Never throws.
 */
async function run<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MessagingFailure) return fail(err.errorKey);
    // Zod input errors → invalidInput (never log user content).
    if (err instanceof z.ZodError) return fail(MessagingError.InvalidInput);
    // Unexpected. Log without payload, return generic key.
    console.error("[messaging] unexpected error:", err);
    return fail(MessagingError.Unknown);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthedUser = {
  id: string;
  emailVerified: boolean;
  role: string;
};

async function requireAuthedUser(): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new MessagingFailure(MessagingError.Unauthorized);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, emailVerified: true, role: true },
  });
  if (!dbUser) throw new MessagingFailure(MessagingError.Unauthorized);

  return dbUser;
}

async function requireAdminUser(): Promise<AuthedUser> {
  const user = await requireAuthedUser();
  if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new MessagingFailure(MessagingError.Forbidden);
  }
  return user;
}

/**
 * Checks the user has no active blocking sanction (MUTE / TEMPORARY_BAN /
 * PERMANENT_BAN). A sanction is "active" when status=ACTIVE AND (no expiry
 * OR expires in the future).
 */
async function assertNotMutedOrBanned(userId: string): Promise<void> {
  const now = new Date();
  const sanction = await prisma.sanction.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      type: { in: [...BLOCKING_SANCTION_TYPES] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { type: true },
  });
  if (!sanction) return;
  if (sanction.type === "MUTE") throw new MessagingFailure(MessagingError.Muted);
  throw new MessagingFailure(MessagingError.Banned);
}

async function requireParticipant(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new MessagingFailure(MessagingError.NotParticipant);
  return participant;
}

// ─── Rate limit (in-memory, per-process) ──────────────────────────────────────
//
// MVP-only. Works for a single-instance deploy. Replace with Redis token-bucket
// for horizontal scaling.

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const sendTimestamps: Map<string, number[]> = new Map();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (sendTimestamps.get(userId) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX) {
    throw new MessagingFailure(MessagingError.RateLimit);
  }
  recent.push(now);
  sendTimestamps.set(userId, recent);
}

// ─── Soft-delete content scrubbing ────────────────────────────────────────────
//
// The network payload must NOT leak the original text for soft-deleted
// messages. The front-end reads deletedAt / deletedByAdminId to render a
// placeholder.
type RawMessage = {
  id: string;
  conversationId?: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByAdminId: string | null;
  author: MessagingUserSummary | null;
};

function scrubMessage(m: RawMessage, conversationId: string): MessageData {
  const isDeleted = m.deletedAt !== null || m.deletedByAdminId !== null;
  return {
    id: m.id,
    conversationId: m.conversationId ?? conversationId,
    authorId: m.authorId,
    content: isDeleted ? "" : m.content,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt,
    deletedByAdminId: m.deletedByAdminId,
    author: m.author,
  };
}

// ─── getOrCreateConversation ─────────────────────────────────────────────────

export async function getOrCreateConversation(
  input: z.infer<typeof getOrCreateConversationSchema>,
): Promise<ActionResult<{ conversationId: string }>> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { recipientUserId } = getOrCreateConversationSchema.parse(input);

    if (recipientUserId === me.id) {
      throw new MessagingFailure(MessagingError.SelfMessaging);
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true },
    });
    if (!recipient) throw new MessagingFailure(MessagingError.RecipientNotFound);

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: me.id } } },
          { participants: { some: { userId: recipientUserId } } },
        ],
      },
      select: {
        id: true,
        _count: { select: { participants: true } },
      },
    });

    if (existing && existing._count.participants === 2) {
      return { ok: true as const, conversationId: existing.id };
    }

    const created = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: me.id }, { userId: recipientUserId }],
        },
      },
      select: { id: true },
    });

    return { ok: true as const, conversationId: created.id };
  });
}

// ─── listConversations ────────────────────────────────────────────────────────
//
// Per the contract (messaging-types.ts), this returns a bare array of
// ConversationListItemData. Not wrapped in ActionResult.

export async function listConversations(
  input?: z.infer<typeof listConversationsSchema>,
): Promise<ConversationListItemData[]> {
  try {
    const me = await requireAuthedUser();
    const { page = 1 } = listConversationsSchema.parse(input ?? {});

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: me.id } } },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * CONVERSATIONS_PAGE_SIZE,
      take: CONVERSATIONS_PAGE_SIZE,
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            authorId: true,
            createdAt: true,
            deletedAt: true,
            deletedByAdminId: true,
          },
        },
      },
    });

    return await Promise.all(
      conversations.map(async (c) => {
        const meParticipant = c.participants.find((p) => p.userId === me.id);
        const otherParticipant = c.participants.find((p) => p.userId !== me.id);
        const other: MessagingUserSummary | null = otherParticipant
          ? {
              id: otherParticipant.user.id,
              name: otherParticipant.user.name,
              email: otherParticipant.user.email,
              image: otherParticipant.user.image,
            }
          : null;
        const lastReadAt = meParticipant?.lastReadAt ?? null;
        const hasViewed = meParticipant?.firstViewedAt != null;

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: c.id,
            authorId: { not: me.id },
            deletedAt: null,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        const rawLast = c.messages[0] ?? null;
        const lastMessage = rawLast
          ? {
              id: rawLast.id,
              content:
                rawLast.deletedAt !== null || rawLast.deletedByAdminId !== null
                  ? ""
                  : rawLast.content,
              createdAt: rawLast.createdAt,
              authorId: rawLast.authorId,
              deletedAt: rawLast.deletedAt,
              deletedByAdminId: rawLast.deletedByAdminId,
            }
          : null;

        return {
          id: c.id,
          otherUser: other,
          lastMessage,
          lastMessageAt: c.lastMessageAt,
          unreadCount,
          hasViewed,
        };
      }),
    );
  } catch (err) {
    console.error("[messaging] listConversations failed:", err);
    return [];
  }
}

// ─── getConversation ──────────────────────────────────────────────────────────
//
// Returns the conversation detail directly (not wrapped) so server components
// can consume it without branching. Throws a typed MessagingFailure on
// permission / not-found so Next.js can render `notFound()` in the page.

export async function getConversation(
  input: z.infer<typeof getConversationSchema>,
): Promise<ConversationDetail> {
  const me = await requireAuthedUser();
  const { conversationId } = getConversationSchema.parse(input);

  await requireParticipant(conversationId, me.id);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });
  if (!conversation) throw new MessagingFailure(MessagingError.NotFound);

  const otherParticipant = conversation.participants.find((p) => p.userId !== me.id);
  const otherUser: MessagingUserSummary | null = otherParticipant
    ? {
        id: otherParticipant.user.id,
        name: otherParticipant.user.name,
        email: otherParticipant.user.email,
        image: otherParticipant.user.image,
      }
    : null;

  const raw = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PAGE_SIZE,
    select: {
      id: true,
      conversationId: true,
      authorId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      deletedByAdminId: true,
      author: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const hasMore = raw.length === MESSAGES_PAGE_SIZE;
  const messages = raw.map((m) => scrubMessage(m, conversationId));

  return {
    id: conversation.id,
    otherUser,
    messages,
    hasMore,
  };
}

// ─── getMessages ──────────────────────────────────────────────────────────────

export async function getMessages(
  input: z.infer<typeof getMessagesSchema>,
): Promise<
  ActionResult<{
    messages: MessageData[];
    hasMore: boolean;
    nextCursor: string | null;
  }>
> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { conversationId, cursor } = getMessagesSchema.parse(input);

    await requireParticipant(conversationId, me.id);

    const raw = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: MESSAGES_PAGE_SIZE,
      select: {
        id: true,
        conversationId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        deletedByAdminId: true,
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    const hasMore = raw.length === MESSAGES_PAGE_SIZE;
    const nextCursor = hasMore ? raw[raw.length - 1].createdAt.toISOString() : null;
    const messages = raw.map((m) => scrubMessage(m, conversationId));

    return { ok: true as const, messages, hasMore, nextCursor };
  });
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

export async function sendMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<{ message: MessageData }>> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { conversationId, content: rawContent } = sendMessageSchema.parse(input);

    if (!me.emailVerified) {
      throw new MessagingFailure(MessagingError.EmailNotVerified);
    }

    await assertNotMutedOrBanned(me.id);
    await requireParticipant(conversationId, me.id);
    checkRateLimit(me.id);

    const content = rawContent.trim();

    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { conversationId, authorId: me.id, content },
        select: {
          id: true,
          conversationId: true,
          authorId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          deletedByAdminId: true,
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      });
      // Fix race condition: use the actual row timestamp so lastMessageAt
      // matches the message it was set for.
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt },
      });
      return msg;
    });

    // Re-validate caches after a successful mutation.
    revalidatePath("/messages");
    revalidatePath(`/messages/${conversationId}`);

    const message = scrubMessage(created, conversationId);
    return { ok: true as const, message };
  });
}

// ─── markConversationRead ─────────────────────────────────────────────────────

export async function markConversationRead(
  input: z.infer<typeof markConversationReadSchema>,
): Promise<ActionResult<{ success: true }>> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { conversationId } = markConversationReadSchema.parse(input);

    const participant = await requireParticipant(conversationId, me.id);

    const now = new Date();
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: me.id } },
      data: {
        lastReadAt: now,
        // Set firstViewedAt only the very first time the user opens the thread.
        ...(participant.firstViewedAt == null ? { firstViewedAt: now } : {}),
      },
    });

    revalidatePath("/messages");
    revalidatePath(`/messages/${conversationId}`);

    return { ok: true as const, success: true as const };
  });
}

// ─── deleteMyMessage ──────────────────────────────────────────────────────────

export async function deleteMyMessage(
  input: z.infer<typeof deleteMyMessageSchema>,
): Promise<ActionResult<{ success: true }>> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { messageId } = deleteMyMessageSchema.parse(input);

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, authorId: true, conversationId: true, deletedAt: true },
    });
    if (!message) throw new MessagingFailure(MessagingError.NotFound);
    if (message.authorId !== me.id) throw new MessagingFailure(MessagingError.Forbidden);

    if (!message.deletedAt) {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });
    }

    revalidatePath("/messages");
    revalidatePath(`/messages/${message.conversationId}`);

    return { ok: true as const, success: true as const };
  });
}

// ─── getMyMuteInfo ────────────────────────────────────────────────────────────
//
// Per the contract, this one returns a plain MuteInfo (not wrapped in
// ActionResult). Defensive: on unexpected failure returns a safe default.

export async function getMyMuteInfo(): Promise<MuteInfo> {
  try {
    const me = await requireAuthedUser();
    const now = new Date();

    const sanction = await prisma.sanction.findFirst({
      where: {
        userId: me.id,
        status: "ACTIVE",
        type: { in: [...BLOCKING_SANCTION_TYPES] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: { type: true, expiresAt: true },
    });

    if (!sanction) {
      return { isMuted: false, isBanned: false, mutedUntil: null };
    }

    const isBanned =
      sanction.type === "TEMPORARY_BAN" || sanction.type === "PERMANENT_BAN";
    const isMuted = sanction.type === "MUTE" || isBanned;

    return {
      isMuted,
      isBanned,
      mutedUntil: sanction.expiresAt ?? null,
    };
  } catch (err) {
    console.error("[messaging] getMyMuteInfo failed:", err);
    return { isMuted: false, isBanned: false, mutedUntil: null };
  }
}

// ─── searchUsersForMessaging ──────────────────────────────────────────────────

export async function searchUsersForMessaging(
  input: z.infer<typeof searchUsersForMessagingSchema>,
): Promise<ActionResult<{ users: MessagingUserSummary[] }>> {
  return run(async () => {
    const me = await requireAuthedUser();
    const { query } = searchUsersForMessagingSchema.parse(input);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { ok: true as const, users: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: me.id } },
          {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
          },
          {
            // Exclude users with an active PERMANENT_BAN.
            sanctions: {
              none: {
                status: "ACTIVE",
                type: "PERMANENT_BAN",
              },
            },
          },
        ],
      },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, email: true, image: true },
    });

    return { ok: true as const, users };
  });
}

// ─── getUnreadCount ───────────────────────────────────────────────────────────

export async function getUnreadCount(): Promise<ActionResult<{ count: number }>> {
  return run(async () => {
    const me = await requireAuthedUser();

    const participants = await prisma.conversationParticipant.findMany({
      where: { userId: me.id },
      select: { conversationId: true, lastReadAt: true },
    });

    if (participants.length === 0) {
      return { ok: true as const, count: 0 };
    }

    // Sum unread counts across all of the user's conversations.
    const counts = await Promise.all(
      participants.map((p) =>
        prisma.message.count({
          where: {
            conversationId: p.conversationId,
            authorId: { not: me.id },
            deletedAt: null,
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        }),
      ),
    );

    const count = counts.reduce((total, n) => total + n, 0);
    return { ok: true as const, count };
  });
}

// ─── adminListConversations ───────────────────────────────────────────────────

export async function adminListConversations(
  input?: z.infer<typeof adminListConversationsSchema>,
): Promise<AdminConversationListItem[]> {
  try {
    await requireAdminUser();
    const { page = 1 } = adminListConversationsSchema.parse(input ?? {});

    const rows = await prisma.conversation.findMany({
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * CONVERSATIONS_PAGE_SIZE,
      take: CONVERSATIONS_PAGE_SIZE,
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            deletedAt: true,
            deletedByAdminId: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });

    const conversations: AdminConversationListItem[] = rows.map((c) => {
      const rawLast = c.messages[0] ?? null;
      const lastMessage = rawLast
        ? {
            id: rawLast.id,
            content:
              rawLast.deletedAt !== null || rawLast.deletedByAdminId !== null
                ? ""
                : rawLast.content,
            createdAt: rawLast.createdAt,
            deletedAt: rawLast.deletedAt,
          }
        : null;

      return {
        id: c.id,
        participants: c.participants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
        })),
        lastMessage,
        lastMessageAt: c.lastMessageAt,
        messageCount: c._count.messages,
      };
    });

    return conversations;
  } catch (err) {
    console.error("[messaging] adminListConversations failed:", err);
    return [];
  }
}

// ─── adminDeleteMessage ───────────────────────────────────────────────────────

export async function adminDeleteMessage(
  input: z.infer<typeof adminDeleteMessageSchema>,
): Promise<
  ActionResult<{
    message: {
      id: string;
      deletedAt: Date | null;
      deletedByAdminId: string | null;
      deletionReason: string | null;
    };
  }>
> {
  return run(async () => {
    const admin = await requireAdminUser();
    const { messageId, reason } = adminDeleteMessageSchema.parse(input);

    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, deletedAt: true },
    });
    if (!existing) throw new MessagingFailure(MessagingError.NotFound);

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: existing.deletedAt ?? new Date(),
        deletedByAdminId: admin.id,
        deletionReason: reason ?? null,
      },
      select: {
        id: true,
        deletedAt: true,
        deletedByAdminId: true,
        deletionReason: true,
      },
    });

    revalidatePath("/admin/messages");
    revalidatePath(`/messages/${existing.conversationId}`);

    return { ok: true as const, message: updated };
  });
}
