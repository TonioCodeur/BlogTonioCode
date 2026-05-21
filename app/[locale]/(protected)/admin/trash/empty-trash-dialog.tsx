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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/locales/client";
import { emptyTrash } from "@/lib/actions/trash";

/**
 * SUPER_ADMIN-only "Empty trash" dialog. Requires the user to type the
 * confirmation keyword (locale-dependent — defaults to "VIDER" per spec).
 */
export function EmptyTrashDialog() {
  const t = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [olderThanDays, setOlderThanDays] = useState("");
  const [loading, setLoading] = useState(false);

  const keyword = t("trash.confirm.empty.keyword");
  const canSubmit = confirmInput.trim() === keyword && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const days = olderThanDays.trim() ? parseInt(olderThanDays, 10) : undefined;
      const result = await emptyTrash({
        confirm: "VIDER",
        olderThanDays: Number.isFinite(days) ? (days as number) : undefined,
      });
      if (result.success) {
        const data = result.data ?? { posts: 0, comments: 0 };
        toast.success(
          t("trash.toast.emptied", { posts: data.posts, comments: data.comments }),
        );
        setOpen(false);
        setConfirmInput("");
        setOlderThanDays("");
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
          setConfirmInput("");
          setOlderThanDays("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          {t("trash.actions.emptyTrash")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trash.confirm.empty.title")}</DialogTitle>
          <DialogDescription>
            {t("trash.confirm.empty.description", { keyword })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="emptyTrash-olderThan">
              {t("trash.confirm.empty.olderThan")}
            </Label>
            <Input
              id="emptyTrash-olderThan"
              type="number"
              min={1}
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(e.target.value)}
              placeholder={t("trash.confirm.empty.olderThanPlaceholder")}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emptyTrash-confirm">
              {t("trash.confirm.empty.confirmLabel", { keyword })}
            </Label>
            <Input
              id="emptyTrash-confirm"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
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
            disabled={!canSubmit}
          >
            {loading
              ? t("trash.confirm.empty.submitting")
              : t("trash.confirm.empty.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
