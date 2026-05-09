import Link from "next/link";
import { ArrowRight, Calendar, FolderOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { prisma } from "@/lib/prisma";
import { ArticleCard } from "@/components/blog/article-card";
import { CategoryCard } from "@/components/blog/category-card";

export default async function HomePage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  // Fetch the 6 most recent published articles + all categories.
  // The DB may be empty during dev — both queries fall back to empty arrays.
  const [articles, categories] = await Promise.all([
    prisma.article
      .findMany({
        where: { published: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 6,
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
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5">
              <Sparkles className="mr-1 h-3 w-3" />
              {t("blog.hero.badge")}
            </Badge>
            <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("blog.hero.title")}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              {t("blog.hero.description")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/blog">
                  {t("blog.hero.ctaArticles")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/categories">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("blog.hero.ctaCategories")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Latest articles */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
                {t("blog.latest.title")}
              </h2>
              <p className="mt-2 text-muted-foreground">{t("blog.latest.subtitle")}</p>
            </div>
            <Button variant="ghost" asChild className="self-start sm:self-end">
              <Link href="/blog">
                {t("blog.latest.viewAll")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {articles.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{t("blog.empty.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("blog.empty.description")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="border-t bg-muted/30 py-16 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="mb-10">
              <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
                {t("blog.categories.title")}
              </h2>
              <p className="mt-2 text-muted-foreground">{t("blog.categories.subtitle")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">
                Blog<span className="text-primary">Tonio</span>Code
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
        </div>
      </footer>
    </div>
  );
}
