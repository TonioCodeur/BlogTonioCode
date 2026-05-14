"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "@/components/blog/delete-button";
import { deletePost } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

type PostDeleteButtonProps = {
  postId: string;
};

export function PostDeleteButton({ postId }: PostDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <DeleteButton
      onDelete={async () => {
        const res = await deletePost(postId);
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
          router.push("/blog");
          router.refresh();
          return { success: true };
        }
        return { success: false, error: res.error };
      }}
      confirmTitle={t("blog.actions.deletePost.confirmTitle")}
      confirmDescription={t("blog.actions.deletePost.confirmDescription")}
      variant="outline"
      size="sm"
    />
  );
}
