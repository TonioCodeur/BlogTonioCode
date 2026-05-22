import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUsers } from "@/lib/actions/admin";
import { AdminUserTable } from "@/components/admin-user-table";

const ALLOWED_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export default async function AdminPage() {
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
    !ALLOWED_ROLES.includes(
      currentUser.role as (typeof ALLOWED_ROLES)[number],
    )
  ) {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <AdminUserTable
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
        currentUserRole={currentUser.role}
      />
    </div>
  );
}
