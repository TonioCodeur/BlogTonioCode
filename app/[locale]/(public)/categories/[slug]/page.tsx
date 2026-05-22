import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { PostCard } from "@/components/blog/post-card";
import { withPostLikeMeta } from "@/lib/blog/likes-include";
import { getSiteUrl, localeAlternates } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category
    .findUnique({
      where: { slug },
      select: { name: true, description: true, trashedAt: true, deletedAt: true },
    })
    .catch(() => null);

  const t = await getI18n();
  const locale = await getCurrentLocale();
  const siteName = t("meta.ogSiteName");

  if (!category || category.trashedAt || category.deletedAt) {
    return {
      title: t("blog.post.notFound.title"),
      robots: { index: false, follow: false },
    };
  }

  const title = t("meta.category.titleTemplate", { name: category.name, site: siteName });
  const description =
    category.description?.trim() ||
    t("meta.category.descriptionTemplate", { name: category.name });
  const path = `/categories/${slug}`;
  const url = locale === "fr" ? `${getSiteUrl()}/fr${path}` : `${getSiteUrl()}${path}`;

  return {
    title,
    description,
    alternates: localeAlternates(path),
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName,
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserId = session?.user?.id ?? null;

  const category = await prisma.category
    .findUnique({
      where: { slug },
      include: {
        posts: {
          // Exclude posts moderated to trash or soft-deleted by their author.
          where: { published: true, trashedAt: null, deletedAt: null },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          include: {
            author: { select: { name: true, image: true } },
            category: { select: { name: true, slug: true, color: true } },
            ...withPostLikeMeta(currentUserId),
          },
        },
      },
    })
    .catch(() => null);

  if (!category || category.trashedAt || category.deletedAt) notFound();

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-3 text-lg text-muted-foreground">{category.description}</p>
        ) : null}
      </header>

      {category.posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          {t("blog.empty.description")}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {category.posts.map((post) => (
            <PostCard
              key={post.id}
              post={{ ...post, category: category }}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
