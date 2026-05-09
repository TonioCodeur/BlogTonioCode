"use client";

import Link from "next/link";
import { MailWarning } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useI18n, useCurrentLocale } from "@/locales/client";
import { formatRelativeTime, truncate } from "@/lib/format-relative";
import type { ConversationListItemData } from "@/lib/messaging-types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Props = {
  conversation: ConversationListItemData;
};

export function ConversationItem({ conversation }: Props) {
  const t = useI18n();
  const locale = useCurrentLocale();

  const other = conversation.otherUser;
  const displayName = other?.name ?? other?.email ?? t("messages.thread.unknownUser");

  const lastMessage = conversation.lastMessage;
  const isDeleted = lastMessage?.deletedAt !== null && lastMessage?.deletedAt !== undefined;
  const isDeletedByAdmin = !!lastMessage?.deletedByAdminId;

  let preview: string;
  if (!lastMessage) {
    preview = t("messages.thread.empty");
  } else if (isDeletedByAdmin) {
    preview = t("messages.thread.deletedByAdmin");
  } else if (isDeleted) {
    preview = t("messages.thread.deleted");
  } else {
    preview = truncate(lastMessage.content, 80);
  }

  const timestamp = conversation.lastMessageAt ?? lastMessage?.createdAt ?? null;
  const hasUnread = conversation.unreadCount > 0;
  const isUnseen = !conversation.hasViewed && !!lastMessage;
  const showIndicator = hasUnread || isUnseen;
  const indicatorLabel = hasUnread
    ? t("messages.inbox.unreadBadge", { count: conversation.unreadCount })
    : t("messages.inbox.unseen");

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${t("messages.inbox.title")}: ${displayName}`}
    >
      <div className="relative">
        <Avatar size="lg">
          <AvatarImage src={other?.image ?? undefined} alt={displayName} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
        {showIndicator && (
          <span
            aria-label={indicatorLabel}
            className="absolute -right-0.5 -top-0.5 block h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span
            className={
              "flex min-w-0 items-center gap-1.5 truncate " +
              (showIndicator ? "font-semibold" : "font-medium")
            }
          >
            {showIndicator && (
              <MailWarning
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{displayName}</span>
          </span>
          {timestamp && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(timestamp, locale)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={
              "truncate text-sm " +
              (isDeleted
                ? "italic text-muted-foreground"
                : showIndicator
                  ? "font-medium text-foreground"
                  : "text-muted-foreground")
            }
          >
            {preview}
          </span>
          {hasUnread && (
            <Badge className="shrink-0" aria-label={t("messages.inbox.unreadBadge", { count: conversation.unreadCount })}>
              {conversation.unreadCount > 9 ? t("messages.badge.ninePlus") : conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
