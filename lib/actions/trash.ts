"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/blog";

// ─── Types ───────────────────────────────────────────────────────────────────

// Backwards-compatible alias — every trash action returns the shared
// ActionResult shape used across blog/trash modules. Keeping the old name
// available avoids breaking imports that may have started using it.
export type TrashActionResult<T = undefined> = ActionResult<T>;

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

const MODERATOR_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

type AuthedCaller = {
  id: string;
  role: Role;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireCaller(): Promise<AuthedCaller> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");

  return { id: dbUser.id, role: dbUser.role as Role };
}

async function requireModeratorRole(): Promise<AuthedCaller> {
  const caller = await requireCaller();
  if (!MODERATOR_ROLES.includes(caller.role as (typeof MODERATOR_ROLES)[number])) {
    throw new Error("Forbidden");
  }
  return caller;
}

async function requireAdminRole(): Promise<AuthedCaller> {
  const caller = await requireCaller();
  if (!ADMIN_ROLES.includes(caller.role as (typeof ADMIN_ROLES)[number])) {
    throw new Error("Forbidden");
  }
  return caller;
}

async function requireSuperAdminRole(): Promise<AuthedCaller> {
  const caller = await requireCaller();
  if (caller.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: SUPER_ADMIN required");
  }
  return caller;
}

function isAdminPlus(role: Role): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function revalidateTrashPaths(postSlug?: string): void {
  revalidatePath("/blog");
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  revalidatePath("/admin/trash");
  if (postSlug) revalidatePath(`/blog/${postSlug}`);
}

/**
 * Lightweight moderation log. We log the action, caller role, target ids and
 * a hash-free reason snippet. We deliberately avoid logging notes (admin-only).
 */
