"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BotError } from "@/lib/bots-types";
import type {
  ActionResult,
  BotDetail,
  BotMessagingUserSummary,
  BotSummary,
  BotAutoMessageData,
  BotTriggerValue,
  BotRoleValue,
} from "@/lib/bots-types";
import {
  botIdSchema,
  createBotAutoMessageSchema,
  createBotSchema,
  deleteBotAutoMessageSchema,
  searchUsersForBotMessagingSchema,
  sendBotMessageSchema,
  updateBotAutoMessageSchema,
  updateBotSchema,
} from "@/lib/validations/bots";

// ─── Internal control-flow error ──────────────────────────────────────────────

class BotFailure extends Error {
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
 * Narrow type-guard for Prisma's `PrismaClientKnownRequestError`. We check
 * shape rather than importing the class because the Prisma runtime import
 * path has changed between 6.x and 7.x.
 */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

async function run<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BotFailure) return fail(err.errorKey);
    if (err instanceof z.ZodError) return fail(BotError.InvalidInput);
    if (isUniqueConstraintError(err)) return fail(BotError.EmailTaken);
    console.error("[bots] unexpected error:", err);
    return fail(BotError.Unknown);
  }
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

async function requireAdmin(): Promise<{ id: string; role: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new BotFailure(BotError.Unauthorized);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser) throw new BotFailure(BotError.Unauthorized);

  if (!ADMIN_ROLES.includes(dbUser.role as (typeof ADMIN_ROLES)[number])) {
    throw new BotFailure(BotError.Forbidden);
  }
  return dbUser;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type BotUserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  isBotActive: boolean;
  botDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(
  u: BotUserRow,
  autoMessagesCount: number,
): BotSummary {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role as BotRoleValue,
    isBotActive: u.isBotActive,
    botDescription: u.botDescription,
    autoMessagesCount,
    createdAt: u.createdAt,
  };
}

function toAutoMessage(m: {
  id: string;
  trigger: string;
  content: string;
  isActive: boolean;
  createdAt: Date;
}): BotAutoMessageData {
  return {
    id: m.id,
    trigger: m.trigger as BotTriggerValue,
    content: m.content,
    isActive: m.isActive,
    createdAt: m.createdAt,
  };
}

function toDetail(
  u: BotUserRow,
  autoMessages: BotAutoMessageData[],
): BotDetail {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role as BotRoleValue,
    isBotActive: u.isBotActive,
    botDescription: u.botDescription,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    autoMessages,
  };
}

// ─── Cache busting ────────────────────────────────────────────────────────────

function invalidateBotsPaths(botId?: string): void {
  revalidatePath("/admin/bots");
  if (botId) revalidatePath(`/admin/bots/${botId}`);
}

// ─── listBots ─────────────────────────────────────────────────────────────────

export async function listBots(): Promise<ActionResult<{ bots: BotSummary[] }>> {
  return run(async () => {
    await requireAdmin();

    const rows = await prisma.user.findMany({
      where: { isBot: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isBotActive: true,
        botDescription: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { botAutoMessages: true } },
      },
    });

    const bots: BotSummary[] = rows.map((r) => toSummary(r, r._count.botAutoMessages));
    return { ok: true as const, bots };
  });
}

// ─── getBot ───────────────────────────────────────────────────────────────────

export async function getBot(
  input: z.infer<typeof botIdSchema>,
): Promise<ActionResult<{ bot: BotDetail }>> {
  return run(async () => {
    await requireAdmin();
    const { id } = botIdSchema.parse(input);

    const row = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isBot: true,
        isBotActive: true,
        botDescription: true,
        createdAt: true,
        updatedAt: true,
        botAutoMessages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            trigger: true,
            content: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!row || !row.isBot) throw new BotFailure(BotError.NotFound);

    const autoMessages = row.botAutoMessages.map(toAutoMessage);
    return { ok: true as const, bot: toDetail(row, autoMessages) };
  });
}

// ─── createBot ────────────────────────────────────────────────────────────────

