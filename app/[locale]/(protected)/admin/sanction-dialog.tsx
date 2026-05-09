"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createSanction } from "@/lib/actions/admin";
import { toast } from "sonner";

const SANCTION_TYPES = ["WARNING", "MUTE", "TEMPORARY_BAN", "PERMANENT_BAN"] as const;

type SanctionDialogProps = {
  user: { id: string; name: string; email: string };
  open: boolean;
  onClose: () => void;
};

export function SanctionDialog({ user, open, onClose }: SanctionDialogProps) {
  const t = useI18n();
  const router = useRouter();
  const [type, setType] = useState<(typeof SANCTION_TYPES)[number]>("WARNING");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [loading, setLoading] = useState(false);

  const sanctionLabels: Record<string, string> = {
    WARNING: t("admin.sanction.warning"),
    MUTE: t("admin.sanction.mute"),
    TEMPORARY_BAN: t("admin.sanction.temporaryBan"),
    PERMANENT_BAN: t("admin.sanction.permanentBan"),
  };

  async function handleSubmit() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await createSanction({
        userId: user.id,
        type,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        durationDays: type === "TEMPORARY_BAN" && durationDays ? parseInt(durationDays, 10) : undefined,
      });
      toast.success(t("admin.sanction.success"));
      router.refresh();
      onClose();
    } catch {
      toast.error(t("admin.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.sanction.title")}</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("admin.sanction.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as (typeof SANCTION_TYPES)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SANCTION_TYPES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {sanctionLabels[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("admin.sanction.reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin.sanction.reasonPlaceholder")}
              rows={3}
            />
          </div>

          {type === "TEMPORARY_BAN" && (
            <div className="space-y-2">
              <Label>{t("admin.sanction.duration")}</Label>
              <Input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder={t("admin.sanction.durationPlaceholder")}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("admin.sanction.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("admin.sanction.notesPlaceholder")}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("admin.sanction.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
          >
            {loading ? t("admin.sanction.submitting") : t("admin.sanction.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
