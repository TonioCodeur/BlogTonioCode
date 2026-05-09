import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import { Badge } from "@/components/ui/badge";
import { adminListConversations } from "@/lib/actions/messaging";
import type { AdminConversationListItem } from "@/lib/messaging-types";
import { AdminConversationsTable } from "./admin-conversations-table";

export default async function AdminMessagesPage() {
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
    (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")
  ) {
    redirect("/dashboard");
  }

  const t = await getI18n();
  const conversations: AdminConversationListItem[] = await adminListConversations();

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("messages.admin.title")}</h1>
            <p className="text-muted-foreground">{t("messages.admin.description")}</p>
          </div>
          <Badge variant="outline">{t("messages.admin.readOnly")}</Badge>
        </div>

        <AdminConversationsTable conversations={conversations} />
      </div>
    </div>
  );
}
