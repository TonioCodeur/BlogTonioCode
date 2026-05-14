"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "@/components/blog/delete-button";
import { deleteCategory } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

type CategoryDeleteButtonProps = {
  categoryId: string;
};

export function CategoryDeleteButton({ categoryId }: CategoryDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <DeleteButton
      onDelete={async () => {
        const res = await deleteCategory(categoryId);
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
          router.refresh();
          return { success: true };
        }
        return { success: false, error: res.error };
      }}
      confirmTitle={t("blog.actions.deleteCategory.confirmTitle")}
      confirmDescription={t("blog.actions.deleteCategory.confirmDescription")}
      iconOnly
      variant="ghost"
    />
  );
}
