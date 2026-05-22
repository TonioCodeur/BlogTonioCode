import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
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
  moveToTrashPost,
  moveToTrashComment,
  restorePost,
  restoreComment,
  hardDeletePost,
  hardDeleteComment,
  emptyTrash,
  listTrashedPosts,
  listTrashedComments,
} from "@/lib/actions/trash";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CallerRole = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

function mockCaller(role: CallerRole | null, callerId = "caller-id") {
  if (role === null) {
    mocks.getSession.mockResolvedValueOnce(null);
    return;
  }
  mocks.getSession.mockResolvedValueOnce({ user: { id: callerId } });
  mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: callerId, role });
}

const POST_ID = "ckpost00000000000000000001";
const COMMENT_ID = "ckcomm00000000000000000001";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── moveToTrashPost ──────────────────────────────────────────────────────────

describe("moveToTrashPost", () => {
  it("rejects unauthenticated callers", async () => {
    mockCaller(null);
    const result = await moveToTrashPost({ postId: POST_ID, reason: "spam" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("rejects a USER caller (Forbidden)", async () => {
    mockCaller("USER");
    const result = await moveToTrashPost({ postId: POST_ID, reason: "spam" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
    expect(mocks.prisma.post.update).not.toHaveBeenCalled();
  });

  it("rejects a CUSTOMER caller (Forbidden)", async () => {
    mockCaller("CUSTOMER");
    const result = await moveToTrashPost({ postId: POST_ID, reason: "spam" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
  });

  it("lets a MODERATOR send a post to trash with a reason", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: null,
    });
    mocks.prisma.post.update.mockResolvedValueOnce({ id: POST_ID });

    const result = await moveToTrashPost({
      postId: POST_ID,
      reason: "Spam content",
      notes: "Internal trace",
    });
    expect(result.success).toBe(true);
    const [args] = mocks.prisma.post.update.mock.calls[0];
    expect(args.where).toEqual({ id: POST_ID });
    expect(args.data.trashedAt).toBeInstanceOf(Date);
    expect(args.data.trashedById).toBe("caller-id");
    expect(args.data.trashReason).toBe("Spam content");
    expect(args.data.trashNotes).toBe("Internal trace");
  });

  it("returns 'Already in trash' when the post is already trashed", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: new Date(),
    });

    const result = await moveToTrashPost({ postId: POST_ID, reason: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Already in trash");
    expect(mocks.prisma.post.update).not.toHaveBeenCalled();
  });

  it("returns 'Post not found' when the post does not exist", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.post.findUnique.mockResolvedValueOnce(null);
    const result = await moveToTrashPost({ postId: POST_ID, reason: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Post not found");
  });

  it("rejects empty reason via Zod", async () => {
    mockCaller("MODERATOR");
    const result = await moveToTrashPost({ postId: POST_ID, reason: "   " });
    expect(result.success).toBe(false);
  });
});

// ─── moveToTrashComment ───────────────────────────────────────────────────────

describe("moveToTrashComment", () => {
  it("lets a MODERATOR move a comment to trash", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.comment.findUnique.mockResolvedValueOnce({
      id: COMMENT_ID,
      trashedAt: null,
      post: { slug: "my-post" },
    });
    mocks.prisma.comment.update.mockResolvedValueOnce({ id: COMMENT_ID });

    const result = await moveToTrashComment({
      commentId: COMMENT_ID,
      reason: "abusive",
    });
    expect(result.success).toBe(true);
    const [args] = mocks.prisma.comment.update.mock.calls[0];
    expect(args.data.trashedAt).toBeInstanceOf(Date);
    expect(args.data.trashReason).toBe("abusive");
  });

  it("rejects a USER", async () => {
    mockCaller("USER");
    const result = await moveToTrashComment({
      commentId: COMMENT_ID,
      reason: "abusive",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
  });
});

// ─── restorePost ──────────────────────────────────────────────────────────────

describe("restorePost", () => {
  it("rejects a MODERATOR (Forbidden — ADMIN+ required)", async () => {
    mockCaller("MODERATOR");
    const result = await restorePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
    expect(mocks.prisma.post.update).not.toHaveBeenCalled();
  });

  it("lets an ADMIN restore a trashed post", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: new Date(),
    });
    mocks.prisma.post.update.mockResolvedValueOnce({ id: POST_ID });

    const result = await restorePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    const [args] = mocks.prisma.post.update.mock.calls[0];
    expect(args.data).toEqual({
      trashedAt: null,
      trashedById: null,
      trashReason: null,
      trashNotes: null,
    });
  });

  it("returns 'Not in trash' if the post is not trashed", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: null,
    });
    const result = await restorePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Not in trash");
  });
});

