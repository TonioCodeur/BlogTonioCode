"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/locales/client";
import {
  searchUsersForMessaging,
  getOrCreateConversation,
} from "@/lib/actions/messaging";
import type { MessagingUserSummary } from "@/lib/messaging-types";
import { toast } from "sonner";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function NewConversationClient() {
  const t = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessagingUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const debounced = useDebounce(query, 300);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (debounced.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await searchUsersForMessaging({ query: debounced.trim() });
        if (!cancelled && res.ok) {
          setResults(res.users);
        }
      } catch {
        if (!cancelled) toast.error(t("messages.errors.generic"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced, t]);

  async function handleStart(userId: string) {
    setStartingId(userId);
    try {
      const result = await getOrCreateConversation({ recipientUserId: userId });
      if (result.ok) {
        router.push(`/messages/${result.conversationId}`);
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
        setStartingId(null);
      }
    } catch {
      toast.error(t("messages.errors.generic"));
      setStartingId(null);
    }
  }

  const showEmpty = useMemo(
    () => !loading && debounced.trim().length >= 2 && results.length === 0,
    [loading, debounced, results],
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label={t("messages.thread.back")}>
            <Link href="/messages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t("messages.new.title")}</h1>
            <p className="text-muted-foreground">{t("messages.new.description")}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("messages.new.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label={t("messages.new.searchPlaceholder")}
            autoFocus
          />
        </div>

        {showEmpty && (
          <Card>
            <CardHeader>
              <CardTitle>{t("messages.new.empty")}</CardTitle>
              <CardDescription>{t("messages.new.description")}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((user) => {
              const name = user.name ?? user.email;
              return (
                <li key={user.id}>
                  <Card>
                    <CardContent className="flex items-center gap-3 p-3">
                      <Avatar size="lg">
                        <AvatarImage src={user.image ?? undefined} alt={name} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      <Button
                        onClick={() => handleStart(user.id)}
                        disabled={startingId === user.id}
                      >
                        {startingId === user.id
                          ? t("messages.new.starting")
                          : t("messages.new.start")}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [state, setState] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setState(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return state;
}
