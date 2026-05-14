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

type ActionResult<T = undefined> =
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

async function requireModerator(): Promise<AuthedUser> {
  const user = await requireAuthUser();
  if (!MODERATOR_ROLES.includes(user.role as (typeof MODERATOR_ROLES)[number])) {
    throw new Error("Forbidden");
  }
  return user;
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
      select: { slug: true },
    });
    if (!category) return { success: false, error: "Category not found" };

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

export async function deletePost(id: string): Promise<ActionResult> {
  try {
    if (!id || typeof id !== "string") return { success: false, error: "Invalid id" };
    const user = await requireAuthUser();

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, slug: true, authorId: true },
    });
    if (!post) return { success: false, error: "Post not found" };

    const isAuthor = post.authorId === user.id;
    if (!isAuthor && !isModerator(user.role)) {
      return { success: false, error: "Forbidden" };
    }

    await prisma.post.delete({ where: { id } });
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

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    if (!id || typeof id !== "string") return { success: false, error: "Invalid id" };
    await requireModerator();

    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { posts: true } } },
    });
    if (!category) return { success: false, error: "Category not found" };
    if (category._count.posts > 0) {
      return { success: false, error: "Cannot delete a category that has posts" };
    }

    await prisma.category.delete({ where: { id } });
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
        post: { select: { slug: true } },
      },
    });
    if (!comment) return { success: false, error: "Comment not found" };
    if (comment.deletedAt) return { success: false, error: "Comment already deleted" };

    const isAuthor = comment.authorId === user.id;
    const moderator = isModerator(user.role);
    if (!isAuthor && !moderator) {
      return { success: false, error: "Forbidden" };
    }

    // Soft-delete in both cases (Comment model has only deletedAt — no admin trace field).
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
