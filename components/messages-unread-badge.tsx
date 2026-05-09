"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/locales/client";
import { getUnreadCount } from "@/lib/actions/messaging";

const POLL_INTERVAL_MS = 15_000;

/**
 * Polls the server for the current unread message count and
 * renders a small badge. Renders nothing when count is 0.
 */
export function MessagesUnreadBadge() {
  const t = useI18n();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const result = await getUnreadCount();
        if (!cancelled && result.ok) {
          setCount(result.count);
        }
      } catch {
        // Silent fail — next poll will retry
      }
    }

    void fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;

  const label = count > 9 ? t("messages.badge.ninePlus") : String(count);

  return (
    <Badge
      aria-label={t("messages.inbox.unreadBadge", { count })}
      className="ml-auto h-5 min-w-5 justify-center px-1.5 text-xs"
    >
      {label}
    </Badge>
  );
}

/**
 * Standalone notification dot polled on the same cadence as the badge.
 * Rendered overlaid on the sidebar's MessageSquare icon to make unread
 * messages obvious even when the menu is collapsed and the count badge
 * is hidden.
 */
export function MessagesUnreadDot() {
  const t = useI18n();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const result = await getUnreadCount();
        if (!cancelled && result.ok) {
          setCount(result.count);
        }
      } catch {
        // Silent fail — next poll will retry
      }
    }

    void fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      aria-label={t("messages.nav.unread")}
      className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar"
    />
  );
}
