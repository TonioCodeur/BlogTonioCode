"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownComment } from "@/components/markdown-comment";
import { CommentForm } from "@/components/blog/comment-form";
import { DeleteButton } from "@/components/blog/delete-button";
import { LikeButton } from "@/components/blog/like-button";
import { MoveToTrashDialog } from "@/components/blog/move-to-trash-dialog";
import { TrashTombstone } from "@/components/blog/trash-tombstone";
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
  /** Moderation trash timestamp — when not null, comment is hidden from public. */
  trashedAt: Date | null;
  authorId: string | null;
  author: { id: string; name: string; image: string | null } | null;
  parentId: string | null;
  replies: CommentNode[];
  /** Total likes on this comment (0 when hidden by trash/deletion). */
  likeCount: number;
  /** Whether the current viewer has liked this comment (false when anonymous or hidden). */
  likedByMe: boolean;
};

type CommentsSectionProps = {
  postId: string;
  comments: CommentNode[];
  currentUserId: string | null;
  currentUserRole: CommentRole | null;
  /** When false (authed user without verified email), like clicks trigger a toast. */
  currentUserEmailVerified?: boolean;
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

function isModeratorRole(role: CommentRole | null): boolean {
  return !!role && MODERATOR_ROLES.includes(role);
}

function canAuthorDelete(
  comment: CommentNode,
  currentUserId: string | null,
): boolean {
  if (!currentUserId) return false;
  return comment.authorId === currentUserId;
}

type CommentItemProps = {
  comment: CommentNode;
  postId: string;
  currentUserId: string | null;
  currentUserRole: CommentRole | null;
  currentUserEmailVerified: boolean;
  locale: string;
  isReply?: boolean;
};

function CommentItem({
  comment,
  postId,
  currentUserId,
  currentUserRole,
  currentUserEmailVerified,
  locale,
  isReply = false,
}: CommentItemProps) {
  const t = useI18n();
  const router = useRouter();
  const [showReplyForm, setShowReplyForm] = useState(false);

  const isTrashed = !!comment.trashedAt;
  const isAuthorDeleted = !!comment.deletedAt && !isTrashed;
  const isHidden = isTrashed || isAuthorDeleted;
  const isMod = isModeratorRole(currentUserRole);
  const isAuthor = canAuthorDelete(comment, currentUserId);

  // Author can soft-delete only if their comment is still visible (not under moderation).
  const showAuthorDelete = !isHidden && isAuthor;
  // Moderators can move a still-visible comment to trash.
  const showMoveToTrash = !isHidden && isMod && !isAuthor;

  const authorName = isHidden
    ? t("messages.thread.unknownUser")
    : comment.author?.name ?? t("messages.thread.unknownUser");

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
          <div className="flex items-center gap-1">
            {showAuthorDelete ? (
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
            {showMoveToTrash ? (
              <MoveToTrashDialog
                target={{ kind: "comment", commentId: comment.id }}
                iconOnly
                variant="ghost"
              />
            ) : null}
          </div>
        </header>

        {isTrashed ? (
          <TrashTombstone state="TRASHED" />
        ) : isAuthorDeleted ? (
          <TrashTombstone state="AUTHOR_DELETED" />
        ) : (
          <MarkdownComment>{comment.content}</MarkdownComment>
        )}

        {!isHidden ? (
          <div className="mt-2 flex items-center gap-1">
            <LikeButton
              targetType="comment"
              targetId={comment.id}
              postId={postId}
              initialCount={comment.likeCount}
              initialLiked={comment.likedByMe}
              isAuthenticated={!!currentUserId}
              requiresEmailVerification={!!currentUserId && !currentUserEmailVerified}
              size="sm"
            />
            {!isReply && currentUserId ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowReplyForm((v) => !v)}
              >
                {t("blog.comments.reply")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {showReplyForm ? (
          <div className="mt-3">
            <CommentForm
              postId={postId}
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
              postId={postId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              currentUserEmailVerified={currentUserEmailVerified}
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
  postId,
  comments,
  currentUserId,
  currentUserRole,
  currentUserEmailVerified = false,
  locale,
}: CommentsSectionProps) {
  const t = useI18n();

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
          <CommentForm postId={postId} />
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
              postId={postId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              currentUserEmailVerified={currentUserEmailVerified}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
