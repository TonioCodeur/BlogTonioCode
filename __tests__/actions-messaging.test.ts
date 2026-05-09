import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted so the module under test sees them) ───────────────────────

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    sanction: { findFirst: vi.fn() },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
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

// Import AFTER mocks are registered.
import {
  adminDeleteMessage,
  adminListConversations,
  deleteMyMessage,
  getConversation,
  getOrCreateConversation,
  getUnreadCount,
  markConversationRead,
  searchUsersForMessaging,
  sendMessage,
} from "@/lib/actions/messaging";
import { MessagingError } from "@/lib/messaging-errors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DbUser = {
  id: string;
  emailVerified: boolean;
  role: "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
};

function mockAuthedUser(user: DbUser | null) {
  if (!user) {
    mocks.getSession.mockResolvedValueOnce(null);
    return;
  }
  mocks.getSession.mockResolvedValueOnce({ user: { id: user.id } });
  mocks.prisma.user.findUnique.mockResolvedValueOnce(user);
}

function mockNoBlockingSanction() {
  mocks.prisma.sanction.findFirst.mockResolvedValueOnce(null);
}

function mockActiveSanction(type: "MUTE" | "TEMPORARY_BAN" | "PERMANENT_BAN") {
  mocks.prisma.sanction.findFirst.mockResolvedValueOnce({ type });
}

function mockIsParticipant(conversationId: string, userId: string) {
  mocks.prisma.conversationParticipant.findUnique.mockResolvedValueOnce({
    id: "p1",
    conversationId,
    userId,
    joinedAt: new Date(),
    lastReadAt: null,
    mutedByUser: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("messaging server actions — auth guard", () => {
  it("returns Unauthorized errorKey when sendMessage has no session", async () => {
    mockAuthedUser(null);

    const result = await sendMessage({ conversationId: "c1", content: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe(MessagingError.Unauthorized);
    }
  });

  it("returns Unauthorized errorKey when getOrCreateConversation has no session", async () => {
    mockAuthedUser(null);

    const result = await getOrCreateConversation({ recipientUserId: "u2" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe(MessagingError.Unauthorized);
    }
  });
});

describe("sendMessage — business rules", () => {
  it("refuses to send if the user's email is not verified", async () => {
    mockAuthedUser({ id: "u1", emailVerified: false, role: "USER" });

    const result = await sendMessage({ conversationId: "c1", content: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.EmailNotVerified);
  });

  it("refuses to send if the user has an active MUTE sanction", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockActiveSanction("MUTE");

    const result = await sendMessage({ conversationId: "c1", content: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.Muted);
  });

  it("refuses to send if the user has an active TEMPORARY_BAN", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockActiveSanction("TEMPORARY_BAN");

    const result = await sendMessage({ conversationId: "c1", content: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.Banned);
  });

  it("refuses to send if the user is not a participant", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockNoBlockingSanction();
    mocks.prisma.conversationParticipant.findUnique.mockResolvedValueOnce(null);

    const result = await sendMessage({ conversationId: "c1", content: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.NotParticipant);
  });

  it("returns invalidInput for an empty / whitespace-only body", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });

    const result = await sendMessage({ conversationId: "c1", content: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.InvalidInput);
  });

  it("creates the message and sets lastMessageAt from the created row on happy path", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockNoBlockingSanction();
    mockIsParticipant("c1", "u1");

    const createdAt = new Date("2026-04-18T12:00:00Z");
    const created = {
      id: "m1",
      conversationId: "c1",
      authorId: "u1",
      content: "hello",
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      deletedByAdminId: null,
      author: { id: "u1", name: "Alice", email: "a@a.io", image: null },
    };

    mocks.prisma.$transaction.mockImplementationOnce(async (cb: (tx: unknown) => unknown) => {
      mocks.prisma.message.create.mockResolvedValueOnce(created);
      mocks.prisma.conversation.update.mockResolvedValueOnce({ id: "c1" });
      return cb(mocks.prisma);
    });

    const result = await sendMessage({ conversationId: "c1", content: "  hello  " });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.id).toBe("m1");
      expect(result.message.content).toBe("hello");
      expect(result.message.conversationId).toBe("c1");
    }
    expect(mocks.prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: "c1", authorId: "u1", content: "hello" },
      select: expect.any(Object),
    });
    // The conversation.update must use the createdAt of the inserted row.
    expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { lastMessageAt: createdAt },
    });
  });

  it("rate-limits after 10 sends in the window", async () => {
    // Fire 11 sends from the same user; the 11th should trip the limiter.
    const createdAt = new Date();
    const baseMessage = {
      id: "m-x",
      conversationId: "c1",
      authorId: "u-rate",
      content: "hi",
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      deletedByAdminId: null,
      author: { id: "u-rate", name: "R", email: "r@r.io", image: null },
    };

    for (let i = 0; i < 10; i++) {
      mockAuthedUser({ id: "u-rate", emailVerified: true, role: "USER" });
      mockNoBlockingSanction();
      mockIsParticipant("c1", "u-rate");
      mocks.prisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => unknown) => {
          mocks.prisma.message.create.mockResolvedValueOnce(baseMessage);
          mocks.prisma.conversation.update.mockResolvedValueOnce({ id: "c1" });
          return cb(mocks.prisma);
        },
      );
      const ok = await sendMessage({ conversationId: "c1", content: "hi" });
      expect(ok.ok).toBe(true);
    }

    mockAuthedUser({ id: "u-rate", emailVerified: true, role: "USER" });
    mockNoBlockingSanction();
    mockIsParticipant("c1", "u-rate");

    const limited = await sendMessage({ conversationId: "c1", content: "hi" });
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.errorKey).toBe(MessagingError.RateLimit);
  });
});

