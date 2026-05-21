import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { PostDeleteButton } from "@/components/blog/post-delete-button";
import { MoveToTrashDialog } from "@/components/blog/move-to-trash-dialog";
import { LikeButton } from "@/components/blog/like-button";
import {
  CommentsSection,
  type CommentNode,
  type CommentRole,
} from "@/components/blog/comments-section";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";
import {
  withCommentLikeMeta,
  withPostLikeMeta,
} from "@/lib/blog/likes-include";

type PageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

const MODERATOR_ROLES: ReadonlyArray<CommentRole> = [
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
];

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

type RawComment = {
  id: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  trashedAt: Date | null;
  authorId: string | null;
  parentId: string | null;
  author: { id: string; name: string; image: string | null } | null;
  likeCount: number;
  likedByMe: boolean;
};

function buildCommentTree(rows: RawComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] });
  }
  for (const row of rows) {
    const node = map.get(row.id);
    if (!node) continue;
    if (row.parentId) {
      const parent = map.get(row.parentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserId = session?.user?.id ?? null;

  const post = await prisma.post
    .findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
        ...withPostLikeMeta(currentUserId),
      },
    })
    .catch(() => null);

  // Hide moderated or author-deleted posts from the public site (404).
  if (!post || !post.published || post.trashedAt || post.deletedAt) {
    notFound();
  }

  // Likes-aware comment fetch. `_count.likes` is always included; `likes` is
  // a 0/1-length array filtered to the current user (only when signed in).
  // The combination is needed even for trashed/deleted comments since the
  // moderation tree is rebuilt in JS afterwards; the count for hidden rows
  // is dropped at the mapping step below (spec §A.2.3).
  const rawCommentsRows = await prisma.comment
    .findMany({
      where: { postId: post.id },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
        ...withCommentLikeMeta(currentUserId),
      },
    })
    .catch(
      () =>
        [] as Array<{
          id: string;
          content: string;
          createdAt: Date;
          deletedAt: Date | null;
          trashedAt: Date | null;
          authorId: string | null;
          parentId: string | null;
          author: { id: string; name: string; image: string | null } | null;
          _count: { likes: number };
          likes?: Array<{ id: string }>;
        }>,
    );

  // Never expose the original content of moderated/author-deleted comments to
  // the public — the front renders them as tombstones. We still keep them in
  // the tree to preserve reply structure (spec §2.3). Likes counts are also
  // hidden for those rows (spec §A.2.3).
  const rawComments: RawComment[] = rawCommentsRows.map((c) => {
    const hidden = !!(c.trashedAt || c.deletedAt);
    return {
      id: c.id,
      content: hidden ? "" : c.content,
      createdAt: c.createdAt,
      deletedAt: c.deletedAt,
      trashedAt: c.trashedAt,
      authorId: c.authorId,
      parentId: c.parentId,
      author: hidden ? null : c.author,
      likeCount: hidden ? 0 : c._count.likes,
      likedByMe: hidden ? false : (c.likes?.length ?? 0) > 0,
    };
  });

  const comments = buildCommentTree(rawComments);

  const publishedDate = post.publishedAt ?? post.createdAt;
  const currentUserRole = (session?.user
    ? ((session.user as { role?: string }).role as CommentRole | undefined) ??
      null
    : null) as CommentRole | null;
  const currentUserEmailVerified = !!(session?.user as
    | { emailVerified?: boolean }
    | undefined)?.emailVerified;

  // `_count.likes` is always populated by `withPostLikeMeta`; `likes` is only
  // included when the visitor is signed in (0/1-length array filtered by user).
  const postLikeCount = post._count.likes;
  const postLikedByMe = (post.likes?.length ?? 0) > 0;

  const isAuthor = !!currentUserId && currentUserId === post.authorId;
  const isMod = !!currentUserRole && MODERATOR_ROLES.includes(currentUserRole);
  // Author can soft-delete their own post. Moderators have a separate
  // "move to trash" flow (with reason) — they no longer use the plain delete.
  const canAuthorDelete = isAuthor;

  return (
    <article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("blog.post.backToList")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {canAuthorDelete ? (
            <PostDeleteButton
              postId={post.id}
              underModeration={!!post.trashedAt}
            />
          ) : null}
          {isMod ? (
            <MoveToTrashDialog target={{ kind: "post", postId: post.id }} />
          ) : null}
        </div>
      </div>

      <header className="mb-8">
        <Link href={`/categories/${post.category.slug}`} className="inline-block">
          <Badge
            variant="secondary"
            className="mb-4"
            style={
              post.category.color
                ? { backgroundColor: `${post.category.color}20`, color: post.category.color }
                : undefined
            }
          >
            {post.category.name}
          </Badge>
        </Link>

        <h1 className="font-mono text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {post.title}
        </h1>

        {post.excerpt ? (
          <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-b py-4 text-sm text-muted-foreground">
          {post.author?.name ? (
            <span>
              <span className="text-muted-foreground">{t("blog.post.by")} </span>
              <span className="font-medium text-foreground">{post.author.name}</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(publishedDate, locale)}
          </span>
          <span className="flex-1" />
          <LikeButton
            targetType="post"
            targetId={post.id}
            postSlug={post.slug}
            initialCount={postLikeCount}
            initialLiked={postLikedByMe}
            isAuthenticated={!!currentUserId}
            requiresEmailVerification={!!currentUserId && !currentUserEmailVerified}
            size="md"
          />
        </div>
      </header>

      {post.coverImage ? (
        <div className="relative mb-8 aspect-video overflow-hidden rounded-xl border bg-muted">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      ) : null}

      <MarkdownRenderer>{post.content}</MarkdownRenderer>

      <CommentsSection
        postId={post.id}
        comments={comments}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        currentUserEmailVerified={currentUserEmailVerified}
        locale={locale}
      />
    </article>
  );
}
