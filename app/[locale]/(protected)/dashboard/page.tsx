import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { withPostLikeMeta } from "@/lib/blog/likes-include";

export default async function DashboardPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/signin");
  }

  const ownPosts = await prisma.post
    .findMany({
      // Author dashboard: hide content the author themselves soft-deleted
      // (spec §2.4). TRASHED posts remain visible so the UI can list them
      // under a dedicated "Modéré" section.
      where: { authorId: session.user.id, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        author: { select: { name: true, image: true } },
        category: { select: { name: true, slug: true, color: true } },
        ...withPostLikeMeta(session.user.id),
      },
    })
    .catch(() => []);

  const posts = ownPosts.filter((p) => !p.trashedAt);
  const moderatedPosts = ownPosts.filter((p) => !!p.trashedAt);

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

      {moderatedPosts.length > 0 ? (
        <section className="mt-16">
          <header className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <h2 className="font-mono text-2xl font-bold tracking-tight">
              {t("trash.authorView.moderated")}
            </h2>
            <Badge variant="outline" className="ml-1">
              {moderatedPosts.length}
            </Badge>
          </header>
          <ul className="space-y-3">
            {moderatedPosts.map((post) => (
              <li
                key={post.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{post.title}</span>
                  {post.trashReason ? (
                    <span className="text-sm text-muted-foreground">
                      {t("trash.authorView.moderatedReason", {
                        reason: post.trashReason,
                      })}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
