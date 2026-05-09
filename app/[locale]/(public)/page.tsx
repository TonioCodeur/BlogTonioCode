import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Calendar, FolderOpen, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ArticleCard } from "@/components/blog/article-card";
import { CategoryCard } from "@/components/blog/category-card";

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export default async function HomePage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserRole = (session?.user
    ? ((session.user as { role?: string }).role as Role | undefined) ?? null
    : null) as Role | null;

  const [articles, categories, articlesCount, authorsCount, commentsCount] = await Promise.all([
    prisma.article
      .findMany({
        where: { published: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 7,
        include: {
          author: { select: { name: true, image: true } },
          category: { select: { name: true, slug: true, color: true } },
        },
      })
      .catch(() => []),
    prisma.category
      .findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { articles: true } } },
      })
      .catch(() => []),
    prisma.article.count({ where: { published: true } }).catch(() => 0),
    prisma.user.count({ where: { articles: { some: { published: true } } } }).catch(() => 0),
    prisma.comment.count({ where: { deletedAt: null } }).catch(() => 0),
  ]);

  const featured = articles[0];
  const rest = articles.slice(1, 7);

  return (
    <div className="relative overflow-hidden bg-dots glow-halo">
      {/* Hero */}
      <section className="container mx-auto grid gap-7 px-6 py-12 sm:py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-10 lg:px-10">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="hud-tag hud-tag-accent">
              <span className="hud-tag-dot" />
              {t("blog.hero.badge")}
            </span>
            {featured?.category ? (
              <span className="hud-tag hud-tag-accent-2">
                {featured.category.name.toUpperCase()}
              </span>
            ) : null}
          </div>

          <h1 className="font-display text-5xl font-bold leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {t("blog.hero.title").split("&")[0].trim()}
            <br />
            <span className="grad-text">
              {t("blog.hero.title").includes("&")
                ? `& ${t("blog.hero.title").split("&")[1].trim()}`
                : t("blog.hero.title")}
            </span>
          </h1>

          <p className="mt-6 max-w-[580px] text-lg leading-relaxed text-muted-foreground">
            {t("blog.hero.description")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="btn-glow rounded-full px-6">
              <Link href="/blog">
                {t("blog.hero.ctaArticles")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/categories">
                <FolderOpen className="mr-2 h-4 w-4" />
                {t("blog.hero.ctaCategories")}
              </Link>
            </Button>
          </div>
        </div>

        {/* Live stats card */}
        <div
          className="relative overflow-hidden rounded-xl border p-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(var(--accent-rgb) / 0.10), rgba(var(--accent-rgb-2) / 0.06))",
            borderColor: "rgba(var(--accent-rgb) / 0.25)",
          }}
        >
          <div
            className="glow-blob"
            style={{ background: "rgb(var(--accent-rgb))", top: -120, right: -120 }}
          />
          <div
            className="glow-blob"
            style={{
              background: "rgb(var(--accent-rgb-2))",
              bottom: -160,
              left: -100,
              opacity: "calc(0.5 * var(--glow))",
            }}
          />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              <span className="pulse-dot" />
              {t("blog.stats.live")}
            </div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-display text-6xl font-bold leading-none tracking-[-0.04em]">
                {articlesCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                <TrendingUp className="h-3 w-3" />
                {t("blog.stats.thisMonth")}
              </span>
            </div>
            <div className="mb-6 text-sm text-muted-foreground">
              {t("blog.stats.publishedArticles")}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                [t("blog.stats.authors"), authorsCount.toLocaleString()],
                [t("blog.stats.categories"), categories.length.toLocaleString()],
                [t("blog.stats.comments"), commentsCount.toLocaleString()],
                [t("blog.stats.members"), "—"],
              ].map(([label, value]) => (
                <div key={label} className="border-t border-border/60 py-2.5">
                  <div className="text-lg font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Category pills */}
      {categories.length > 0 ? (
        <section className="container mx-auto flex flex-wrap items-center gap-2 px-6 pb-6 lg:px-10">
          <span className="mr-2 text-[11.5px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
            {t("blog.browse")}
          </span>
          <Link
            href="/blog"
            className="rounded-full border px-3 py-1 text-xs font-mono"
            style={{
              background:
                "linear-gradient(135deg, rgba(var(--accent-rgb) / 0.2), rgba(var(--accent-rgb-2) / 0.2))",
              borderColor: "rgba(var(--accent-rgb) / 0.5)",
            }}
          >
            all
          </Link>
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-mono text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {category.name.toLowerCase()}
            </Link>
          ))}
        </section>
      ) : null}

      {/* Latest articles */}
      <section className="container mx-auto px-6 py-12 lg:px-10">
        <div className="mb-8 flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            {t("blog.latest.title")}
          </h2>
          <span className="text-sm text-muted-foreground/70">· {t("blog.latest.subtitle")}</span>
          <span className="flex-1" />
          <Link
            href="/blog"
            className="text-sm text-primary transition-opacity hover:opacity-80"
          >
            {t("blog.latest.viewAll")} →
          </Link>
        </div>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t("blog.empty.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("blog.empty.description")}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {/* Categories section */}
      {categories.length > 0 ? (
        <section className="container mx-auto border-t border-border/40 px-6 py-12 lg:px-10">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">
              {t("blog.categories.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("blog.categories.subtitle")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} currentUserRole={currentUserRole} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 md:flex-row lg:px-10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">
              Blog<span className="grad-text">Tonio</span>Code
            </span>
            <span className="hud-tag">
              <Sparkles className="h-3 w-3" />
              v0.1
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="#" className="text-muted-foreground hover:text-foreground">
              {t("footer.privacy")}
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
