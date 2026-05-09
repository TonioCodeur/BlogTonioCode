import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getI18n } from "@/locales/server";
import {
  getConversation,
  markConversationRead,
  getMyMuteInfo,
} from "@/lib/actions/messaging";
import type { ConversationDetail, MuteInfo } from "@/lib/messaging-types";
import { MessageList } from "./message-list";
import { MessageComposer } from "./message-composer";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; conversationId: string }>;
}) {
  const { conversationId } = await params;
  const t = await getI18n();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin");
  }

  // Mark the conversation as read (fire-and-forget style; ignore failure)
  try {
    await markConversationRead({ conversationId });
  } catch {
    // Non-blocking
  }

  let conversation: ConversationDetail | null = null;
  try {
    const result = await getConversation({ conversationId });
    conversation = result;
  } catch {
    notFound();
  }

  if (!conversation) {
    notFound();
  }

  const muteInfo: MuteInfo = await getMyMuteInfo().catch(() => ({
    isMuted: false,
    isBanned: false,
    mutedUntil: null,
  }));

  const other = conversation.otherUser;
  const displayName = other?.name ?? other?.email ?? t("messages.thread.unknownUser");

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-3 border-b p-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("messages.thread.back")}>
          <Link href="/messages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar size="default">
          <AvatarImage src={other?.image ?? undefined} alt={displayName} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate font-medium">{displayName}</div>
          {other?.email && (
            <div className="truncate text-xs text-muted-foreground">{other.email}</div>
          )}
        </div>
      </div>

      <MessageList
        conversationId={conversation.id}
        currentUserId={session.user.id}
        initialMessages={conversation.messages}
        initialHasMore={conversation.hasMore}
      />

      <MessageComposer conversationId={conversation.id} muteInfo={muteInfo} />
    </div>
  );
}
