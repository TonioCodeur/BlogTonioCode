"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserSanctions, revokeSanction } from "@/lib/actions/admin";
import { toast } from "sonner";
import { AlertTriangle, Ban, VolumeX, ShieldBan } from "lucide-react";

type Sanction = {
  id: string;
  type: string;
  status: string;
  reason: string;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  issuedBy: { name: string } | null;
};

type UserSanctionsDialogProps = {
  user: { id: string; name: string; email: string };
  open: boolean;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  REVOKED: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  WARNING: AlertTriangle,
  MUTE: VolumeX,
  TEMPORARY_BAN: Ban,
  PERMANENT_BAN: ShieldBan,
};

export function UserSanctionsDialog({ user, open, onClose }: UserSanctionsDialogProps) {
  const t = useI18n();
  const router = useRouter();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  async function fetchSanctions() {
    setLoading(true);
    try {
      const data = await getUserSanctions({ userId: user.id });
      setSanctions(
        data.map((s) => ({
          ...s,
          expiresAt: s.expiresAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          revokedAt: s.revokedAt?.toISOString() ?? null,
        }))
      );
    } catch {
      toast.error(t("admin.genericError"));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      fetchSanctions();
    } else {
      onClose();
    }
  }

  async function handleRevoke(sanctionId: string) {
    if (!revokeReason.trim()) return;
    try {
      await revokeSanction({ sanctionId, reason: revokeReason.trim() });
      toast.success(t("admin.sanctions.revoked"));
      setSanctions((prev) =>
        prev.map((s) =>
          s.id === sanctionId
            ? { ...s, status: "REVOKED", revokedAt: new Date().toISOString(), revokeReason: revokeReason.trim() }
            : s
        )
      );
      setRevoking(null);
      setRevokeReason("");
      router.refresh();
    } catch {
      toast.error(t("admin.genericError"));
    }
  }

  const sanctionTypeLabels: Record<string, string> = {
    WARNING: t("admin.sanction.warning"),
    MUTE: t("admin.sanction.mute"),
    TEMPORARY_BAN: t("admin.sanction.temporaryBan"),
    PERMANENT_BAN: t("admin.sanction.permanentBan"),
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.sanctions.title")}</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : sanctions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("admin.sanctions.empty")}</p>
        ) : (
          <div className="space-y-3 py-2">
            {sanctions.map((sanction) => {
              const Icon = TYPE_ICONS[sanction.type] ?? AlertTriangle;
              return (
                <div key={sanction.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        {sanctionTypeLabels[sanction.type] ?? sanction.type}
                      </span>
                    </div>
                    <Badge variant="secondary" className={STATUS_COLORS[sanction.status] ?? ""}>
                      {sanction.status}
                    </Badge>
                  </div>

                  <p className="text-sm">{sanction.reason}</p>

                  {sanction.notes && (
                    <p className="text-xs text-muted-foreground italic">{sanction.notes}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("admin.sanctions.issuedBy")}: {sanction.issuedBy?.name ?? t("admin.sanctions.system")}
                    </span>
                    <span>{new Date(sanction.createdAt).toLocaleDateString()}</span>
                    {sanction.expiresAt && (
                      <span>
                        {t("admin.sanctions.expires")}: {new Date(sanction.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {sanction.revokeReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("admin.sanctions.revokeReason")}: {sanction.revokeReason}
                    </p>
                  )}

                  {sanction.status === "ACTIVE" && (
                    <>
                      <Separator />
                      {revoking === sanction.id ? (
                        <div className="space-y-2">
                          <Label className="text-xs">{t("admin.sanctions.revokeReason")}</Label>
                          <Input
                            value={revokeReason}
                            onChange={(e) => setRevokeReason(e.target.value)}
                            placeholder={t("admin.sanctions.revokeReasonPlaceholder")}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRevoking(null);
                                setRevokeReason("");
                              }}
                            >
                              {t("admin.sanction.cancel")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(sanction.id)}
                              disabled={!revokeReason.trim()}
                            >
                              {t("admin.sanctions.confirmRevoke")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRevoking(sanction.id)}
                        >
                          {t("admin.sanctions.revoke")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