function logModerationAction(
  action: string,
  caller: AuthedCaller,
  details: Record<string, unknown>,
): void {
  // Use console.info: visible in Vercel logs without spamming console.error.
  // No PII, no secrets — only ids, role, action and short metadata.
  console.info(
    `[trash] ${action}`,
    JSON.stringify({
      callerId: caller.id,
      callerRole: caller.role,
      ...details,
    }),
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const moveToTrashPostSchema = z.object({
  postId: z.string().min(1, "postId required"),
  reason: z.string().trim().min(1, "Reason required").max(500, "Reason too long"),
  notes: z.string().trim().max(2000, "Notes too long").optional(),
});

const moveToTrashCommentSchema = z.object({
  commentId: z.string().min(1, "commentId required"),
  reason: z.string().trim().min(1, "Reason required").max(500, "Reason too long"),
  notes: z.string().trim().max(2000, "Notes too long").optional(),
});

const idOnlyPostSchema = z.object({ postId: z.string().min(1) });
const idOnlyCommentSchema = z.object({ commentId: z.string().min(1) });

const emptyTrashSchema = z.object({
  confirm: z.literal("VIDER"),
  olderThanDays: z.number().int().positive().max(3650).optional(),
});

// pageSize is clamped to 100 at runtime — schema accepts up to 1000 to give a
// clear "use default" path for the front rather than a Zod validation error
// on a slightly-too-big page.
const listTrashedSchema = z
  .object({
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(1000).optional(),
  })
  .optional();

// ─── moveToTrashPost ─────────────────────────────────────────────────────────

export async function moveToTrashPost(
  input: z.infer<typeof moveToTrashPostSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireModeratorRole();
    const { postId, reason, notes } = moveToTrashPostSchema.parse(input);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, trashedAt: true },
    });
    if (!post) return { success: false, error: "Post not found" };
    if (post.trashedAt) return { success: false, error: "Already in trash" };

    await prisma.post.update({
      where: { id: postId },
      data: {
        trashedAt: new Date(),
        trashedById: caller.id,
        trashReason: reason,
        trashNotes: notes ?? null,
      },
    });

    logModerationAction("moveToTrashPost", caller, { postId, slug: post.slug });
    revalidateTrashPaths(post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── moveToTrashComment ──────────────────────────────────────────────────────

export async function moveToTrashComment(
  input: z.infer<typeof moveToTrashCommentSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireModeratorRole();
    const { commentId, reason, notes } = moveToTrashCommentSchema.parse(input);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        trashedAt: true,
        post: { select: { slug: true } },
      },
    });
    if (!comment) return { success: false, error: "Comment not found" };
    if (comment.trashedAt) return { success: false, error: "Already in trash" };

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        trashedAt: new Date(),
        trashedById: caller.id,
        trashReason: reason,
        trashNotes: notes ?? null,
      },
    });

    logModerationAction("moveToTrashComment", caller, { commentId });
    revalidateTrashPaths(comment.post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── restorePost ─────────────────────────────────────────────────────────────

export async function restorePost(
  input: z.infer<typeof idOnlyPostSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireAdminRole();
    const { postId } = idOnlyPostSchema.parse(input);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, trashedAt: true },
    });
    if (!post) return { success: false, error: "Post not found" };
    if (!post.trashedAt) return { success: false, error: "Not in trash" };

    await prisma.post.update({
      where: { id: postId },
      data: {
        trashedAt: null,
        trashedById: null,
        trashReason: null,
        trashNotes: null,
      },
    });

    logModerationAction("restorePost", caller, { postId, slug: post.slug });
    revalidateTrashPaths(post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── restoreComment ──────────────────────────────────────────────────────────

export async function restoreComment(
  input: z.infer<typeof idOnlyCommentSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireAdminRole();
    const { commentId } = idOnlyCommentSchema.parse(input);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        trashedAt: true,
        post: { select: { slug: true } },
      },
    });
    if (!comment) return { success: false, error: "Comment not found" };
    if (!comment.trashedAt) return { success: false, error: "Not in trash" };

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        trashedAt: null,
        trashedById: null,
        trashReason: null,
        trashNotes: null,
      },
    });

    logModerationAction("restoreComment", caller, { commentId });
    revalidateTrashPaths(comment.post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── hardDeletePost ──────────────────────────────────────────────────────────

export async function hardDeletePost(
  input: z.infer<typeof idOnlyPostSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireSuperAdminRole();
    const { postId } = idOnlyPostSchema.parse(input);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, trashedAt: true },
    });
    if (!post) return { success: false, error: "Post not found" };
    if (!post.trashedAt) {
      return {
        success: false,
        error: "Post must be in trash before hard delete",
      };
    }

    await prisma.post.delete({ where: { id: postId } });

    logModerationAction("hardDeletePost", caller, { postId, slug: post.slug });
    revalidateTrashPaths(post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── hardDeleteComment ───────────────────────────────────────────────────────

export async function hardDeleteComment(
  input: z.infer<typeof idOnlyCommentSchema>,
): Promise<ActionResult> {
  try {
    const caller = await requireSuperAdminRole();
    const { commentId } = idOnlyCommentSchema.parse(input);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        trashedAt: true,
        post: { select: { slug: true } },
      },
    });
    if (!comment) return { success: false, error: "Comment not found" };
    if (!comment.trashedAt) {
      return {
        success: false,
        error: "Comment must be in trash before hard delete",
      };
    }

    await prisma.comment.delete({ where: { id: commentId } });

    logModerationAction("hardDeleteComment", caller, { commentId });
    revalidateTrashPaths(comment.post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── emptyTrash ──────────────────────────────────────────────────────────────

export async function emptyTrash(
  input: z.infer<typeof emptyTrashSchema>,
): Promise<ActionResult<{ posts: number; comments: number }>> {
  try {
    const caller = await requireSuperAdminRole();
    const { olderThanDays } = emptyTrashSchema.parse(input);

    const baseWhere: { trashedAt: { not: null } | { lt: Date } } = olderThanDays
      ? {
          trashedAt: {
            lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000),
          },
        }
      : { trashedAt: { not: null } };

    // Delete comments first (they can be cascaded by post delete too, but we
    // count standalone trashed comments + comments whose post is trashed
    // ends up cascaded anyway; explicit deletion gives an accurate count).
    const trashedComments = await prisma.comment.deleteMany({
      where: baseWhere,
    });
    const trashedPosts = await prisma.post.deleteMany({
      where: baseWhere,
    });

    logModerationAction("emptyTrash", caller, {
      olderThanDays: olderThanDays ?? null,
      posts: trashedPosts.count,
      comments: trashedComments.count,
    });
    revalidateTrashPaths();
    return {
      success: true,
      data: { posts: trashedPosts.count, comments: trashedComments.count },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── listTrashedPosts ────────────────────────────────────────────────────────

type TrashedPostItem = {
  id: string;
  title: string;
  slug: string;
  authorName: string | null;
  trashedAt: Date;
  trashedBy: { name: string } | null;
  trashReason: string;
  trashNotes: string | null;
};

export async function listTrashedPosts(
  input?: z.infer<typeof listTrashedSchema>,
): Promise<ActionResult<{ items: TrashedPostItem[]; total: number }>> {
  try {
    const caller = await requireModeratorRole();
    const parsed = listTrashedSchema.parse(input);
    const page = parsed?.page ?? 1;
    const pageSize = Math.min(parsed?.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where: { trashedAt: { not: null } },
        orderBy: { trashedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          slug: true,
          trashedAt: true,
          trashReason: true,
          trashNotes: true,
          author: { select: { name: true } },
          trashedBy: { select: { name: true } },
        },
      }),
      prisma.post.count({ where: { trashedAt: { not: null } } }),
    ]);

    const exposeNotes = isAdminPlus(caller.role);
    const items: TrashedPostItem[] = rows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      authorName: p.author?.name ?? null,
      trashedAt: p.trashedAt!,
      trashedBy: p.trashedBy ? { name: p.trashedBy.name } : null,
      trashReason: p.trashReason ?? "",
      trashNotes: exposeNotes ? p.trashNotes ?? null : null,
    }));

    return { success: true, data: { items, total } };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── listTrashedComments ─────────────────────────────────────────────────────

