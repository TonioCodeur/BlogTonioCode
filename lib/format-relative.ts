/**
 * Minimal relative time formatter using Intl.RelativeTimeFormat.
 * Suitable for inbox "last message" timestamps.
 */
export function formatRelativeTime(
  input: string | Date,
  locale: string = "en",
  now: Date = new Date(),
): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absSeconds < 60) return rtf.format(diffSeconds, "second");
  if (absSeconds < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (absSeconds < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (absSeconds < 604800) return rtf.format(Math.round(diffSeconds / 86400), "day");
  if (absSeconds < 2629800) return rtf.format(Math.round(diffSeconds / 604800), "week");
  if (absSeconds < 31557600) return rtf.format(Math.round(diffSeconds / 2629800), "month");
  return rtf.format(Math.round(diffSeconds / 31557600), "year");
}

export function truncate(text: string, max: number = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "\u2026";
}
