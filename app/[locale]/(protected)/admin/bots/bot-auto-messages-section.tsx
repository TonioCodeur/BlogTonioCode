"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

import { useI18n } from "@/locales/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  createBotAutoMessage,
  updateBotAutoMessage,
  deleteBotAutoMessage,
} from "@/lib/actions/bots";
import type { BotAutoMessageData, BotTriggerValue } from "@/lib/bots-types";

type Props = {
  botId: string;
  messages: BotAutoMessageData[];
};

const TRIGGERS: BotTriggerValue[] = [
  "USER_SIGNUP",
  "ROLE_CHANGED",
  "SANCTION_APPLIED",
];

const TRIGGER_VARIABLES: Record<BotTriggerValue, Array<"name" | "role" | "sanctionType">> = {
  USER_SIGNUP: ["name"],
  ROLE_CHANGED: ["name", "role"],
  SANCTION_APPLIED: ["name", "sanctionType"],
};

type DraftState = {
  content: string;
  isActive: boolean;
  saving: boolean;
};

function triggerI18nKey(trigger: BotTriggerValue) {
  switch (trigger) {
    case "USER_SIGNUP":
      return "admin.bots.messages.triggers.userSignup" as const;
    case "ROLE_CHANGED":
      return "admin.bots.messages.triggers.roleChanged" as const;
    case "SANCTION_APPLIED":
      return "admin.bots.messages.triggers.sanctionApplied" as const;
  }
}

export function BotAutoMessagesSection({ botId, messages }: Props) {
  const t = useI18n();
  const router = useRouter();

  // Per-existing-message local draft (content + isActive + saving flag).
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => {
    const initial: Record<string, DraftState> = {};
    for (const m of messages) {
      initial[m.id] = { content: m.content, isActive: m.isActive, saving: false };
    }
    return initial;
  });

  // Per-trigger "add new" draft.
  const [newDrafts, setNewDrafts] = useState<
    Record<BotTriggerValue, { content: string; creating: boolean }>
  >({
    USER_SIGNUP: { content: "", creating: false },
    ROLE_CHANGED: { content: "", creating: false },
    SANCTION_APPLIED: { content: "", creating: false },
  });

  function getDraft(id: string, fallback: BotAutoMessageData) {
    return (
      drafts[id] ?? {
        content: fallback.content,
        isActive: fallback.isActive,
        saving: false,
      }
    );
  }

  function patchDraft(id: string, patch: Partial<DraftState>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { content: "", isActive: true, saving: false }), ...patch },
    }));
  }

  async function handleSave(msg: BotAutoMessageData) {
    const d = getDraft(msg.id, msg);
    patchDraft(msg.id, { saving: true });
    try {
      const result = await updateBotAutoMessage({
        id: msg.id,
        content: d.content,
        isActive: d.isActive,
      });
      if (result.ok) {
        toast.success(t("admin.bots.toasts.messageSaved"));
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
    } finally {
      patchDraft(msg.id, { saving: false });
    }
  }

  async function handleDelete(msg: BotAutoMessageData) {
    patchDraft(msg.id, { saving: true });
    try {
      const result = await deleteBotAutoMessage({ id: msg.id });
      if (result.ok) {
        toast.success(t("admin.bots.toasts.messageDeleted"));
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
        patchDraft(msg.id, { saving: false });
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
      patchDraft(msg.id, { saving: false });
    }
  }

  async function handleCreate(trigger: BotTriggerValue) {
    const current = newDrafts[trigger];
    if (!current.content.trim()) return;
    setNewDrafts((p) => ({ ...p, [trigger]: { ...p[trigger], creating: true } }));
    try {
      const result = await createBotAutoMessage({
        botUserId: botId,
        trigger,
        content: current.content.trim(),
        isActive: true,
      });
      if (result.ok) {
        toast.success(t("admin.bots.toasts.messageSaved"));
        setNewDrafts((p) => ({ ...p, [trigger]: { content: "", creating: false } }));
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
        setNewDrafts((p) => ({ ...p, [trigger]: { ...p[trigger], creating: false } }));
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
      setNewDrafts((p) => ({ ...p, [trigger]: { ...p[trigger], creating: false } }));
    }
  }

  const variableLabels: Record<"name" | "role" | "sanctionType", string> = {
    name: t("admin.bots.messages.variables.name"),
    role: t("admin.bots.messages.variables.role"),
    sanctionType: t("admin.bots.messages.variables.sanctionType"),
  };

  return (
    <div className="space-y-8">
      {TRIGGERS.map((trigger) => {
        const list = messages.filter((m) => m.trigger === trigger);
        const newDraft = newDrafts[trigger];
        const vars = TRIGGER_VARIABLES[trigger];

        return (
          <section
            key={trigger}
            aria-labelledby={`trigger-${trigger}`}
            className="space-y-4 rounded-md border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 id={`trigger-${trigger}`} className="text-base font-semibold">
                  {t(triggerI18nKey(trigger))}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {t("admin.bots.messages.variables.title")}:
                  </span>
                  {vars.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono">
                      {`{{${v}}}`} — {variableLabels[v]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {list.map((msg) => {
                const d = getDraft(msg.id, msg);
                return (
                  <div
                    key={msg.id}
                    className="space-y-2 rounded-md border bg-muted/20 p-3"
                  >
                    <Label htmlFor={`auto-${msg.id}`} className="sr-only">
                      {t("admin.bots.messages.contentPlaceholder")}
                    </Label>
                    <Textarea
                      id={`auto-${msg.id}`}
                      value={d.content}
                      onChange={(e) =>
                        patchDraft(msg.id, { content: e.target.value })
                      }
                      placeholder={t("admin.bots.messages.contentPlaceholder")}
                      rows={3}
                      disabled={d.saving}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-${msg.id}`}
                          checked={d.isActive}
                          onCheckedChange={(v) =>
                            patchDraft(msg.id, { isActive: v })
                          }
                          disabled={d.saving}
                          aria-label={t("admin.bots.messages.active")}
                        />
                        <Label htmlFor={`active-${msg.id}`} className="text-sm">
                          {t("admin.bots.messages.active")}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSave(msg)}
                          disabled={d.saving || !d.content.trim()}
                        >
                          <Save className="mr-1 h-4 w-4" aria-hidden />
                          {t("admin.bots.messages.save")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(msg)}
                          disabled={d.saving}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                          {t("admin.bots.messages.delete")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-2 rounded-md border border-dashed p-3">
                <Label htmlFor={`new-${trigger}`} className="text-sm font-medium">
                  {t("admin.bots.messages.add")}
                </Label>
                <Textarea
                  id={`new-${trigger}`}
                  value={newDraft.content}
                  onChange={(e) =>
                    setNewDrafts((p) => ({
                      ...p,
                      [trigger]: { ...p[trigger], content: e.target.value },
                    }))
                  }
                  placeholder={t("admin.bots.messages.contentPlaceholder")}
                  rows={3}
                  disabled={newDraft.creating}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCreate(trigger)}
                    disabled={newDraft.creating || !newDraft.content.trim()}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden />
                    {t("admin.bots.messages.add")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
