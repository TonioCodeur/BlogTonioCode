import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import { Button } from "@/components/ui/button";

import { listBots } from "@/lib/actions/bots";
import { BotsTable } from "./bots-table";

export default async function AdminBotsPage() {
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
  const result = await listBots();
  const bots = result.ok ? result.bots : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.bots.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.bots.description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/bots/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t("admin.bots.create")}
          </Link>
        </Button>
      </div>

      <BotsTable bots={bots} />
    </div>
  );
}
