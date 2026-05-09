/**
 * Bot dispatch helpers.
 *
 * These are NOT server actions — they're plain server-side functions called
 * from Better Auth hooks and from existing server actions (e.g.
 * `admin.changeUserRole`, `admin.createSanction`). They MUST be fire-and-forget
 * and never throw: a bot failure must not abort a real user-facing action.
 */

import { prisma } from "@/lib/prisma";

type BotTriggerValue = "USER_SIGNUP" | "ROLE_CHANGED" | "SANCTION_APPLIED";

type InterpolationVars = {
  name?: string | null;
  role?: string | null;
  sanctionType?: string | null;
};

/** Replaces `{{varName}}` tokens; unknown keys are left untouched. */
function interpolate(template: string, vars: InterpolationVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (vars as Record<string, string | null | undefined>)[key];
    return value == null ? match : String(value);
  });
}

/**
 * Resolves (or creates) the 1-to-1 conversation between a bot and a real user.
 * Uses direct DB access so it can bypass the standard auth flow.
 */
async function getOrCreateConversationDirect(
  botUserId: string,
  realUserId: string,
): Promise<string> {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: botUserId } } },
        { participants: { some: { userId: realUserId } } },
      ],
    },
    select: {
      id: true,
      _count: { select: { participants: true } },
    },
  });

  if (existing && existing._count.participants === 2) {
    return existing.id;
  }

  const created = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: botUserId }, { userId: realUserId }],
      },
    },
    select: { id: true },
  });
  return created.id;
}

type BotRule = {
  botId: string;
  autoMessageId: string;
  content: string;
};

/**
 * Finds all active bots with an active auto-message for a given trigger.
 * Returns a flat list of (bot, auto-message) pairs to dispatch.
 */
async function findActiveRules(trigger: BotTriggerValue): Promise<BotRule[]> {
  const bots = await prisma.user.findMany({
    where: {
      isBot: true,
      isBotActive: true,
      botAutoMessages: {
        some: { trigger, isActive: true },
      },
    },
    select: {
      id: true,
      botAutoMessages: {
        where: { trigger, isActive: true },
        select: { id: true, content: true },
      },
    },
  });

  const rules: BotRule[] = [];
  for (const bot of bots) {
    for (const msg of bot.botAutoMessages) {
      rules.push({ botId: bot.id, autoMessageId: msg.id, content: msg.content });
    }
  }
  return rules;
}

/**
 * Core dispatch: send the given template content from each matching bot to
 * `targetUserId`. Wraps the whole thing in a try/catch so a crash inside any
 * bot's delivery never bubbles to the caller.
 */
async function dispatch(
  trigger: BotTriggerValue,
  targetUserId: string,
  extraVars: { role?: string | null; sanctionType?: string | null } = {},
): Promise<void> {
  try {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, isBot: true },
    });
    // Skip if target is missing or is itself a bot (no bot-to-bot messaging).
    if (!target || target.isBot) return;

    const rules = await findActiveRules(trigger);
    if (rules.length === 0) return;

    const vars: InterpolationVars = {
      name: target.name,
      role: extraVars.role ?? null,
      sanctionType: extraVars.sanctionType ?? null,
    };

    // Serial to keep the dispatch simple & deterministic; with N bots small in
    // the MVP, parallelism would add little. Each bot's failure is isolated.
    for (const rule of rules) {
      try {
        const conversationId = await getOrCreateConversationDirect(
          rule.botId,
          target.id,
        );
        const content = interpolate(rule.content, vars);
        const msg = await prisma.message.create({
          data: { conversationId, authorId: rule.botId, content },
          select: { createdAt: true },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: msg.createdAt },
        });
      } catch (err) {
        // Per-rule failure: log, move on. Never re-throw.
        console.error("[bots] dispatch rule failed", {
          trigger,
          botId: rule.botId,
          targetUserId,
        }, err);
      }
    }
  } catch (err) {
    console.error("[bots] dispatch failed", { trigger, targetUserId }, err);
  }
}

/** Fire-and-forget: called from the Better Auth user-create hook. */
export function dispatchBotsOnSignup(userId: string): Promise<void> {
  return dispatch("USER_SIGNUP", userId);
}

/** Fire-and-forget: called from `changeUserRole`. */
export function dispatchBotsOnRoleChanged(
  userId: string,
  newRole: string,
): Promise<void> {
  return dispatch("ROLE_CHANGED", userId, { role: newRole });
}

/** Fire-and-forget: called from `createSanction`. */
export function dispatchBotsOnSanction(
  userId: string,
  sanction: { type: string },
): Promise<void> {
  return dispatch("SANCTION_APPLIED", userId, { sanctionType: sanction.type });
}

// Exposed for unit tests — not part of the public API.
export const __internal = { interpolate };
