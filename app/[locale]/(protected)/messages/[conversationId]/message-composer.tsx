"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal } from "lucide-react";
import { useI18n, useCurrentLocale } from "@/locales/client";
import { sendMessage } from "@/lib/actions/messaging";
import type { MuteInfo } from "@/lib/messaging-types";
import { toast } from "sonner";

const MAX_LEN = 2000;

type Props = {
  conversationId: string;
  muteInfo: MuteInfo;
};

function formatMutedUntil(date: string | Date, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageComposer({ conversationId, muteInfo }: Props) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const isBanned = muteInfo.isBanned;
  const isMuted = muteInfo.isMuted;
  const disabled = isBanned || isMuted;

  let disabledMessage: string | null = null;
  if (isBanned) {
    disabledMessage = t("messages.composer.banned");
  } else if (isMuted) {
    disabledMessage = muteInfo.mutedUntil
      ? t("messages.composer.mutedUntil", {
          date: formatMutedUntil(muteInfo.mutedUntil, locale),
        })
      : t("messages.composer.mutedIndef");
  }

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error(t("messages.errors.empty"));
      return;
    }
    if (trimmed.length > MAX_LEN) {
      toast.error(t("messages.errors.tooLong"));
      return;
    }
    setSending(true);
    try {
      const result = await sendMessage({ conversationId, content: trimmed });
      if (result.ok) {
        setValue("");
        router.refresh();
        textareaRef.current?.focus();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("messages.errors.generic"));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  }

  if (disabled && disabledMessage) {
    return (
      <div
        role="alert"
        className="border-t bg-muted/40 p-4 text-center text-sm text-muted-foreground"
      >
        {disabledMessage}
      </div>
    );
  }

  return (
    <form
      className="border-t bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-label={t("messages.composer.placeholder")}
    >
      <label htmlFor="message-composer-textarea" className="sr-only">
        {t("messages.composer.placeholder")}
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="message-composer-textarea"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("messages.composer.placeholder")}
          className="min-h-[44px] max-h-40 flex-1 resize-none"
          maxLength={MAX_LEN}
          disabled={sending}
          aria-describedby="message-composer-hint"
          autoFocus
        />
        <Button
          type="submit"
          disabled={sending || !value.trim()}
          aria-label={t("messages.composer.send")}
        >
          <SendHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">
            {sending ? t("messages.composer.sending") : t("messages.composer.send")}
          </span>
        </Button>
      </div>
      <p id="message-composer-hint" className="mt-1 text-xs text-muted-foreground">
        {t("messages.composer.hint")} · {value.length}/{MAX_LEN}
      </p>
    </form>
  );
}
