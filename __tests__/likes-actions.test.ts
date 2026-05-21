import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  // Minimal stand-in for Prisma's known-request error so we can simulate
  // P2025 / P2002 paths in the toggle implementation without depending on the
  // real @prisma/client class hierarchy at test time.
  class FakePrismaKnownError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = "PrismaClientKnownRequestError";
      this.code = code;
    }
  }

  return {
    FakePrismaKnownError,
    getSession: vi.fn(),
    prisma: {
      user: { findUnique: vi.fn() },
      sanction: { findMany: vi.fn() },
      post: { findFirst: vi.fn() },
      comment: { findFirst: vi.fn() },
      postLike: {
        delete: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      commentLike: {
        delete: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

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

// Mock @prisma/client to expose our fake error class as
// `Prisma.PrismaClientKnownRequestError`.
vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: mocks.FakePrismaKnownError,
  },
}));

// Import AFTER mocks.
import { toggleLikePost, toggleLikeComment } from "@/lib/actions/likes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

type AuthOptions = {
  id?: string;
  role?: Role;
  emailVerified?: boolean;
  sanctions?: Array<{ type: "MUTE" | "TEMPORARY_BAN" | "PERMANENT_BAN" }>;
};

function mockUnauthenticated(): void {
  mocks.getSession.mockResolvedValueOnce(null);
}

function mockAuthed(opts: AuthOptions = {}): string {
  const id = opts.id ?? "user-1";
  const role = opts.role ?? "USER";
  const emailVerified = opts.emailVerified ?? true;

  mocks.getSession.mockResolvedValueOnce({ user: { id } });
  mocks.prisma.user.findUnique.mockResolvedValueOnce({
    id,
    role,
    emailVerified,
  });
  // Sanction lookup happens after auth — only mock when we expect the
  // implementation to reach it (auth passes).
  if (emailVerified) {
    mocks.prisma.sanction.findMany.mockResolvedValueOnce(opts.sanctions ?? []);
  }
  return id;
}

/**
 * Helper to drive `$transaction(async (tx) => …)` — we hand the mock prisma
 * itself as the tx, so `tx.postLike.*` resolves to the same vi.fn() we
 * preconfigured.
 */
function mockTxRuns(): void {
  mocks.prisma.$transaction.mockImplementationOnce(
    async (cb: (tx: typeof mocks.prisma) => unknown) => cb(mocks.prisma),
  );
}

const POST_ID = "ckpost00000000000000000001";
const COMMENT_ID = "ckcomm00000000000000000001";

beforeEach(() => {
  // `resetAllMocks` (vs `clearAllMocks`) also drops any `mockResolvedValueOnce`
  // queues that prior tests may have set up but not consumed (e.g. when the
  // implementation short-circuits via Zod validation before reaching the
  // mocked DB call). Critical for test isolation here.
  vi.resetAllMocks();
});

// ─── toggleLikePost ───────────────────────────────────────────────────────────

