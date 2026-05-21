"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteButton } from "@/components/blog/delete-button";
import { deletePost } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

type PostDeleteButtonProps = {
  postId: string;
  /** When true the post is already moderated — disable the author delete (spec §5.3). */
  underModeration?: boolean;
};

export function PostDeleteButton({
  postId,
  underModeration = false,
}: PostDeleteButtonProps) {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (underModeration) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("blog.actions.delete")}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t("trash.authorView.underModeration")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

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
