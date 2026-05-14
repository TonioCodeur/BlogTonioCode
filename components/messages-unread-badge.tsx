"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/locales/client";
import { getUnreadCount } from "@/lib/actions/messaging";
import { queryKeys } from "@/lib/queries";

const POLL_INTERVAL_MS = 15_000;

function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.messages.unreadCount(),
    queryFn: async () => {
      const result = await getUnreadCount();
      return result.ok ? result.count : 0;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}

/**
 * Polls the server for the current unread message count and
 * renders a small badge. Renders nothing when count is 0.
 */
export function MessagesUnreadBadge() {
  const t = useI18n();
  const { data: count = 0 } = useUnreadCount();

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
 * Both consumers share the same query cache entry — only one request goes
 * out per poll interval.
 */
export function MessagesUnreadDot() {
  const t = useI18n();
  const { data: count = 0 } = useUnreadCount();

  if (count <= 0) return null;

  return (
    <span
      aria-label={t("messages.nav.unread")}
      className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar"
    />
  );
}
