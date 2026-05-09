import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    botAutoMessage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

// Import AFTER mocks.
import {
  createBot,
  createBotAutoMessage,
  deleteBot,
  listBots,
  updateBot,
} from "@/lib/actions/bots";
import { dispatchBotsOnSignup } from "@/lib/bots/dispatch";
import { BotError } from "@/lib/bots-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CallerRole = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

function mockCaller(role: CallerRole | null) {
  if (role === null) {
    mocks.getSession.mockResolvedValueOnce(null);
    return;
  }
  mocks.getSession.mockResolvedValueOnce({ user: { id: "caller-id" } });
  mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: "caller-id", role });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Valid cuid-looking ids for Zod parsing.
const BOT_ID = "ckbot000000000000000000001";
const OTHER_ID = "ckbot000000000000000000002";
const AUTO_ID = "ckauto00000000000000000001";

// ─── listBots ─────────────────────────────────────────────────────────────────

describe("listBots", () => {
  it("rejects non-admin callers", async () => {
    mockCaller("USER");
    const result = await listBots();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.Forbidden);
  });

  it("returns only users with isBot=true", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findMany.mockResolvedValueOnce([
      {
        id: BOT_ID,
        name: "Botty",
        email: "bot@x.io",
        image: null,
        role: "USER",
        isBotActive: true,
        botDescription: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { botAutoMessages: 2 },
      },
    ]);

    const result = await listBots();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bots).toHaveLength(1);
      expect(result.bots[0].autoMessagesCount).toBe(2);
    }
    // Confirm the filter clause was forwarded to Prisma.
    const [args] = mocks.prisma.user.findMany.mock.calls[0];
    expect(args.where).toEqual({ isBot: true });
  });
});

// ─── createBot ────────────────────────────────────────────────────────────────

describe("createBot", () => {
  it("rejects non-admin callers", async () => {
    mockCaller("USER");
    const result = await createBot({
      email: "new@bot.io",
      name: "New",
      role: "USER",
      isBotActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.Forbidden);
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mockCaller(null);
    const result = await createBot({
      email: "new@bot.io",
      name: "New",
      role: "USER",
      isBotActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.Unauthorized);
  });

  it("creates a bot user on happy path", async () => {
    mockCaller("ADMIN");
    const now = new Date();
    mocks.prisma.user.create.mockResolvedValueOnce({
      id: BOT_ID,
      name: "New",
      email: "new@bot.io",
      image: null,
      role: "USER",
      isBotActive: true,
      botDescription: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await createBot({
      email: "new@bot.io",
      name: "New",
      role: "USER",
      isBotActive: true,
    });
    expect(result.ok).toBe(true);
    const [callArg] = mocks.prisma.user.create.mock.calls[0];
    expect(callArg.data.isBot).toBe(true);
    expect(callArg.data.emailVerified).toBe(true);
    expect(callArg.data.email).toBe("new@bot.io");
  });

  it("returns emailTaken when Prisma P2002 fires", async () => {
    mockCaller("ADMIN");
    const uniqueErr = Object.assign(new Error("Unique violation"), { code: "P2002" });
    mocks.prisma.user.create.mockRejectedValueOnce(uniqueErr);

    const result = await createBot({
      email: "dup@bot.io",
      name: "Dup",
      role: "USER",
      isBotActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.EmailTaken);
  });
});

// ─── updateBot ────────────────────────────────────────────────────────────────

describe("updateBot", () => {
  it("happy path: applies the patch", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: BOT_ID, isBot: true });
    const now = new Date();
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: BOT_ID,
      name: "Renamed",
      email: "r@bot.io",
      image: null,
      role: "USER",
      isBotActive: false,
      botDescription: "bio",
      createdAt: now,
      updatedAt: now,
      _count: { botAutoMessages: 0 },
    });

    const result = await updateBot({
      id: BOT_ID,
      name: "Renamed",
      isBotActive: false,
      botDescription: "bio",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bot.name).toBe("Renamed");
      expect(result.bot.isBotActive).toBe(false);
    }
    const [args] = mocks.prisma.user.update.mock.calls[0];
    expect(args.data).toMatchObject({
      name: "Renamed",
      isBotActive: false,
      botDescription: "bio",
    });
  });

  it("returns notFound when the target is missing or not a bot", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await updateBot({ id: BOT_ID, name: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.NotFound);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});

// ─── deleteBot ────────────────────────────────────────────────────────────────

describe("deleteBot", () => {
  it("hard-deletes on happy path", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: BOT_ID, isBot: true });
    mocks.prisma.user.delete.mockResolvedValueOnce({ id: BOT_ID });

    const result = await deleteBot({ id: BOT_ID });
    expect(result.ok).toBe(true);
    expect(mocks.prisma.user.delete).toHaveBeenCalledWith({ where: { id: BOT_ID } });
  });
});

