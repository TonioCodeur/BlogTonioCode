"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/locales/client";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

type DeleteButtonProps = {
  onDelete: () => Promise<{ success: boolean; error?: string }>;
  confirmTitle: string;
  confirmDescription: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  label?: string;
  className?: string;
  onSuccess?: () => void;
  successMessage?: string;
  errorMessage?: string;
};

export function DeleteButton({
  onDelete,
  confirmTitle,
  confirmDescription,
  variant = "ghost",
  size = "sm",
  iconOnly = false,
  label,
  className,
  onSuccess,
  successMessage,
  errorMessage,
}: DeleteButtonProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await onDelete();
      if (result.success) {
        toast.success(successMessage ?? t("blog.actions.delete.success"));
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(result.error ?? errorMessage ?? t("blog.actions.delete.error"));
      }
    });
  };

  const buttonLabel = label ?? t("blog.actions.delete");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? "icon" : size}
          className={cn(
            iconOnly && "h-8 w-8",
            "text-destructive hover:bg-destructive/10 hover:text-destructive",
            className,
          )}
          aria-label={buttonLabel}
        >
          <Trash2 className={cn(iconOnly ? "h-4 w-4" : "mr-2 h-4 w-4")} />
          {!iconOnly && <span>{buttonLabel}</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("blog.actions.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
          >
            {isPending
              ? t("blog.actions.delete.deleting")
              : t("blog.actions.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
