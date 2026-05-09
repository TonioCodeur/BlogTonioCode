"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/locales/client";
import {
  searchUsersForBotMessaging,
  sendBotMessage,
} from "@/lib/actions/bots";
import type { BotMessagingUserSummary } from "@/lib/bots-types";
import { BOT_MANUAL_MESSAGE_MAX_LENGTH } from "@/lib/validations/bots";

type Props = {
  botId: string;
  botActive: boolean;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function useDebounce<T>(value: T, delay: number): T {
  const [state, setState] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setState(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return state;
}

export function BotSendMessageSection({ botId, botActive }: Props) {
  const t = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BotMessagingUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<BotMessagingUserSummary | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<{ conversationId: string } | null>(null);

  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (recipient) return;

    let cancelled = false;
    async function run() {
      if (debounced.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchUsersForBotMessaging({ query: debounced.trim() });
        if (!cancelled && res.ok) {
          setResults(res.users);
        }
      } catch {
        if (!cancelled) toast.error(t("admin.bots.errors.unknown"));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced, recipient, t]);

  const showEmpty = useMemo(
    () =>
      !recipient &&
      !searching &&
      debounced.trim().length >= 2 &&
      results.length === 0,
    [recipient, searching, debounced, results],
  );

  const trimmedContent = content.trim();
  const canSubmit =
    botActive &&
    !!recipient &&
    trimmedContent.length > 0 &&
    trimmedContent.length <= BOT_MANUAL_MESSAGE_MAX_LENGTH &&
    !sending;

  function handleSelect(user: BotMessagingUserSummary): void {
    setRecipient(user);
    setQuery("");
    setResults([]);
    setLastSent(null);
  }

  function handleClearRecipient(): void {
    setRecipient(null);
    setLastSent(null);
  }

  async function handleSend(): Promise<void> {
    if (!recipient || !canSubmit) return;
    setSending(true);
    try {
      const res = await sendBotMessage({
        botUserId: botId,
        recipientUserId: recipient.id,
        content: trimmedContent,
      });
      if (res.ok) {
        toast.success(t("admin.bots.toasts.messageSent"));
        setLastSent({ conversationId: res.conversationId });
        setContent("");
      } else {
        toast.error(t(res.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.bots.detail.sendSection")}</CardTitle>
        <CardDescription>
          {t("admin.bots.detail.sendDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!botActive && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("admin.bots.send.inactiveWarning")}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="bot-recipient-search">
            {t("admin.bots.send.recipientLabel")}
          </Label>

          {recipient ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Avatar size="default">
                <AvatarImage
                  src={recipient.image ?? undefined}
                  alt={recipient.name}
                />
                <AvatarFallback>{getInitials(recipient.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{recipient.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {recipient.email}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearRecipient}
                aria-label={t("admin.bots.send.recipientLabel")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bot-recipient-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("admin.bots.send.searchPlaceholder")}
                  className="pl-9"
                  disabled={!botActive}
                />
              </div>

              {showEmpty && (
                <p className="text-sm text-muted-foreground">
                  {t("admin.bots.send.searchEmpty")}
                </p>
              )}

              {results.length > 0 && (
                <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border p-1">
                  {results.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(user)}
                        className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Avatar size="sm">
                          <AvatarImage
                            src={user.image ?? undefined}
                            alt={user.name}
                          />
                          <AvatarFallback>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {user.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-message-content">
            {t("admin.bots.send.contentLabel")}
          </Label>
          <Textarea
            id="bot-message-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("admin.bots.send.contentPlaceholder")}
            rows={4}
            maxLength={BOT_MANUAL_MESSAGE_MAX_LENGTH}
            disabled={!botActive || !recipient}
          />
          <div className="flex justify-end text-xs text-muted-foreground">
            {trimmedContent.length}/{BOT_MANUAL_MESSAGE_MAX_LENGTH}
          </div>
        </div>

        {!recipient && botActive && (
          <p className="text-sm text-muted-foreground">
            {t("admin.bots.send.noRecipient")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSubmit}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {sending
              ? t("admin.bots.send.sending")
              : t("admin.bots.send.submit")}
          </Button>

          {lastSent && (
            <Button asChild variant="outline">
              <Link href={`/messages/${lastSent.conversationId}`}>
                {t("admin.bots.send.openConversation")}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