type TrashedCommentItem = {
  id: string;
  content: string;
  postId: string;
  postSlug: string;
  postTitle: string;
  authorName: string | null;
  trashedAt: Date;
  trashedBy: { name: string } | null;
  trashReason: string;
  trashNotes: string | null;
};

export async function listTrashedComments(
  input?: z.infer<typeof listTrashedSchema>,
): Promise<ActionResult<{ items: TrashedCommentItem[]; total: number }>> {
  try {
    const caller = await requireModeratorRole();
    const parsed = listTrashedSchema.parse(input);
    const page = parsed?.page ?? 1;
    const pageSize = Math.min(parsed?.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.comment.findMany({
        where: { trashedAt: { not: null } },
        orderBy: { trashedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          content: true,
          postId: true,
          trashedAt: true,
          trashReason: true,
          trashNotes: true,
          author: { select: { name: true } },
          trashedBy: { select: { name: true } },
          post: { select: { slug: true, title: true } },
        },
      }),
      prisma.comment.count({ where: { trashedAt: { not: null } } }),
    ]);

    const exposeNotes = isAdminPlus(caller.role);
    const items: TrashedCommentItem[] = rows.map((c) => ({
      id: c.id,
      content: c.content,
      postId: c.postId,
      postSlug: c.post.slug,
      postTitle: c.post.title,
      authorName: c.author?.name ?? null,
      trashedAt: c.trashedAt!,
      trashedBy: c.trashedBy ? { name: c.trashedBy.name } : null,
      trashReason: c.trashReason ?? "",
      trashNotes: exposeNotes ? c.trashNotes ?? null : null,
    }));

    return { success: true, data: { items, total } };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}
