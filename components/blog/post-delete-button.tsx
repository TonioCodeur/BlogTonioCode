"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/blog/delete-button";
import { deletePost } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";

type PostDeleteButtonProps = {
  postId: string;
};

export function PostDeleteButton({ postId }: PostDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();

  return (
    <DeleteButton
      onDelete={async () => {
        const res = await deletePost(postId);
        if (res.success) {
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
