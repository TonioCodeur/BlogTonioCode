import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import { PostForm } from "@/components/blog/post-form";

export default async function NewPostPage() {
  const t = await getI18n();

  const categories = await prisma.category
    .findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    })
    .catch(() => []);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-mono text-3xl font-bold tracking-tight">
          {t("blog.new.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("blog.new.description")}</p>
      </header>
      <PostForm categories={categories} />
    </div>
  );
}
