"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/blog";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

type AuthedUser = {
  id: string;
  role: Role;
  emailVerified: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Duplicated locally (instead of importing from lib/actions/blog) to avoid
// importing a "use server" module from another "use server" file — and to keep
// each actions module self-contained as the spec recommends.
async function requireAuthUser(): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, emailVerified: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  if (!dbUser.emailVerified) throw new Error("Email not verified");

  return {
    id: dbUser.id,
    role: dbUser.role as Role,
    emailVerified: dbUser.emailVerified,
  };
}

type SanctionFlags = { banned: boolean; muted: boolean };

async function getActiveSanctionFlags(userId: string): Promise<SanctionFlags> {
  const now = new Date();
  const sanctions = await prisma.sanction.findMany({
    where: {
      userId,
      status: "ACTIVE",
      type: { in: ["MUTE", "TEMPORARY_BAN", "PERMANENT_BAN"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { type: true },
  });

  let banned = false;
  let muted = false;
  for (const s of sanctions) {
    if (s.type === "TEMPORARY_BAN" || s.type === "PERMANENT_BAN") banned = true;
    if (s.type === "MUTE") muted = true;
  }
  return { banned, muted };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const toggleLikePostSchema = z.object({
  postId: z.string().trim().min(1, "postId required"),
});

const toggleLikeCommentSchema = z.object({
  commentId: z.string().trim().min(1, "commentId required"),
});

export type ToggleLikePostInput = z.infer<typeof toggleLikePostSchema>;
export type ToggleLikeCommentInput = z.infer<typeof toggleLikeCommentSchema>;

export type ToggleLikeResult = { liked: boolean; count: number };

// ─── toggleLikePost ──────────────────────────────────────────────────────────

/**
 * Toggle a like on a published, non-trashed, non-deleted post.
 *
 * Auth: USER+ with verified email, not banned.
 * Idempotent at the UI level: a second call removes the like.
 * The DB-level @@unique([postId, userId]) guarantees that concurrent
 * double-creates do not produce duplicates (P2002 is caught and treated as
 * "already liked → fall back to delete").
 */
export async function toggleLikePost(
  input: ToggleLikePostInput,
): Promise<ActionResult<ToggleLikeResult>> {
  try {
    const user = await requireAuthUser();
    const { postId } = toggleLikePostSchema.parse(input);

    const flags = await getActiveSanctionFlags(user.id);
    if (flags.banned) return { success: false, error: "Banned" };

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        published: true,
        trashedAt: null,
        deletedAt: null,
      },
      select: { id: true, slug: true },
    });
    if (!post) return { success: false, error: "Not found" };

    const result = await togglePostLikeAtomic(post.id, user.id);

    // Revalidate the listing and the detail page. TanStack Query handles
    // optimistic UI on the client; revalidation here keeps server-rendered
    // pages (e.g. /blog) in sync with the new count.
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);

    return { success: true, data: result };
  } catch (err) {
    console.error("[likes] toggleLikePost failed", errorMessage(err));
    return { success: false, error: errorMessage(err) };
  }
}

// ─── toggleLikeComment ───────────────────────────────────────────────────────

/**
 * Toggle a like on a visible (non-trashed, non-deleted) comment whose post is
 * itself visible (published, non-trashed, non-deleted).
 *
 * Auth: USER+ with verified email, not banned. Muted users are allowed (mute
 * concerns writing content; a like is not content).
 */
export async function toggleLikeComment(
  input: ToggleLikeCommentInput,
): Promise<ActionResult<ToggleLikeResult>> {
  try {
    const user = await requireAuthUser();
    const { commentId } = toggleLikeCommentSchema.parse(input);

    const flags = await getActiveSanctionFlags(user.id);
    if (flags.banned) return { success: false, error: "Banned" };

    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        trashedAt: null,
        deletedAt: null,
        post: { published: true, trashedAt: null, deletedAt: null },
      },
      select: { id: true, post: { select: { slug: true } } },
    });
    if (!comment) return { success: false, error: "Not found" };

    const result = await toggleCommentLikeAtomic(comment.id, user.id);

    revalidatePath(`/blog/${comment.post.slug}`);

    return { success: true, data: result };
  } catch (err) {
    console.error("[likes] toggleLikeComment failed", errorMessage(err));
    return { success: false, error: errorMessage(err) };
  }
}

// ─── Atomic toggles ──────────────────────────────────────────────────────────

/**
 * Atomic toggle for a PostLike. Strategy:
 *  1. Try `delete` on the composite unique key. If a row existed, we were
 *     removing a like.
 *  2. Otherwise, `create`. If a concurrent transaction beat us to it
 *     (P2002), fall back to a delete (the user effectively "double-clicked"
 *     — they want the final state to be unliked).
 *  3. Recompute the count inside the same transaction for a consistent
 *     read.
 */
async function togglePostLikeAtomic(
  postId: string,
  userId: string,
): Promise<ToggleLikeResult> {
  return prisma.$transaction(async (tx) => {
    let liked: boolean;
    try {
      await tx.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      liked = false;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        // No existing row — create one. P2002 (race) is re-caught below.
        try {
          await tx.postLike.create({ data: { postId, userId } });
          liked = true;
        } catch (createErr) {
          if (
            createErr instanceof Prisma.PrismaClientKnownRequestError &&
            createErr.code === "P2002"
          ) {
            // Race: the row appeared between delete & create. Remove it so
            // the final state matches "second click = unliked".
            await tx.postLike.delete({
              where: { postId_userId: { postId, userId } },
            });
            liked = false;
          } else {
            throw createErr;
          }
        }
      } else {
        throw err;
      }
    }

    const count = await tx.postLike.count({ where: { postId } });
    return { liked, count };
  });
}

async function toggleCommentLikeAtomic(
  commentId: string,
  userId: string,
): Promise<ToggleLikeResult> {
  return prisma.$transaction(async (tx) => {
    let liked: boolean;
    try {
      await tx.commentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      });
      liked = false;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        try {
          await tx.commentLike.create({ data: { commentId, userId } });
          liked = true;
        } catch (createErr) {
          if (
            createErr instanceof Prisma.PrismaClientKnownRequestError &&
            createErr.code === "P2002"
          ) {
            await tx.commentLike.delete({
              where: { commentId_userId: { commentId, userId } },
            });
            liked = false;
          } else {
            throw createErr;
          }
        }
      } else {
        throw err;
      }
    }

    const count = await tx.commentLike.count({ where: { commentId } });
    return { liked, count };
  });
}
