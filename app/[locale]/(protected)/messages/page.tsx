import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquarePlus, Inbox } from "lucide-react";
import { getI18n } from "@/locales/server";
import { listConversations } from "@/lib/actions/messaging";
import { ConversationItem } from "./conversation-item";
import type { ConversationListItemData } from "@/lib/messaging-types";

export default async function MessagesInboxPage() {
  const t = await getI18n();
  const conversations: ConversationListItemData[] = await listConversations();

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("messages.inbox.title")}</h1>
            <p className="text-muted-foreground">{t("messages.inbox.subtitle")}</p>
          </div>
          <Button asChild>
            <Link href="/messages/new" aria-label={t("messages.inbox.newChat")}>
              <MessageSquarePlus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("messages.inbox.newChat")}</span>
            </Link>
          </Button>
        </div>

        {conversations.length === 0 ? (
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>{t("messages.inbox.empty.title")}</CardTitle>
              <CardDescription>{t("messages.inbox.empty.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/messages/new">
                  <MessageSquarePlus className="h-4 w-4" />
                  {t("messages.inbox.empty.cta")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={t("messages.inbox.title")}>
            {conversations.map((c) => (
              <li key={c.id}>
                <ConversationItem conversation={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
