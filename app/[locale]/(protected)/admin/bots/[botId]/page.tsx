import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import { Button } from "@/components/ui/button";

import { getBot } from "@/lib/actions/bots";
import { BotForm } from "../bot-form";
import { BotAutoMessagesSection } from "../bot-auto-messages-section";
import { BotSendMessageSection } from "./send-message-section";

type PageProps = {
  params: Promise<{ locale: string; botId: string }>;
};

export default async function BotDetailPage({ params }: PageProps) {
  const { botId } = await params;

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

  const result = await getBot({ id: botId });
  if (!result.ok || !result.bot) {
    notFound();
  }
  const bot = result.bot;

  const t = await getI18n();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/bots">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            {t("admin.bots.title")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{t("admin.bots.detail.title")}</h1>
        <p className="text-sm text-muted-foreground">{bot.email}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">
          {t("admin.bots.detail.infoSection")}
        </h2>
        <BotForm mode="update" bot={bot} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">
          {t("admin.bots.detail.messagesSection")}
        </h2>
        <BotAutoMessagesSection botId={bot.id} messages={bot.autoMessages} />
      </section>

      <section className="space-y-4">
        <BotSendMessageSection botId={bot.id} botActive={bot.isBotActive} />
      </section>
    </div>
  );
}
