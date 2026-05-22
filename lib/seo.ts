import type { Metadata } from "next";

const FALLBACK_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_URL;
  return url.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path) return base;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function localeAlternates(path: string = "/"): Metadata["alternates"] {
  const base = getSiteUrl();
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `${base}${normalized || "/"}`,
    languages: {
      en: `${base}${normalized || "/"}`,
      fr: `${base}/fr${normalized}`,
      "x-default": `${base}${normalized || "/"}`,
    },
  };
}

export const SITE_DEFAULTS = {
  name: "BlogTonioCode",
  twitterHandle: "@BlogTonioCode",
} as const;
