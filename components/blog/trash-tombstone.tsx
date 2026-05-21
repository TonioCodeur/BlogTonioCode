"use client";

import { useI18n } from "@/locales/client";

type TombstoneState = "TRASHED" | "AUTHOR_DELETED";

type TrashTombstoneProps = {
  state: TombstoneState;
  /** When set and state is TRASHED, exposes the moderation reason (e.g. on author's dashboard). */
  reason?: string | null;
  className?: string;
};

/**
 * Inline placeholder for a Post/Comment that exists but is hidden because it is
 * either soft-deleted by its author or moved to the moderation trash.
 *
 * Keep the rendering minimal and structural so it does not break the surrounding
 * thread / list layout.
 */
export function TrashTombstone({ state, reason, className }: TrashTombstoneProps) {
  const t = useI18n();
  const label =
    state === "TRASHED"
      ? t("trash.authorView.moderated")
      : t("trash.authorView.authorDeleted");

  return (
    <div
      className={[
        "rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm italic text-muted-foreground",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
      aria-label={label}
    >
      <span>{label}</span>
      {state === "TRASHED" && reason ? (
        <span className="not-italic"> — {t("trash.authorView.moderatedReason", { reason })}</span>
      ) : null}
    </div>
  );
}