export async function createBot(
  input: z.infer<typeof createBotSchema>,
): Promise<ActionResult<{ bot: BotSummary }>> {
  return run(async () => {
    await requireAdmin();
    const data = createBotSchema.parse(input);

    const now = new Date();
    // Bots are Users with isBot=true, emailVerified=true (messaging gate),
    // and no Account row => login is structurally impossible.
    const created = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: data.name,
        email: data.email,
        emailVerified: true,
        image: data.image ? data.image : null,
        role: data.role,
        isBot: true,
        isBotActive: data.isBotActive,
        botDescription: data.botDescription ?? null,
        createdAt: now,
        updatedAt: now,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isBotActive: true,
        botDescription: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    invalidateBotsPaths(created.id);
    return { ok: true as const, bot: toSummary(created, 0) };
  });
}

// ─── updateBot ────────────────────────────────────────────────────────────────

export async function updateBot(
  input: z.infer<typeof updateBotSchema>,
): Promise<ActionResult<{ bot: BotSummary }>> {
  return run(async () => {
    await requireAdmin();
    const parsed = updateBotSchema.parse(input);
    const { id, ...patch } = parsed;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isBot: true },
    });
    if (!existing || !existing.isBot) throw new BotFailure(BotError.NotFound);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.image !== undefined ? { image: patch.image ? patch.image : null } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.isBotActive !== undefined ? { isBotActive: patch.isBotActive } : {}),
        ...(patch.botDescription !== undefined
          ? { botDescription: patch.botDescription }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isBotActive: true,
        botDescription: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { botAutoMessages: true } },
      },
    });

    invalidateBotsPaths(updated.id);
    return { ok: true as const, bot: toSummary(updated, updated._count.botAutoMessages) };
  });
}

// ─── deleteBot ────────────────────────────────────────────────────────────────
//
// Hard delete. Cascading FK constraints on `bot_auto_message` and `session` /
// `account` / `conversation_participant` / `sanction` ensure the row can be
// dropped cleanly. `message.authorId` has ON DELETE SET NULL so the bot's
// past messages remain readable (rendered as "deleted user") — acceptable
// behaviour for the MVP.

export async function deleteBot(
  input: z.infer<typeof botIdSchema>,
): Promise<ActionResult<{ success: true }>> {
  return run(async () => {
    await requireAdmin();
    const { id } = botIdSchema.parse(input);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isBot: true },
    });
    if (!existing || !existing.isBot) throw new BotFailure(BotError.NotFound);

    await prisma.user.delete({ where: { id } });
    invalidateBotsPaths();
    return { ok: true as const, success: true as const };
  });
}

// ─── createBotAutoMessage ─────────────────────────────────────────────────────

export async function createBotAutoMessage(
  input: z.infer<typeof createBotAutoMessageSchema>,
): Promise<ActionResult<{ autoMessage: BotAutoMessageData }>> {
  return run(async () => {
    await requireAdmin();
    const data = createBotAutoMessageSchema.parse(input);

    const bot = await prisma.user.findUnique({
      where: { id: data.botUserId },
      select: { id: true, isBot: true },
    });
    if (!bot || !bot.isBot) throw new BotFailure(BotError.NotFound);

    const created = await prisma.botAutoMessage.create({
      data: {
        botUserId: data.botUserId,
        trigger: data.trigger,
        content: data.content,
        isActive: data.isActive,
      },
      select: {
        id: true,
        trigger: true,
        content: true,
        isActive: true,
        createdAt: true,
      },
    });

    invalidateBotsPaths(data.botUserId);
    return { ok: true as const, autoMessage: toAutoMessage(created) };
  });
}

// ─── updateBotAutoMessage ─────────────────────────────────────────────────────