// ─── createBotAutoMessage ─────────────────────────────────────────────────────

describe("createBotAutoMessage", () => {
  it("rejects non-admin callers", async () => {
    mockCaller("USER");
    const result = await createBotAutoMessage({
      botUserId: BOT_ID,
      trigger: "USER_SIGNUP",
      content: "hello",
      isActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.Forbidden);
  });

  it("creates an auto-message for a bot on happy path", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: BOT_ID, isBot: true });
    mocks.prisma.botAutoMessage.create.mockResolvedValueOnce({
      id: AUTO_ID,
      trigger: "USER_SIGNUP",
      content: "Welcome {{name}}",
      isActive: true,
      createdAt: new Date(),
    });

    const result = await createBotAutoMessage({
      botUserId: BOT_ID,
      trigger: "USER_SIGNUP",
      content: "Welcome {{name}}",
      isActive: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.autoMessage.trigger).toBe("USER_SIGNUP");
      expect(result.autoMessage.content).toBe("Welcome {{name}}");
    }
  });

  it("returns notFound when the bot does not exist", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await createBotAutoMessage({
      botUserId: BOT_ID,
      trigger: "USER_SIGNUP",
      content: "hi",
      isActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(BotError.NotFound);
  });
});

// ─── dispatchBotsOnSignup ─────────────────────────────────────────────────────

describe("dispatchBotsOnSignup", () => {
  it("creates conversations + interpolated messages for each active bot rule", async () => {
    // 1) target lookup
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: OTHER_ID,
      name: "Alice",
      isBot: false,
    });
    // 2) active rules lookup returns one bot with one active rule
    mocks.prisma.user.findMany.mockResolvedValueOnce([
      {
        id: BOT_ID,
        botAutoMessages: [
          { id: AUTO_ID, content: "Hi {{name}}, welcome!" },
        ],
      },
    ]);
    // 3) no existing conversation
    mocks.prisma.conversation.findFirst.mockResolvedValueOnce(null);
    // 4) create new conversation
    mocks.prisma.conversation.create.mockResolvedValueOnce({ id: "conv-1" });
    // 5) create message
    const createdAt = new Date("2026-04-18T12:00:00Z");
    mocks.prisma.message.create.mockResolvedValueOnce({ createdAt });
    // 6) update conversation.lastMessageAt
    mocks.prisma.conversation.update.mockResolvedValueOnce({ id: "conv-1" });

    await dispatchBotsOnSignup(OTHER_ID);

    // The message content must be the INTERPOLATED template.
    const [msgArgs] = mocks.prisma.message.create.mock.calls[0];
    expect(msgArgs.data.content).toBe("Hi Alice, welcome!");
    expect(msgArgs.data.authorId).toBe(BOT_ID);
    expect(msgArgs.data.conversationId).toBe("conv-1");

    // lastMessageAt must be updated to match the created message.
    expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { lastMessageAt: createdAt },
    });
  });

  it("skips when the target is missing", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null);

    await dispatchBotsOnSignup(OTHER_ID);

    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.message.create).not.toHaveBeenCalled();
  });

  it("skips when the target is itself a bot", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: OTHER_ID,
      name: "BotFriend",
      isBot: true,
    });

    await dispatchBotsOnSignup(OTHER_ID);

    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("skips gracefully when no active bots match", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: OTHER_ID,
      name: "Alice",
      isBot: false,
    });
    mocks.prisma.user.findMany.mockResolvedValueOnce([]);

    await dispatchBotsOnSignup(OTHER_ID);

    expect(mocks.prisma.message.create).not.toHaveBeenCalled();
  });

  it("never throws even when an insertion crashes — one rule's failure does not abort the rest", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: OTHER_ID,
      name: "Alice",
      isBot: false,
    });
    mocks.prisma.user.findMany.mockResolvedValueOnce([
      {
        id: BOT_ID,
        botAutoMessages: [
          { id: AUTO_ID, content: "first" },
          { id: "ckauto00000000000000000002", content: "second" },
        ],
      },
    ]);
    // First rule crashes at conversation lookup.
    mocks.prisma.conversation.findFirst.mockRejectedValueOnce(new Error("boom"));
    // Second rule succeeds.
    mocks.prisma.conversation.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.conversation.create.mockResolvedValueOnce({ id: "conv-2" });
    mocks.prisma.message.create.mockResolvedValueOnce({ createdAt: new Date() });
    mocks.prisma.conversation.update.mockResolvedValueOnce({ id: "conv-2" });

    // Must NOT throw.
    await expect(dispatchBotsOnSignup(OTHER_ID)).resolves.toBeUndefined();

    // The second rule still dispatched successfully.
    expect(mocks.prisma.message.create).toHaveBeenCalledTimes(1);
    // A log was emitted for the failing rule.
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