describe("getOrCreateConversation", () => {
  it("refuses self-messaging", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });

    const result = await getOrCreateConversation({ recipientUserId: "u1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.SelfMessaging);
  });

  it("returns the existing 1-to-1 conversation when one already exists", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: "u2" });
    mocks.prisma.conversation.findFirst.mockResolvedValueOnce({
      id: "c-existing",
      _count: { participants: 2 },
    });

    const result = await getOrCreateConversation({ recipientUserId: "u2" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.conversationId).toBe("c-existing");
    expect(mocks.prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("creates a new conversation when none exists", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: "u2" });
    mocks.prisma.conversation.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.conversation.create.mockResolvedValueOnce({ id: "c-new" });

    const result = await getOrCreateConversation({ recipientUserId: "u2" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.conversationId).toBe("c-new");
    expect(mocks.prisma.conversation.create).toHaveBeenCalled();
  });
});

describe("markConversationRead", () => {
  it("updates lastReadAt for the current participant and returns ok", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockIsParticipant("c1", "u1");
    mocks.prisma.conversationParticipant.update.mockResolvedValueOnce({ id: "p1" });

    const result = await markConversationRead({ conversationId: "c1" });
    expect(result.ok).toBe(true);
    expect(mocks.prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: "c1", userId: "u1" } },
      data: { lastReadAt: expect.any(Date) },
    });
  });
});