export async function updateBotAutoMessage(
  input: z.infer<typeof updateBotAutoMessageSchema>,
): Promise<ActionResult<{ autoMessage: BotAutoMessageData }>> {
  return run(async () => {
    await requireAdmin();
    const { id, content, isActive } = updateBotAutoMessageSchema.parse(input);

    const existing = await prisma.botAutoMessage.findUnique({
      where: { id },
      select: { id: true, botUserId: true },
    });
    if (!existing) throw new BotFailure(BotError.NotFound);

    const updated = await prisma.botAutoMessage.update({
      where: { id },
      data: {
        ...(content !== undefined ? { content } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        trigger: true,
        content: true,
        isActive: true,
        createdAt: true,
      },
    });

    invalidateBotsPaths(existing.botUserId);
    return { ok: true as const, autoMessage: toAutoMessage(updated) };
  });
}

// ─── deleteBotAutoMessage ─────────────────────────────────────────────────────

export async function deleteBotAutoMessage(
  input: z.infer<typeof deleteBotAutoMessageSchema>,
): Promise<ActionResult<{ success: true }>> {
  return run(async () => {
    await requireAdmin();
    const { id } = deleteBotAutoMessageSchema.parse(input);

    const existing = await prisma.botAutoMessage.findUnique({
      where: { id },
      select: { id: true, botUserId: true },
    });
    if (!existing) throw new BotFailure(BotError.NotFound);

    await prisma.botAutoMessage.delete({ where: { id } });
    invalidateBotsPaths(existing.botUserId);
    return { ok: true as const, success: true as const };
  });
}

// ─── searchUsersForBotMessaging ───────────────────────────────────────────────
//
// Admin-only. Returns up to 20 real users (not bots, not the target bot)
// matching `query` against name or email. Used by the manual "send as bot" UI.

export async function searchUsersForBotMessaging(
  input: z.infer<typeof searchUsersForBotMessagingSchema>,
): Promise<ActionResult<{ users: BotMessagingUserSummary[] }>> {
  return run(async () => {
    await requireAdmin();
    const { query } = searchUsersForBotMessagingSchema.parse(input);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { ok: true as const, users: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { isBot: false },
          {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
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

// ─── sendBotMessage ───────────────────────────────────────────────────────────
//
// Admin-initiated: send a message TO a real user FROM a bot. Reuses the same
// Conversation / Message tables as user DMs so the recipient sees it inline
// in their inbox. The conversation is created on first contact, then reused.

export async function sendBotMessage(
  input: z.infer<typeof sendBotMessageSchema>,
): Promise<ActionResult<{ conversationId: string; messageId: string }>> {
  return run(async () => {
    await requireAdmin();
    const { botUserId, recipientUserId, content: rawContent } =
      sendBotMessageSchema.parse(input);

    if (botUserId === recipientUserId) {
      throw new BotFailure(BotError.RecipientIsBot);
    }

    const bot = await prisma.user.findUnique({
      where: { id: botUserId },
      select: { id: true, isBot: true, isBotActive: true },
    });
    if (!bot || !bot.isBot) throw new BotFailure(BotError.NotFound);
    if (!bot.isBotActive) throw new BotFailure(BotError.BotInactive);

    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, isBot: true },
    });
    if (!recipient) throw new BotFailure(BotError.RecipientNotFound);
    if (recipient.isBot) throw new BotFailure(BotError.RecipientIsBot);

    const content = rawContent.trim();

    // Locate an existing 1-to-1 conversation between the bot and the recipient,
    // or create one. Mirrors `getOrCreateConversation` from messaging.ts.
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: botUserId } } },
          { participants: { some: { userId: recipientUserId } } },
        ],
      },
      select: {
        id: true,
        _count: { select: { participants: true } },
      },
    });

    const conversationId =
      existing && existing._count.participants === 2
        ? existing.id
        : (
            await prisma.conversation.create({
              data: {
                participants: {
                  create: [
                    // The bot is "already viewed" by itself.
                    { userId: botUserId, firstViewedAt: new Date(), lastReadAt: new Date() },
                    { userId: recipientUserId },
                  ],
                },
              },
              select: { id: true },
            })
          ).id;

    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { conversationId, authorId: botUserId, content },
        select: { id: true, createdAt: true },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt },
      });
      return msg;
    });

    revalidatePath("/messages");
    revalidatePath(`/messages/${conversationId}`);
    revalidatePath("/admin/messages");

    return {
      ok: true as const,
      conversationId,
      messageId: created.id,
    };
  });
}
