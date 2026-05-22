"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createPostSchema,
  createCategorySchema,
  createCommentSchema,
  type CreatePostInput,
  type CreateCategoryInput,
  type CreateCommentInput,
} from "@/lib/validations/blog";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

const MODERATOR_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

type AuthedUser = {
  id: string;
  role: Role;
  emailVerified: boolean;
};

async function requireAuthUser(): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, emailVerified: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  if (!dbUser.emailVerified) throw new Error("Email not verified");

  return { id: dbUser.id, role: dbUser.role as Role, emailVerified: dbUser.emailVerified };
}

function isModerator(role: Role): boolean {
  return MODERATOR_ROLES.includes(role as (typeof MODERATOR_ROLES)[number]);
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

async function ensureUniquePostSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

async function ensureUniqueCategorySlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

function revalidateBlogPaths(postSlug?: string): void {
  revalidatePath("/blog");
  revalidatePath("/categories");
  if (postSlug) revalidatePath(`/blog/${postSlug}`);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

// ─── createPost ──────────────────────────────────────────────────────────────

export async function createPost(
  input: CreatePostInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await requireAuthUser();
    const data = createPostSchema.parse(input);

    const flags = await getActiveSanctionFlags(user.id);
    if (flags.banned) return { success: false, error: "You are banned from creating content" };

    const category = await prisma.category.findUnique({
      where: { slug: data.categorySlug },
      select: { slug: true, trashedAt: true, deletedAt: true },
    });
    if (!category || category.trashedAt || category.deletedAt) {
      return { success: false, error: "Category not found" };
    }

    const baseSlug = data.slug ?? slugify(data.title);
    if (!baseSlug) return { success: false, error: "Could not derive a valid slug from the title" };
    const slug = await ensureUniquePostSlug(baseSlug);

    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt ?? null,
        content: data.content,
        coverImage: data.coverImage ?? null,
        categorySlug: data.categorySlug,
        published: data.published,
        publishedAt: data.published ? new Date() : null,
        authorId: user.id,
      },
      select: { id: true, slug: true },
    });

    revalidateBlogPaths(post.slug);
    return { success: true, data: post };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── deletePost ──────────────────────────────────────────────────────────────
//
// Behaviour per trash spec §4.6:
//   - Author of the post:  soft-delete (deletedAt = now()).
//                          Refused if the post is already TRASHED by moderation.
//   - MODERATOR+:          must call moveToTrashPost() from `lib/actions/trash.ts`
//                          (we deprecate the previous direct hard-delete path
//                          to prevent destructive moderation without a reason).
//   - Anyone else:         Forbidden.

export async function deletePost(id: string): Promise<ActionResult> {
  try {
    if (!id || typeof id !== "string") return { success: false, error: "Invalid id" };
    const user = await requireAuthUser();

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, slug: true, authorId: true, trashedAt: true, deletedAt: true },
    });
    if (!post) return { success: false, error: "Post not found" };

    const isAuthor = post.authorId === user.id;

    if (!isAuthor) {
      // MODERATOR+ must go through moveToTrashPost (requires a reason).
      // We refuse here rather than silently re-route to enforce a reason field.
      if (isModerator(user.role)) {
        return {
          success: false,
          error: "Moderators must use moveToTrashPost with a reason",
        };
      }
      return { success: false, error: "Forbidden" };
    }

    // Author path: refuse if the content is under moderation.
    if (post.trashedAt) {
      return { success: false, error: "Content is under moderation" };
    }
    if (post.deletedAt) {
      return { success: false, error: "Post already deleted" };
    }

    await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidateBlogPaths(post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── createCategory ──────────────────────────────────────────────────────────

export async function createCategory(
  input: CreateCategoryInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await requireAuthUser();
    const data = createCategorySchema.parse(input);

    const flags = await getActiveSanctionFlags(user.id);
    if (flags.banned) return { success: false, error: "You are banned from creating content" };

    const existingByName = await prisma.category.findUnique({ where: { name: data.name } });
    if (existingByName) return { success: false, error: "Category name already exists" };

    const baseSlug = data.slug ?? slugify(data.name);
    if (!baseSlug) return { success: false, error: "Could not derive a valid slug from the name" };
    const slug = await ensureUniqueCategorySlug(baseSlug);

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
        createdById: user.id,
      },
      select: { id: true, slug: true },
    });

    revalidateBlogPaths();
    return { success: true, data: category };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── deleteCategory ──────────────────────────────────────────────────────────