// ─── restoreComment ───────────────────────────────────────────────────────────

describe("restoreComment", () => {
  it("rejects a MODERATOR", async () => {
    mockCaller("MODERATOR");
    const result = await restoreComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
  });

  it("lets a SUPER_ADMIN restore", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.comment.findUnique.mockResolvedValueOnce({
      id: COMMENT_ID,
      trashedAt: new Date(),
      post: { slug: "my-post" },
    });
    mocks.prisma.comment.update.mockResolvedValueOnce({ id: COMMENT_ID });

    const result = await restoreComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(true);
  });
});

// ─── hardDeletePost ───────────────────────────────────────────────────────────

describe("hardDeletePost", () => {
  it("rejects a MODERATOR (ADMIN+ required)", async () => {
    mockCaller("MODERATOR");
    const result = await hardDeletePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Forbidden");
    expect(mocks.prisma.post.delete).not.toHaveBeenCalled();
  });

  it("lets an ADMIN hard-delete a trashed post", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: new Date(),
    });
    mocks.prisma.post.delete.mockResolvedValueOnce({ id: POST_ID });

    const result = await hardDeletePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    expect(mocks.prisma.post.delete).toHaveBeenCalledWith({
      where: { id: POST_ID },
    });
  });

  it("refuses to delete a post that is NOT in trash", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: null,
    });
    const result = await hardDeletePost({ postId: POST_ID });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("Post must be in trash before hard delete");
    expect(mocks.prisma.post.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes a trashed post on SUPER_ADMIN happy path", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.post.findUnique.mockResolvedValueOnce({
      id: POST_ID,
      slug: "my-post",
      trashedAt: new Date(),
    });
    mocks.prisma.post.delete.mockResolvedValueOnce({ id: POST_ID });

    const result = await hardDeletePost({ postId: POST_ID });
    expect(result.success).toBe(true);
    expect(mocks.prisma.post.delete).toHaveBeenCalledWith({
      where: { id: POST_ID },
    });
  });
});

// ─── hardDeleteComment ────────────────────────────────────────────────────────

describe("hardDeleteComment", () => {
  it("rejects a MODERATOR (ADMIN+ required)", async () => {
    mockCaller("MODERATOR");
    const result = await hardDeleteComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Forbidden");
    expect(mocks.prisma.comment.delete).not.toHaveBeenCalled();
  });

  it("lets an ADMIN hard-delete a trashed comment", async () => {
    mockCaller("ADMIN");
    mocks.prisma.comment.findUnique.mockResolvedValueOnce({
      id: COMMENT_ID,
      trashedAt: new Date(),
      post: { slug: "my-post" },
    });
    mocks.prisma.comment.delete.mockResolvedValueOnce({ id: COMMENT_ID });

    const result = await hardDeleteComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(true);
    expect(mocks.prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
    });
  });

  it("hard-deletes a trashed comment on SUPER_ADMIN happy path", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.comment.findUnique.mockResolvedValueOnce({
      id: COMMENT_ID,
      trashedAt: new Date(),
      post: { slug: "my-post" },
    });
    mocks.prisma.comment.delete.mockResolvedValueOnce({ id: COMMENT_ID });

    const result = await hardDeleteComment({ commentId: COMMENT_ID });
    expect(result.success).toBe(true);
    expect(mocks.prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
    });
  });
});

// ─── emptyTrash ───────────────────────────────────────────────────────────────

