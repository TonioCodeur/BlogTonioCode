"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/blog/delete-button";
import { deleteArticle } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";

type ArticleDeleteButtonProps = {
  articleId: string;
};

export function ArticleDeleteButton({ articleId }: ArticleDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();

  return (
    <DeleteButton
      onDelete={async () => {
        const res = await deleteArticle(articleId);
        if (res.success) {
          router.push("/blog");
          router.refresh();
          return { success: true };
        }
        return { success: false, error: res.error };
      }}
      confirmTitle={t("blog.actions.deleteArticle.confirmTitle")}
      confirmDescription={t("blog.actions.deleteArticle.confirmDescription")}
      variant="outline"
      size="sm"
    />
  );
}
