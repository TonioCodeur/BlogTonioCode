import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { ArticleCard } from "@/components/blog/article-card";
import { Calendar } from "lucide-react";

export default async function BlogIndexPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const articles = await prisma.article
    .findMany({
      where: { published: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
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

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("blog.empty.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("blog.empty.description")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