describe("emptyTrash", () => {
  it("rejects non-SUPER_ADMIN", async () => {
    mockCaller("ADMIN");
    const result = await emptyTrash({ confirm: "VIDER" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Forbidden");
  });

  it("rejects when confirm token is wrong", async () => {
    // Caller resolution should not even be reached if validation runs first;
    // but our implementation parses inside try/catch — set up a SUPER_ADMIN
    // session so the only failure source is the schema.
    mockCaller("SUPER_ADMIN");
    const result = await emptyTrash({ confirm: "nope" as "VIDER" });
    expect(result.success).toBe(false);
  });

  it("empties all trashed content as SUPER_ADMIN", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.comment.deleteMany.mockResolvedValueOnce({ count: 3 });
    mocks.prisma.post.deleteMany.mockResolvedValueOnce({ count: 2 });

    const result = await emptyTrash({ confirm: "VIDER" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ posts: 2, comments: 3 });
    }
    // First call: all trashed.
    const [postArgs] = mocks.prisma.post.deleteMany.mock.calls[0];
    expect(postArgs.where).toEqual({ trashedAt: { not: null } });
  });

  it("respects olderThanDays cutoff", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.comment.deleteMany.mockResolvedValueOnce({ count: 0 });
    mocks.prisma.post.deleteMany.mockResolvedValueOnce({ count: 0 });

    const before = Date.now();
    const result = await emptyTrash({ confirm: "VIDER", olderThanDays: 30 });
    expect(result.success).toBe(true);

    const [postArgs] = mocks.prisma.post.deleteMany.mock.calls[0];
    expect(postArgs.where.trashedAt.lt).toBeInstanceOf(Date);
    const cutoff = (postArgs.where.trashedAt.lt as Date).getTime();
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    // Allow ±1s drift between two now() calls in the test.
    expect(Math.abs(cutoff - expected)).toBeLessThan(1000);
  });
});

// ─── listTrashedPosts ─────────────────────────────────────────────────────────

describe("listTrashedPosts", () => {
  it("rejects a USER", async () => {
    mockCaller("USER");
    const result = await listTrashedPosts();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
  });

  it("rejects an unauthenticated caller", async () => {
    mockCaller(null);
    const result = await listTrashedPosts();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("returns items for a MODERATOR but hides trashNotes (admin-only)", async () => {
    mockCaller("MODERATOR");
    const trashedAt = new Date();
    mocks.prisma.post.findMany.mockResolvedValueOnce([
      {
        id: POST_ID,
        title: "Bad",
        slug: "bad",
        trashedAt,
        trashReason: "Spam",
        trashNotes: "internal-only",
        author: { name: "Alice" },
        trashedBy: { name: "Mod" },
      },
    ]);
    mocks.prisma.post.count.mockResolvedValueOnce(1);

    const result = await listTrashedPosts();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.items[0].trashNotes).toBeNull();
      expect(result.data.items[0].trashReason).toBe("Spam");
      expect(result.data.items[0].trashedBy?.name).toBe("Mod");
    }
  });

  it("returns trashNotes to an ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findMany.mockResolvedValueOnce([
      {
        id: POST_ID,
        title: "Bad",
        slug: "bad",
        trashedAt: new Date(),
        trashReason: "Spam",
        trashNotes: "internal-only",
        author: { name: "Alice" },
        trashedBy: { name: "Mod" },
      },
    ]);
    mocks.prisma.post.count.mockResolvedValueOnce(1);

    const result = await listTrashedPosts();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].trashNotes).toBe("internal-only");
    }
  });

  it("clamps pageSize at 100", async () => {
    mockCaller("ADMIN");
    mocks.prisma.post.findMany.mockResolvedValueOnce([]);
    mocks.prisma.post.count.mockResolvedValueOnce(0);

    await listTrashedPosts({ pageSize: 500 });
    const [args] = mocks.prisma.post.findMany.mock.calls[0];
    expect(args.take).toBe(100);
  });
});

// ─── listTrashedComments ──────────────────────────────────────────────────────

describe("listTrashedComments", () => {
  it("rejects a USER", async () => {
    mockCaller("USER");
    const result = await listTrashedComments();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
  });

  it("returns items for a MODERATOR with trashNotes hidden", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.comment.findMany.mockResolvedValueOnce([
      {
        id: COMMENT_ID,
        content: "bad content",
        postId: POST_ID,
        trashedAt: new Date(),
        trashReason: "Abuse",
        trashNotes: "secret",
        author: { name: "Bob" },
        trashedBy: { name: "Mod" },
        post: { slug: "p", title: "Post" },
      },
    ]);
    mocks.prisma.comment.count.mockResolvedValueOnce(1);

    const result = await listTrashedComments();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].trashNotes).toBeNull();
      expect(result.data.items[0].postSlug).toBe("p");
    }
  });
});
