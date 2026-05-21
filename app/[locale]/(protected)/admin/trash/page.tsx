import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTrashedPosts, listTrashedComments } from "@/lib/actions/trash";
import { getCurrentLocale } from "@/locales/server";
import {
  TrashTables,
  type TrashRole,
  type TrashedPostRow,
  type TrashedCommentRow,
} from "@/app/[locale]/(protected)/admin/trash/trash-tables";

const TRASH_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export default async function AdminTrashPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (
    !currentUser ||
    !TRASH_ROLES.includes(currentUser.role as (typeof TRASH_ROLES)[number])
  ) {
    redirect("/dashboard");
  }

  const role = currentUser.role as TrashRole;
  const locale = await getCurrentLocale();

  // Server actions return ActionResult — degrade gracefully to empty lists.
  const [postsResult, commentsResult] = await Promise.all([
    listTrashedPosts({ pageSize: 100 }),
    listTrashedComments({ pageSize: 100 }),
  ]);

  const posts: TrashedPostRow[] = postsResult.success
    ? postsResult.data?.items ?? []
    : [];
  const comments: TrashedCommentRow[] = commentsResult.success
    ? commentsResult.data?.items ?? []
    : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <TrashTables
        posts={posts}
        comments={comments}
        currentUserRole={role}
        locale={locale}
      />
    </div>
  );
}
