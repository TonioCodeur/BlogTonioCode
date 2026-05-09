"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import { toast } from "sonner";
import { Pencil, Trash2, Bot as BotIcon, Plus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteBot } from "@/lib/actions/bots";
import type { BotSummary } from "@/lib/bots-types";

type Props = {
  bots: BotSummary[];
};

function getInitials(name: string | null | undefined) {
  if (!name) return "BO";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function BotsTable({ bots }: Props) {
  const t = useI18n();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<BotSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteBot({ id: deleteTarget.id });
      if (result.ok) {
        toast.success(t("admin.bots.toasts.deleted"));
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
    } finally {
      setDeleting(false);
    }
  }

  if (bots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
        <BotIcon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="mb-4 text-sm font-medium">{t("admin.bots.empty.title")}</p>
        <Button asChild>
          <Link href="/admin/bots/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t("admin.bots.empty.cta")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.bots.table.name")}</TableHead>
              <TableHead>{t("admin.bots.table.email")}</TableHead>
              <TableHead>{t("admin.bots.table.role")}</TableHead>
              <TableHead>{t("admin.bots.table.active")}</TableHead>
              <TableHead className="text-center">{t("admin.bots.table.messages")}</TableHead>
              <TableHead className="text-right">{t("admin.bots.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bots.map((bot) => (
              <TableRow key={bot.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={bot.image ?? undefined} alt={bot.name ?? ""} />
                      <AvatarFallback className="text-xs">
                        {getInitials(bot.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{bot.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{bot.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{bot.role}</Badge>
                </TableCell>
                <TableCell>
                  {bot.isBotActive ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {t("admin.bots.table.active")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">—</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {bot.autoMessagesCount}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      title={t("admin.bots.actions.edit")}
                    >
                      <Link href={`/admin/bots/${bot.id}`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{t("admin.bots.actions.edit")}</span>
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(bot)}
                      title={t("admin.bots.actions.delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      <span className="sr-only">{t("admin.bots.actions.delete")}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.bots.actions.deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.bots.actions.deleteConfirm.description", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("admin.bots.actions.deleteConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.bots.actions.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
