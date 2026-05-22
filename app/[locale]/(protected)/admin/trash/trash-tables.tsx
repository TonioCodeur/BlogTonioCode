"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/locales/client";
import {
  restorePost,
  restoreComment,
  hardDeletePost,
  hardDeleteComment,
} from "@/lib/actions/trash";
import { EmptyTrashDialog } from "@/app/[locale]/(protected)/admin/trash/empty-trash-dialog";

export type TrashRole = "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export type TrashedPostRow = {
  id: string;
  title: string;
  slug: string;
  authorName: string | null;
  trashedAt: Date;
  trashedBy: { name: string } | null;
  trashReason: string;
  trashNotes: string | null;
};

export type TrashedCommentRow = {
  id: string;
  content: string;
  postId: string;
  postSlug: string;
  postTitle: string;
  authorName: string | null;
  trashedAt: Date;
  trashedBy: { name: string } | null;
  trashReason: string;
  trashNotes: string | null;
};

type TrashTablesProps = {
  posts: TrashedPostRow[];
  comments: TrashedCommentRow[];
  currentUserRole: TrashRole;
  locale: string;
};

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n).trimEnd()}…`;
}

export function TrashTables({
  posts,
  comments,
  currentUserRole,
  locale,
}: TrashTablesProps) {
  const t = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN";
  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
  // Hard-delete is now ADMIN+; empty-trash stays SUPER_ADMIN-only.
  const canHardDelete = isAdmin;
  const canEmptyTrash = isSuperAdmin;

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleRestore(kind: "post" | "comment", id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result =
        kind === "post"
          ? await restorePost({ postId: id })
          : await restoreComment({ commentId: id });
      if (result.success) {
        toast.success(t("trash.toast.restored"));
        router.refresh();
      } else {
        toast.error(result.error || t("trash.toast.error"));
      }
      setBusyId(null);
    });
  }

  function handleHardDelete(kind: "post" | "comment", id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result =
        kind === "post"
          ? await hardDeletePost({ postId: id })
          : await hardDeleteComment({ commentId: id });
      if (result.success) {
        toast.success(t("trash.toast.hardDeleted"));
        router.refresh();
      } else {
        toast.error(result.error || t("trash.toast.error"));
      }
      setBusyId(null);
    });
  }

  const totalCount = posts.length + comments.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            {t("trash.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("trash.description", { count: totalCount })}
          </p>
          {!isAdmin ? (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {t("trash.readOnly")}
            </p>
          ) : null}
        </div>
        {canEmptyTrash ? <EmptyTrashDialog /> : null}
      </header>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">
            {t("trash.tabs.posts")}{" "}
            <Badge variant="outline" className="ml-2">
              {posts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="comments">
            {t("trash.tabs.comments")}{" "}
            <Badge variant="outline" className="ml-2">
              {comments.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── Posts tab ─────────────────────────────────────────────────── */}
        <TabsContent value="posts">
          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              {t("trash.empty.posts")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("trash.table.title")}</TableHead>
                    <TableHead>{t("trash.table.author")}</TableHead>
                    <TableHead>{t("trash.table.trashedBy")}</TableHead>
                    <TableHead>{t("trash.table.reason")}</TableHead>
                    <TableHead>{t("trash.table.date")}</TableHead>
                    <TableHead className="w-32 text-right">
                      {t("trash.table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1">{row.title}</span>
                          <Link
                            href={`/blog/${row.slug}`}
                            className="text-muted-foreground hover:text-foreground"
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("trash.table.viewPost")}
                            title={t("trash.table.viewPost")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.authorName ?? t("trash.table.unknownAuthor")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.trashedBy?.name ?? t("trash.table.unknownModerator")}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2">{row.trashReason}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm whitespace-pre-wrap">
                              <p className="text-xs">{row.trashReason}</p>
                              {row.trashNotes && isAdmin ? (
                                <p className="mt-2 text-xs italic text-muted-foreground">
                                  {t("trash.table.notes")}: {row.trashNotes}
                                </p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.trashedAt, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          kind="post"
                          id={row.id}
                          label={row.title}
                          isAdmin={isAdmin}
                          canHardDelete={canHardDelete}
                          busy={isPending && busyId === row.id}
                          onRestore={() => handleRestore("post", row.id)}
                          onHardDelete={() => handleHardDelete("post", row.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── Comments tab ──────────────────────────────────────────────── */}
        <TabsContent value="comments">
          {comments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              {t("trash.empty.comments")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("trash.table.content")}</TableHead>
                    <TableHead>{t("trash.table.post")}</TableHead>
                    <TableHead>{t("trash.table.author")}</TableHead>
                    <TableHead>{t("trash.table.trashedBy")}</TableHead>
                    <TableHead>{t("trash.table.reason")}</TableHead>
                    <TableHead>{t("trash.table.date")}</TableHead>
                    <TableHead className="w-32 text-right">
                      {t("trash.table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[240px] text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2">
                                {truncate(row.content, 80)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm whitespace-pre-wrap">
                              <p className="text-xs">{row.content}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link
                          href={`/blog/${row.postSlug}`}
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="line-clamp-1">{row.postTitle}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.authorName ?? t("trash.table.unknownAuthor")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.trashedBy?.name ?? t("trash.table.unknownModerator")}
                      </TableCell>
                      <TableCell className="max-w-[240px] text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2">{row.trashReason}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm whitespace-pre-wrap">
                              <p className="text-xs">{row.trashReason}</p>
                              {row.trashNotes && isAdmin ? (
                                <p className="mt-2 text-xs italic text-muted-foreground">
                                  {t("trash.table.notes")}: {row.trashNotes}
                                </p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.trashedAt, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          kind="comment"
                          id={row.id}
                          label={truncate(row.content, 40)}
                          isAdmin={isAdmin}
                          canHardDelete={canHardDelete}
                          busy={isPending && busyId === row.id}
                          onRestore={() => handleRestore("comment", row.id)}
                          onHardDelete={() => handleHardDelete("comment", row.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Row actions (Restore / Hard delete) ─────────────────────────────────────

type RowActionsProps = {
  kind: "post" | "comment";
  id: string;
  label: string;
  isAdmin: boolean;
  canHardDelete: boolean;
  busy: boolean;
  onRestore: () => void;
  onHardDelete: () => void;
};

function RowActions({
  kind,
  isAdmin,
  canHardDelete,
  busy,
  onRestore,
  onHardDelete,
}: RowActionsProps) {
  const t = useI18n();

  if (!isAdmin) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex items-center justify-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRestore}
              disabled={busy}
              aria-label={t("trash.actions.restore")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("trash.actions.restore")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {canHardDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={busy}
              aria-label={t("trash.actions.hardDelete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("trash.confirm.hardDelete.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {kind === "post"
                  ? t("trash.confirm.hardDelete.descriptionPost")
                  : t("trash.confirm.hardDelete.descriptionComment")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>
                {t("trash.actions.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onHardDelete();
                }}
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy
                  ? t("trash.confirm.hardDelete.submitting")
                  : t("trash.confirm.hardDelete.submit")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
