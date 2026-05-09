import { z } from "zod";

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers and hyphens");

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff00aa)");

export const createArticleSchema = z.object({
  title: z.string().min(3).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10).max(50000),
  coverImage: z.string().url().optional(),
  categorySlug: slugSchema,
  published: z.boolean().default(false),
});

export const createCategorySchema = z.object({
  name: z.string().min(2).max(60),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
  color: colorSchema.optional(),
});

export const createCommentSchema = z.object({
  articleId: z.string().min(1),
  content: z.string().min(1).max(5000),
  parentId: z.string().min(1).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
