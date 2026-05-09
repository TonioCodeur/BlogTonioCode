"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownComment } from "@/components/markdown-comment";
import { CommentForm } from "@/components/blog/comment-form";
import { DeleteButton } from "@/components/blog/delete-button";
import { deleteComment } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";

export type CommentRole = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

const MODERATOR_ROLES: ReadonlyArray<CommentRole> = [
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
];

export type CommentNode = {
  id: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  authorId: string | null;
  author: { id: string; name: string; image: string | null } | null;
  parentId: string | null;
  replies: CommentNode[];
};

type CommentsSectionProps = {
  articleId: string;
  comments: CommentNode[];
  currentUserId: string | null;
  currentUserRole: CommentRole | null;
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

function canDelete(
  comment: CommentNode,
  currentUserId: string | null,
  currentUserRole: CommentRole | null,
): boolean {
  if (!currentUserId) return false;
  if (currentUserRole && MODERATOR_ROLES.includes(currentUserRole)) return true;
  return comment.authorId === currentUserId;
}

type CommentItemProps = {
  comment: CommentNode;
  articleId: string;
  currentUserId: string | null;
  currentUserRole: CommentRole | null;
  locale: string;
  isReply?: boolean;
};

function CommentItem({
  comment,
  articleId,
  currentUserId,
  currentUserRole,
  locale,
  isReply = false,
}: CommentItemProps) {
  const t = useI18n();
  const router = useRouter();
  const [showReplyForm, setShowReplyForm] = useState(false);

  const isDeleted = !!comment.deletedAt;
  const showDelete =
    !isDeleted && canDelete(comment, currentUserId, currentUserRole);
  const authorName =
    comment.author?.name ?? t("messages.thread.unknownUser");

  return (
    <article className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <header className="mb-2 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{authorName}</span>
            <span className="text-muted-foreground">·</span>
            <time className="text-muted-foreground">
              {formatDate(comment.createdAt, locale)}
            </time>
          </div>
          {showDelete ? (
            <DeleteButton
              onDelete={async () => {
                const res = await deleteComment(comment.id);
                if (res.success) {
                  router.refresh();
                  return { success: true };
                }
                return { success: false, error: res.error };
              }}
              confirmTitle={t("blog.comments.delete.confirmTitle")}
              confirmDescription={t("blog.comments.delete.confirmDescription")}
              successMessage={t("blog.comments.delete.success")}
              errorMessage={t("blog.comments.delete.error")}
              iconOnly
              variant="ghost"
            />
          ) : null}
        </header>

        {isDeleted ? (
          <p className="italic text-muted-foreground">
            {t("blog.comments.deleted")}
          </p>
        ) : (
          <MarkdownComment>{comment.content}</MarkdownComment>
        )}

        {!isDeleted && !isReply && currentUserId ? (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowReplyForm((v) => !v)}
            >
              {t("blog.comments.reply")}
            </Button>
          </div>
        ) : null}

        {showReplyForm ? (
          <div className="mt-3">
            <CommentForm
              articleId={articleId}
              parentId={comment.id}
              isReply
              onCancel={() => setShowReplyForm(false)}
              onSuccess={() => setShowReplyForm(false)}
            />
          </div>
        ) : null}
      </div>

      {comment.replies.length > 0 ? (
        <div className="ml-6 space-y-3 border-l-2 pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              articleId={articleId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              locale={locale}
              isReply
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function CommentsSection({
  articleId,
  comments,
  currentUserId,
  currentUserRole,
  locale,
}: CommentsSectionProps) {
  const t = useI18n();

  // Count includes replies, excludes soft-deleted comments only when their author isn't visible.
  const totalCount = comments.reduce(
    (sum, c) => sum + 1 + c.replies.length,
    0,
  );

  return (
    <section className="mt-12 border-t pt-10">
      <header className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-mono text-2xl font-bold tracking-tight">
          {t("blog.comments.title")}
        </h2>
        {totalCount > 0 ? (
          <span className="text-sm text-muted-foreground">({totalCount})</span>
        ) : null}
      </header>

      <div className="mb-8">
        {currentUserId ? (
          <CommentForm articleId={articleId} />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("blog.comments.signInPrompt")}{" "}
            <Link
              href="/signin"
              className="font-medium text-primary hover:underline"
            >
              {t("blog.comments.signInLink")}
            </Link>
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("blog.comments.empty")}</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              articleId={articleId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
