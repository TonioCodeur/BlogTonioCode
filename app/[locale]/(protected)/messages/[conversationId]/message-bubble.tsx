"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n, useCurrentLocale } from "@/locales/client";
import { deleteMyMessage } from "@/lib/actions/messaging";
import type { MessageData } from "@/lib/messaging-types";
import { toast } from "sonner";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(input: string | Date, locale: string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

type Props = {
  message: MessageData;
  currentUserId: string;
  onDeleted?: (messageId: string) => void;
};

export function MessageBubble({ message, currentUserId, onDeleted }: Props) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const [deleting, setDeleting] = useState(false);

  const isMine = message.authorId === currentUserId;
  const isDeletedByAdmin = !!message.deletedByAdminId;
  const isDeleted = message.deletedAt !== null && message.deletedAt !== undefined;

  const author = message.author;
  const authorName = author?.name ?? author?.email ?? t("messages.thread.unknownUser");

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteMyMessage({ messageId: message.id });
      if (result.ok) {
        onDeleted?.(message.id);
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("messages.errors.generic"));
    } finally {
      setDeleting(false);
    }
  }

  let content: React.ReactNode;
  if (isDeletedByAdmin) {
    content = (
      <span className="italic text-muted-foreground">{t("messages.thread.deletedByAdmin")}</span>
    );
  } else if (isDeleted) {
    content = <span className="italic text-muted-foreground">{t("messages.thread.deleted")}</span>;
  } else {
    content = <span className="whitespace-pre-wrap break-words">{message.content}</span>;
  }

  return (
    <div
      className={
        "flex gap-2 " + (isMine ? "flex-row-reverse" : "flex-row")
      }
      data-author={isMine ? "self" : "other"}
    >
      <Avatar size="sm" className="mt-1">
        <AvatarImage src={author?.image ?? undefined} alt={authorName} />
        <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
      </Avatar>
      <div className={"flex max-w-[75%] flex-col " + (isMine ? "items-end" : "items-start")}>
        <div
          className={
            "group relative rounded-2xl px-3 py-2 text-sm " +
            (isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground")
          }
        >
          {content}
          {isMine && !isDeleted && !isDeletedByAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute -left-9 top-1/2 h-7 w-7 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t("messages.actions.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("messages.actions.deleteConfirm")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("messages.actions.deleteDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    {t("messages.actions.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("messages.actions.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <span className="mt-0.5 px-1 text-xs text-muted-foreground">
          {formatTime(message.createdAt, locale)}
        </span>
      </div>
    </div>
  );
}
