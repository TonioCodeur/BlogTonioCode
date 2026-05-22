import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/seo";

const LOCALES = ["en", "fr"] as const;
type Locale = (typeof LOCALES)[number];

function localizedUrl(base: string, locale: Locale, path: string): string {
  const cleanPath = path === "/" ? "" : path;
  return locale === "en" ? `${base}${cleanPath || "/"}` : `${base}/fr${cleanPath}`;
}

function buildAlternates(base: string, path: string): Record<string, string> {
  return {
    en: localizedUrl(base, "en", path),
    fr: localizedUrl(base, "fr", path),
    "x-default": localizedUrl(base, "en", path),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticPaths: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/blog", changeFrequency: "daily", priority: 0.9 },
    { path: "/categories", changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap(
    ({ path, changeFrequency, priority }) =>
      LOCALES.map((locale) => ({
        url: localizedUrl(base, locale, path),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages: buildAlternates(base, path) },
      })),
  );

  const [posts, categories] = await Promise.all([
    prisma.post
      .findMany({
        where: { published: true, trashedAt: null, deletedAt: null },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 5000,
      })
      .catch(() => []),
    prisma.category
      .findMany({
        where: { trashedAt: null, deletedAt: null },
        select: { slug: true, updatedAt: true },
        take: 1000,
      })
      .catch(() => []),
  ]);

  const postEntries: MetadataRoute.Sitemap = posts.flatMap((post) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(base, locale, `/blog/${post.slug}`),
      lastModified: post.updatedAt ?? post.publishedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: { languages: buildAlternates(base, `/blog/${post.slug}`) },
    })),
  );

  const categoryEntries: MetadataRoute.Sitemap = categories.flatMap((category) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(base, locale, `/categories/${category.slug}`),
      lastModified: category.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      alternates: { languages: buildAlternates(base, `/categories/${category.slug}`) },
    })),
  );

  return [...staticEntries, ...postEntries, ...categoryEntries];
}