describe("toggleLikePost", () => {
  it("rejects anonymous callers", async () => {
    mockUnauthenticated();
    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
    expect(mocks.prisma.postLike.create).not.toHaveBeenCalled();
    expect(mocks.prisma.postLike.delete).not.toHaveBeenCalled();
  });

  it("rejects users with an unverified email", async () => {
    mockAuthed({ emailVerified: false });
    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Email not verified");
  });

  it("rejects banned users (TEMPORARY_BAN)", async () => {
    mockAuthed({ sanctions: [{ type: "TEMPORARY_BAN" }] });
    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Banned");
    expect(mocks.prisma.postLike.create).not.toHaveBeenCalled();
  });

  it("rejects banned users (PERMANENT_BAN)", async () => {
    mockAuthed({ sanctions: [{ type: "PERMANENT_BAN" }] });
    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Banned");
  });

  it("allows muted users (mute does not block likes)", async () => {
    mockAuthed({ sanctions: [{ type: "MUTE" }] });
    mocks.prisma.post.findFirst.mockResolvedValueOnce({
      id: POST_ID,
      slug: "post-slug",
    });
    mockTxRuns();
    // First delete throws P2025 (no existing like) → create succeeds.
    mocks.prisma.postLike.delete.mockRejectedValueOnce(
      new mocks.FakePrismaKnownError("P2025"),
    );
    mocks.prisma.postLike.create.mockResolvedValueOnce({ id: "like-1" });
    mocks.prisma.postLike.count.mockResolvedValueOnce(1);

    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: true, count: 1 });
    }
  });

  it("returns Not found for a trashed/deleted/unpublished post", async () => {
    mockAuthed();
    // The action filters server-side with { published, trashedAt: null,
    // deletedAt: null } — simulate a no-match by returning null.
    mocks.prisma.post.findFirst.mockResolvedValueOnce(null);
    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Not found");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a like and increments the counter on first click", async () => {
    mockAuthed();
    mocks.prisma.post.findFirst.mockResolvedValueOnce({
      id: POST_ID,
      slug: "post-slug",
    });
    mockTxRuns();
    mocks.prisma.postLike.delete.mockRejectedValueOnce(
      new mocks.FakePrismaKnownError("P2025"),
    );
    mocks.prisma.postLike.create.mockResolvedValueOnce({ id: "like-1" });
    mocks.prisma.postLike.count.mockResolvedValueOnce(7);

    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: true, count: 7 });
    }
    expect(mocks.prisma.postLike.create).toHaveBeenCalledWith({
      data: { postId: POST_ID, userId: "user-1" },
    });
  });

  it("removes the like on a second click (toggle off)", async () => {
    mockAuthed();
    mocks.prisma.post.findFirst.mockResolvedValueOnce({
      id: POST_ID,
      slug: "post-slug",
    });
    mockTxRuns();
    // The delete succeeds → we were "unliking".
    mocks.prisma.postLike.delete.mockResolvedValueOnce({ id: "like-1" });
    mocks.prisma.postLike.count.mockResolvedValueOnce(6);

    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: false, count: 6 });
    }
    expect(mocks.prisma.postLike.create).not.toHaveBeenCalled();
  });

  it("handles P2002 race by falling back to delete (idempotent final state)", async () => {
    mockAuthed();
    mocks.prisma.post.findFirst.mockResolvedValueOnce({
      id: POST_ID,
      slug: "post-slug",
    });
    mockTxRuns();
    // 1st delete: no row (P2025) → 2nd attempt creates → P2002 (race) → fallback delete succeeds.
    mocks.prisma.postLike.delete.mockRejectedValueOnce(
      new mocks.FakePrismaKnownError("P2025"),
    );
    mocks.prisma.postLike.create.mockRejectedValueOnce(
      new mocks.FakePrismaKnownError("P2002"),
    );
    mocks.prisma.postLike.delete.mockResolvedValueOnce({ id: "like-1" });
    mocks.prisma.postLike.count.mockResolvedValueOnce(5);

    const result = await toggleLikePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: false, count: 5 });
    }
  });

  it("validates empty postId via Zod", async () => {
    mockAuthed();
    const result = await toggleLikePost({ postId: "" });
    expect(result.success).toBe(false);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ─── toggleLikeComment ────────────────────────────────────────────────────────

describe("toggleLikeComment", () => {
  it("rejects anonymous callers", async () => {
    mockUnauthenticated();
    const result = await toggleLikeComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("rejects banned users", async () => {
    mockAuthed({ sanctions: [{ type: "PERMANENT_BAN" }] });
    const result = await toggleLikeComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Banned");
  });

  it("returns Not found for a trashed/deleted comment", async () => {
    mockAuthed();
    mocks.prisma.comment.findFirst.mockResolvedValueOnce(null);
    const result = await toggleLikeComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Not found");
  });

  it("creates a like on a visible comment and returns the new count", async () => {
    mockAuthed();
    mocks.prisma.comment.findFirst.mockResolvedValueOnce({
      id: COMMENT_ID,
      post: { slug: "post-slug" },
    });
    mockTxRuns();
    mocks.prisma.commentLike.delete.mockRejectedValueOnce(
      new mocks.FakePrismaKnownError("P2025"),
    );
    mocks.prisma.commentLike.create.mockResolvedValueOnce({ id: "like-c-1" });
    mocks.prisma.commentLike.count.mockResolvedValueOnce(3);

    const result = await toggleLikeComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: true, count: 3 });
    }
    expect(mocks.prisma.commentLike.create).toHaveBeenCalledWith({
      data: { commentId: COMMENT_ID, userId: "user-1" },
    });
  });

  it("removes the like on a second click", async () => {
    mockAuthed();
    mocks.prisma.comment.findFirst.mockResolvedValueOnce({
      id: COMMENT_ID,
      post: { slug: "post-slug" },
    });
    mockTxRuns();
    mocks.prisma.commentLike.delete.mockResolvedValueOnce({ id: "like-c-1" });
    mocks.prisma.commentLike.count.mockResolvedValueOnce(2);

    const result = await toggleLikeComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ liked: false, count: 2 });
    }
  });
});
