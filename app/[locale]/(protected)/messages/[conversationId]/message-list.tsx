"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/locales/client";
import { getMessages } from "@/lib/actions/messaging";
import type { MessageData } from "@/lib/messaging-types";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const POLL_INTERVAL_MS = 12_000;

type Props = {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageData[];
  initialHasMore: boolean;
};

/**
 * Returns the ISO string of a date-like value (string | Date).
 */
function toIso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

/**
 * Merges an incoming batch of messages into the existing list, keeping the
 * chronological ASC order and de-duplicating by id. New messages override
 * existing ones so soft-delete / edit updates from the server propagate.
 */
function mergeMessages(
  existing: MessageData[],
  incoming: MessageData[],
): MessageData[] {
  const byId = new Map<string, MessageData>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(toIso(a.createdAt)).getTime() - new Date(toIso(b.createdAt)).getTime(),
  );
}

export function MessageList({
  conversationId,
  currentUserId,
  initialMessages,
  initialHasMore,
}: Props) {
  const t = useI18n();
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef<number>(initialMessages.length);

  // Oldest message is the pagination cursor for "load more".
  const nextCursor = useMemo<string | null>(() => {
    if (!hasMore || messages.length === 0) return null;
    return toIso(messages[0].createdAt);
  }, [messages, hasMore]);

  // Auto-scroll to bottom on mount and when a new message arrives at the tail.
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      lastCountRef.current = messages.length;
    }
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  /**
   * Polls only the most recent page and merges into the existing list. This
   * preserves any older messages already fetched via "load more".
   */
  const refresh = useCallback(async () => {
    try {
      const result = await getMessages({ conversationId });
      if (result.ok) {
        setMessages((prev) => mergeMessages(prev, result.messages));
      }
    } catch {
      // Silent fail — polling will try again
    }
  }, [conversationId]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const handleDeleted = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deletedAt: new Date().toISOString(), content: "" }
          : m,
      ),
    );
  }, []);

  /**
   * Loads an older page and prepends it. Preserves the user's scroll position
   * by measuring scrollHeight before the DOM update and restoring the delta
   * after the paint.
   */
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    const root = scrollWrapperRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const previousScrollHeight = root?.scrollHeight ?? 0;
    const previousScrollTop = root?.scrollTop ?? 0;

    setLoadingMore(true);
    try {
      const result = await getMessages({ conversationId, cursor: nextCursor });
      if (result.ok) {
        setMessages((prev) => mergeMessages(prev, result.messages));
        setHasMore(result.hasMore);
        // Preserve scroll position: scrollTop stays aligned to the same visual
        // anchor after the prepended content inflates scrollHeight.
        requestAnimationFrame(() => {
          if (!root) return;
          const delta = root.scrollHeight - previousScrollHeight;
          root.scrollTop = previousScrollTop + delta;
        });
      }
    } catch {
      // Silent fail; user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, nextCursor]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t("messages.thread.empty")}
      </div>
    );
  }

  return (
    <div ref={scrollWrapperRef} className="flex flex-1 min-h-0">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {t("messages.thread.loadMore")}
              </Button>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              currentUserId={currentUserId}
              onDeleted={handleDeleted}
            />
          ))}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </ScrollArea>
    </div>
  );
}
