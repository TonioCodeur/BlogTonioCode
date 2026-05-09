import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ArticleDeleteButton } from "@/components/blog/article-delete-button";
import {
  CommentsSection,
  type CommentNode,
  type CommentRole,
} from "@/components/blog/comments-section";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";

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
  authorId: string | null;
  parentId: string | null;
  author: { id: string; name: string; image: string | null } | null;
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

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  const article = await prisma.article
    .findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
      },
    })
    .catch(() => null);

  if (!article || !article.published) {
    notFound();
  }

  const rawComments: RawComment[] = await prisma.comment
    .findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        deletedAt: true,
        authorId: true,
        parentId: true,
        author: { select: { id: true, name: true, image: true } },
      },
    })
    .catch(() => []);

  const comments = buildCommentTree(rawComments);

  const publishedDate = article.publishedAt ?? article.createdAt;
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = (session?.user
    ? ((session.user as { role?: string }).role as CommentRole | undefined) ??
      null
    : null) as CommentRole | null;

  const isAuthor = !!currentUserId && currentUserId === article.authorId;
  const isMod = !!currentUserRole && MODERATOR_ROLES.includes(currentUserRole);
  const canDeleteArticle = isAuthor || isMod;

  return (
    <article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("blog.article.backToList")}
          </Link>
        </Button>
        {canDeleteArticle ? (
          <ArticleDeleteButton articleId={article.id} />
        ) : null}
      </div>

      <header className="mb-8">
        <Link href={`/categories/${article.category.slug}`} className="inline-block">
          <Badge
            variant="secondary"
            className="mb-4"
            style={
              article.category.color
                ? { backgroundColor: `${article.category.color}20`, color: article.category.color }
                : undefined
            }
          >
            {article.category.name}
          </Badge>
        </Link>

        <h1 className="font-mono text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {article.title}
        </h1>

        {article.excerpt ? (
          <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-b py-4 text-sm text-muted-foreground">
          {article.author?.name ? (
            <span>
              <span className="text-muted-foreground">{t("blog.article.by")} </span>
              <span className="font-medium text-foreground">{article.author.name}</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(publishedDate, locale)}
          </span>
        </div>
      </header>

      {article.coverImage ? (
        <div className="relative mb-8 aspect-video overflow-hidden rounded-xl border bg-muted">
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      ) : null}

      <MarkdownRenderer>{article.content}</MarkdownRenderer>

      <CommentsSection
        articleId={article.id}
        comments={comments}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        locale={locale}
      />
    </article>
  );
}