describe("deleteMyMessage", () => {
  it("refuses to delete a message authored by someone else", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.message.findUnique.mockResolvedValueOnce({
      id: "m1",
      authorId: "u2",
      conversationId: "c1",
      deletedAt: null,
    });

    const result = await deleteMyMessage({ messageId: "m1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.Forbidden);
  });

  it("soft-deletes a message owned by the current user", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.message.findUnique.mockResolvedValueOnce({
      id: "m1",
      authorId: "u1",
      conversationId: "c1",
      deletedAt: null,
    });
    mocks.prisma.message.update.mockResolvedValueOnce({ id: "m1" });

    const result = await deleteMyMessage({ messageId: "m1" });
    expect(result.ok).toBe(true);
    expect(mocks.prisma.message.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("getConversation", () => {
  it("throws with NotParticipant errorKey when caller is not a participant", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.conversationParticipant.findUnique.mockResolvedValueOnce(null);

    await expect(getConversation({ conversationId: "c1" })).rejects.toThrow(
      MessagingError.NotParticipant,
    );
  });

  it("returns conversation detail + scrubs deleted message content", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mockIsParticipant("c1", "u1");

    mocks.prisma.conversation.findUnique.mockResolvedValueOnce({
      id: "c1",
      participants: [
        {
          userId: "u1",
          user: { id: "u1", name: "Me", email: "me@me.io", image: null },
        },
        {
          userId: "u2",
          user: { id: "u2", name: "Other", email: "o@o.io", image: null },
        },
      ],
    });

    const now = new Date();
    mocks.prisma.message.findMany.mockResolvedValueOnce([
      {
        id: "m-alive",
        conversationId: "c1",
        authorId: "u2",
        content: "hey",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deletedByAdminId: null,
        author: { id: "u2", name: "Other", email: "o@o.io", image: null },
      },
      {
        id: "m-deleted",
        conversationId: "c1",
        authorId: "u1",
        content: "super secret",
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedByAdminId: null,
        author: { id: "u1", name: "Me", email: "me@me.io", image: null },
      },
    ]);

    const result = await getConversation({ conversationId: "c1" });
    expect(result.id).toBe("c1");
    expect(result.otherUser?.id).toBe("u2");
    expect(result.messages).toHaveLength(2);
    // Soft-deleted message must NOT leak its original content.
    const deleted = result.messages.find((m) => m.id === "m-deleted");
    expect(deleted?.content).toBe("");
    const alive = result.messages.find((m) => m.id === "m-alive");
    expect(alive?.content).toBe("hey");
    expect(result.hasMore).toBe(false);
  });
});

describe("searchUsersForMessaging", () => {
  it("returns an empty array for a query shorter than 2 chars", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });

    const result = await searchUsersForMessaging({ query: "a" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.users).toEqual([]);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("queries Prisma and excludes current user", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.user.findMany.mockResolvedValueOnce([
      { id: "u2", name: "Bob", email: "b@b.io", image: null },
    ]);

    const result = await searchUsersForMessaging({ query: "bo" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.users).toHaveLength(1);
    expect(mocks.prisma.user.findMany).toHaveBeenCalledTimes(1);
    const [callArgs] = mocks.prisma.user.findMany.mock.calls[0];
    // Ensure we limit to 20 results.
    expect(callArgs.take).toBe(20);
  });
});

describe("getUnreadCount", () => {
  it("sums unread counts across conversations", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.conversationParticipant.findMany.mockResolvedValueOnce([
      { conversationId: "c1", lastReadAt: null },
      { conversationId: "c2", lastReadAt: new Date() },
    ]);
    mocks.prisma.message.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const result = await getUnreadCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(5);
  });

  it("returns 0 when the user has no conversations", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });
    mocks.prisma.conversationParticipant.findMany.mockResolvedValueOnce([]);

    const result = await getUnreadCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(0);
  });
});

describe("adminListConversations", () => {
  it("returns an empty array for non-admin callers", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });

    const result = await adminListConversations();
    expect(result).toEqual([]);
    expect(mocks.prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it("flattens participants and renames messages count to messageCount", async () => {
    mockAuthedUser({ id: "admin", emailVerified: true, role: "ADMIN" });

    const now = new Date();
    mocks.prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        createdAt: now,
        lastMessageAt: now,
        participants: [
          { user: { id: "u1", name: "A", email: "a@a.io", image: null } },
          { user: { id: "u2", name: "B", email: "b@b.io", image: null } },
        ],
        messages: [
          {
            id: "m1",
            content: "last",
            createdAt: now,
            deletedAt: null,
            deletedByAdminId: null,
          },
        ],
        _count: { messages: 42 },
      },
    ]);

    const result = await adminListConversations();
    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.participants).toHaveLength(2);
    expect(c.participants[0]).toEqual({
      id: "u1",
      name: "A",
      email: "a@a.io",
      image: null,
    });
    expect(c.messageCount).toBe(42);
    expect(c.lastMessage?.content).toBe("last");
  });
});

describe("adminDeleteMessage", () => {
  it("rejects non-admin callers", async () => {
    mockAuthedUser({ id: "u1", emailVerified: true, role: "USER" });

    const result = await adminDeleteMessage({ messageId: "m1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe(MessagingError.Forbidden);
  });

  it("soft-deletes with trace on happy path", async () => {
    mockAuthedUser({ id: "admin", emailVerified: true, role: "ADMIN" });
    mocks.prisma.message.findUnique.mockResolvedValueOnce({
      id: "m1",
      conversationId: "c1",
      deletedAt: null,
    });
    const updated = {
      id: "m1",
      deletedAt: new Date(),
      deletedByAdminId: "admin",
      deletionReason: "spam",
    };
    mocks.prisma.message.update.mockResolvedValueOnce(updated);

    const result = await adminDeleteMessage({ messageId: "m1", reason: "spam" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.deletedByAdminId).toBe("admin");
      expect(result.message.deletionReason).toBe("spam");
    }
  });
});
