"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useI18n, useCurrentLocale } from "@/locales/client";
import { adminDeleteMessage } from "@/lib/actions/messaging";
import type { AdminConversationListItem } from "@/lib/messaging-types";
import { formatRelativeTime, truncate } from "@/lib/format-relative";
import { toast } from "sonner";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Props = {
  conversations: AdminConversationListItem[];
};

export function AdminConversationsTable({ conversations }: Props) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<AdminConversationListItem | null>(null);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget?.lastMessage) return;
    setDeleting(true);
    try {
      const result = await adminDeleteMessage({
        messageId: deleteTarget.lastMessage.id,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        toast.success(t("messages.admin.deleteSuccess"));
        setDeleteTarget(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("messages.errors.generic"));
    } finally {
      setDeleting(false);
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        {t("messages.admin.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("messages.admin.participants")}</TableHead>
              <TableHead>{t("messages.admin.lastMessage")}</TableHead>
              <TableHead className="text-center">{t("messages.admin.messages")}</TableHead>
              <TableHead className="text-right">{t("admin.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((c) => {
              const preview = c.lastMessage?.deletedAt
                ? t("messages.thread.deleted")
                : c.lastMessage
                ? truncate(c.lastMessage.content, 80)
                : t("messages.thread.empty");
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AvatarGroup>
                        {c.participants.slice(0, 2).map((p) => {
                          const name = p.name ?? p.email;
                          return (
                            <Avatar key={p.id} size="sm">
                              <AvatarImage src={p.image ?? undefined} alt={name} />
                              <AvatarFallback>{getInitials(name)}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                      </AvatarGroup>
                      <div className="flex flex-col text-sm">
                        {c.participants.map((p) => (
                          <span key={p.id} className="truncate">
                            {p.name ?? p.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <div className="truncate text-sm">{preview}</div>
                    {c.lastMessageAt && (
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(c.lastMessageAt, locale)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{c.messageCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.lastMessage && !c.lastMessage.deletedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(c)}
                        className="text-destructive hover:text-destructive"
                        aria-label={t("messages.admin.deleteTitle")}
                        title={t("messages.admin.deleteTitle")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("messages.admin.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("messages.admin.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="admin-delete-reason" className="text-sm font-medium">
              {t("messages.admin.deleteReason")}
            </label>
            <Textarea
              id="admin-delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("messages.admin.deleteReasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setReason("");
              }}
              disabled={deleting}
            >
              {t("messages.actions.cancel")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("admin.sanction.submitting") : t("messages.admin.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
