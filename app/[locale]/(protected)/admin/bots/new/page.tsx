import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import { Button } from "@/components/ui/button";

import { BotForm } from "../bot-form";

export default async function NewBotPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/bots">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            {t("admin.bots.title")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{t("admin.bots.create")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.bots.description")}
        </p>
      </div>

      <BotForm mode="create" />
    </div>
  );
}
