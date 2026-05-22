"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/locales/client";
import {
  moveToTrashPost,
  moveToTrashComment,
  moveToTrashCategory,
} from "@/lib/actions/trash";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

type MoveToTrashDialogProps = {
  target:
    | { kind: "post"; postId: string }
    | { kind: "comment"; commentId: string }
    | { kind: "category"; categoryId: string };
  /** When true the trigger is just an icon button. Otherwise label + icon. */
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Called after a successful move, e.g. to invalidate caches. */
  onMoved?: () => void;
  /** Optional override for the trigger label. */
  label?: string;
};

const REASON_MAX = 500;
const NOTES_MAX = 2000;

export function MoveToTrashDialog({
  target,
  iconOnly = false,
  variant = "outline",
  size = "sm",
  onMoved,
  label,
}: MoveToTrashDialogProps) {
  const t = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const triggerLabel = label ?? t("trash.actions.moveToTrash");

  function validate(): boolean {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(t("trash.fields.reasonRequired"));
      return false;
    }
    if (trimmed.length > REASON_MAX) {
      setReasonError(t("trash.fields.reasonTooLong"));
      return false;
    }
    setReasonError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const trimmedReason = reason.trim();
      const trimmedNotes = notes.trim();
      const result =
        target.kind === "post"
          ? await moveToTrashPost({
              postId: target.postId,
              reason: trimmedReason,
              notes: trimmedNotes || undefined,
            })
          : target.kind === "comment"
            ? await moveToTrashComment({
                commentId: target.commentId,
                reason: trimmedReason,
                notes: trimmedNotes || undefined,
              })
            : await moveToTrashCategory({
                categoryId: target.categoryId,
                reason: trimmedReason,
                notes: trimmedNotes || undefined,
              });

      if (result.success) {
        toast.success(t("trash.toast.moved"));
        setOpen(false);
        setReason("");
        setNotes("");
        onMoved?.();
        router.refresh();
      } else {
        toast.error(result.error || t("trash.toast.error"));
      }
    } catch {
      toast.error(t("trash.toast.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return;
        setOpen(v);
        if (!v) {
          setReasonError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={iconOnly ? "icon" : size}
          className={iconOnly ? "h-8 w-8 text-destructive hover:text-destructive" : ""}
          aria-label={triggerLabel}
        >
          <Trash2 className={iconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {iconOnly ? null : triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trash.confirm.moveToTrash.title")}</DialogTitle>
          <DialogDescription>
            {t("trash.confirm.moveToTrash.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("trash.fields.reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder={t("trash.fields.reasonPlaceholder")}
              rows={3}
              maxLength={REASON_MAX + 50}
              disabled={loading}
            />
            {reasonError ? (
              <p className="text-xs text-destructive">{reasonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {reason.trim().length}/{REASON_MAX}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("trash.fields.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("trash.fields.notesPlaceholder")}
              rows={2}
              maxLength={NOTES_MAX + 50}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("trash.actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
          >
            {loading
              ? t("trash.confirm.moveToTrash.submitting")
              : t("trash.confirm.moveToTrash.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
