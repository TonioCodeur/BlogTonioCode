import { headers } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { PostCard } from "@/components/blog/post-card";
import { withPostLikeMeta } from "@/lib/blog/likes-include";
import { Calendar } from "lucide-react";
import { getSiteUrl, localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const title = t("meta.blog.title");
  const description = t("meta.blog.description");
  const url = locale === "fr" ? `${getSiteUrl()}/fr/blog` : `${getSiteUrl()}/blog`;

  return {
    title,
    description,
    alternates: localeAlternates("/blog"),
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: t("meta.ogSiteName"),
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlogIndexPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserId = session?.user?.id ?? null;

  const posts = await prisma.post
    .findMany({
      // Exclude posts moderated to trash or soft-deleted by their author.
      where: { published: true, trashedAt: null, deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
        ...withPostLikeMeta(currentUserId),
      },
    })
    .catch(() => []);

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
          {t("blog.latest.title")}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("blog.latest.subtitle")}</p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("blog.empty.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("blog.empty.description")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
