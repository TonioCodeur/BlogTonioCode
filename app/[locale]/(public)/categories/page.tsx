import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getI18n } from "@/locales/server";
import { CategoryCard } from "@/components/blog/category-card";

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export default async function CategoriesIndexPage() {
  const t = await getI18n();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserRole = (session?.user
    ? ((session.user as { role?: string }).role as Role | undefined) ?? null
    : null) as Role | null;

  const categories = await prisma.category
    .findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    })
    .catch(() => []);

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
          {t("blog.categories.title")}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("blog.categories.subtitle")}</p>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          {t("blog.empty.description")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
