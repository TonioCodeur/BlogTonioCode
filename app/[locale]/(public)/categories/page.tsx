import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { CategoryCard } from "@/components/blog/category-card";
import { Button } from "@/components/ui/button";
import { getSiteUrl, localeAlternates } from "@/lib/seo";

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const title = t("meta.categories.title");
  const description = t("meta.categories.description");
  const url = locale === "fr" ? `${getSiteUrl()}/fr/categories` : `${getSiteUrl()}/categories`;

  return {
    title,
    description,
    alternates: localeAlternates("/categories"),
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

export default async function CategoriesIndexPage() {
  const t = await getI18n();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = (session?.user
    ? ((session.user as { role?: string }).role as Role | undefined) ?? null
    : null) as Role | null;
  const currentUserEmailVerified = !!(session?.user as
    | { emailVerified?: boolean }
    | undefined)?.emailVerified;

  const categories = await prisma.category
    .findMany({
      where: { trashedAt: null, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            // Count only publicly visible posts.
            posts: { where: { trashedAt: null, deletedAt: null, published: true } },
          },
        },
      },
    })
    .catch(() => []);

  const canCreate = !!currentUserId && currentUserEmailVerified;

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
            {t("blog.categories.title")}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">{t("blog.categories.subtitle")}</p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/categories/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("blog.categories.newCategory")}
            </Link>
          </Button>
        ) : null}
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
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