//
// Soft-delete a category by routing through the moderation trash, mirroring
// the post/comment flows (spec: "quand une catégorie est supprimé elle soit
// déplacé dans la corbeille").
//
//   - Creator of the category: soft-delete (deletedAt = now()). Refused if the
//                               category already lives in moderation trash.
//   - MODERATOR+:               must call moveToTrashCategory() from
//                               `lib/actions/trash.ts` (needs a reason).
//   - Anyone else:              Forbidden.
//
// Categories with published posts cannot be deleted — those posts would lose
// their required category relation.

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    if (!id || typeof id !== "string") return { success: false, error: "Invalid id" };
    const user = await requireAuthUser();

    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        trashedAt: true,
        deletedAt: true,
        _count: {
          select: {
            posts: { where: { trashedAt: null, deletedAt: null } },
          },
        },
      },
    });
    if (!category) return { success: false, error: "Category not found" };

    const isCreator = !!category.createdById && category.createdById === user.id;

    if (!isCreator) {
      if (isModerator(user.role)) {
        return {
          success: false,
          error: "Moderators must use moveToTrashCategory with a reason",
        };
      }
      return { success: false, error: "Forbidden" };
    }

    if (category.trashedAt) {
      return { success: false, error: "Content is under moderation" };
    }
    if (category.deletedAt) {
      return { success: false, error: "Category already deleted" };
    }
    if (category._count.posts > 0) {
      return { success: false, error: "Cannot delete a category that has posts" };
    }

    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidateBlogPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── createComment ───────────────────────────────────────────────────────────

export async function createComment(
  input: CreateCommentInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuthUser();
    const data = createCommentSchema.parse(input);

    const flags = await getActiveSanctionFlags(user.id);
    if (flags.banned) return { success: false, error: "You are banned from commenting" };
    if (flags.muted) return { success: false, error: "You are muted and cannot comment" };

    const post = await prisma.post.findUnique({
      where: { id: data.postId },
      select: { id: true, slug: true, published: true },
    });
    if (!post) return { success: false, error: "Post not found" };
    if (!post.published) return { success: false, error: "Cannot comment on an unpublished post" };

    if (data.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: data.parentId },
        select: { postId: true },
      });
      if (!parent) return { success: false, error: "Parent comment not found" };
      if (parent.postId !== post.id) {
        return { success: false, error: "Parent comment belongs to a different post" };
      }
    }

    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        authorId: user.id,
        content: data.content,
        parentId: data.parentId ?? null,
      },
      select: { id: true },
    });

    revalidateBlogPaths(post.slug);
    return { success: true, data: comment };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── deleteComment ───────────────────────────────────────────────────────────
//
// Behaviour per trash spec §4.6:
//   - Author: soft-delete via deletedAt. Refused if the comment is already
//             TRASHED by moderation.
//   - MODERATOR+: must call moveToTrashComment() from `lib/actions/trash.ts`.
//   - Anyone else: Forbidden.

export async function deleteComment(id: string): Promise<ActionResult> {
  try {
    if (!id || typeof id !== "string") return { success: false, error: "Invalid id" };
    const user = await requireAuthUser();

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
        trashedAt: true,
        post: { select: { slug: true } },
      },
    });
    if (!comment) return { success: false, error: "Comment not found" };

    const isAuthor = comment.authorId === user.id;

    if (!isAuthor) {
      if (isModerator(user.role)) {
        return {
          success: false,
          error: "Moderators must use moveToTrashComment with a reason",
        };
      }
      return { success: false, error: "Forbidden" };
    }

    // Author path.
    if (comment.trashedAt) {
      return { success: false, error: "Content is under moderation" };
    }
    if (comment.deletedAt) {
      return { success: false, error: "Comment already deleted" };
    }

    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidateBlogPaths(comment.post.slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}
