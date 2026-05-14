import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";

export default async function DashboardPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/signin");
  }

  const posts = await prisma.post
    .findMany({
      where: { authorId: session.user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        author: { select: { name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
            {t("dashboard.myPosts.title")}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {t("dashboard.myPosts.subtitle", { count: posts.length })}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("dashboard.myPosts.writeCta")}
          </Link>
        </Button>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            {t("dashboard.myPosts.empty.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.myPosts.empty.description")}
          </p>
          <Button asChild className="mt-6">
            <Link href="/blog/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("dashboard.myPosts.empty.cta")}
            </Link>
          </Button>
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
