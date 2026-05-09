"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";

type CommentFormProps = {
  articleId: string;
  parentId?: string;
  isReply?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function CommentForm({
  articleId,
  parentId,
  isReply = false,
  onCancel,
  onSuccess,
}: CommentFormProps) {
  const t = useI18n();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createComment({
        articleId,
        content: trimmed,
        parentId,
      });

      if (result.success) {
        toast.success(t("blog.comments.success"));
        setContent("");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error || t("blog.comments.error"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          isReply
            ? t("blog.comments.replyPlaceholder")
            : t("blog.comments.placeholder")
        }
        rows={isReply ? 3 : 4}
        disabled={isPending}
        required
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("blog.comments.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
          {isPending
            ? t("blog.comments.submitting")
            : isReply
              ? t("blog.comments.submitReply")
              : t("blog.comments.submit")}
        </Button>
      </div>
    </form>
  );
}
