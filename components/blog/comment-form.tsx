"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

type CommentFormProps = {
  postId: string;
  parentId?: string;
  isReply?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function CommentForm({
  postId,
  parentId,
  isReply = false,
  onCancel,
  onSuccess,
}: CommentFormProps) {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: createComment,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("blog.comments.success"));
        setContent("");
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.forPost(postId) });
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error || t("blog.comments.error"));
      }
    },
    onError: () => toast.error(t("blog.comments.error")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    mutation.mutate({ postId, content: trimmed, parentId });
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
        disabled={mutation.isPending}
        required
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            {t("blog.comments.cancel")}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !content.trim()}
        >
          {mutation.isPending
            ? t("blog.comments.submitting")
            : isReply
              ? t("blog.comments.submitReply")
              : t("blog.comments.submit")}
        </Button>
      </div>
    </form>
  );
}
