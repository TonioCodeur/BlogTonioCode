"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/blog/delete-button";
import { deleteCategory } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";

type CategoryDeleteButtonProps = {
  categoryId: string;
};

export function CategoryDeleteButton({ categoryId }: CategoryDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();

  return (
    <DeleteButton
      onDelete={async () => {
        const res = await deleteCategory(categoryId);
        if (res.success) {
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
