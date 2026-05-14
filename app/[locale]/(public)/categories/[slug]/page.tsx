import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { PostCard } from "@/components/blog/post-card";

type PageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getI18n();
  const locale = await getCurrentLocale();

  const category = await prisma.category
    .findUnique({
      where: { slug },
      include: {
        posts: {
          where: { published: true },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          include: {
            author: { select: { name: true, image: true } },
            category: { select: { name: true, slug: true, color: true } },
          },
        },
      },
    })
    .catch(() => null);

  if (!category) notFound();

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
