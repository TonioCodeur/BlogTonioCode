import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Brain, Code2, GitBranch, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getI18n, getCurrentLocale } from "@/locales/server";
import { getSiteUrl, localeAlternates, SITE_DEFAULTS } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const siteUrl = getSiteUrl();
  const title = t("about.meta.title");
  const description = t("about.meta.description");
  const url = locale === "fr" ? `${siteUrl}/fr/about` : `${siteUrl}/about`;

  return {
    title,
    description,
    alternates: localeAlternates("/about"),
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: t("meta.ogSiteName"),
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AboutPage() {
  const t = await getI18n();
  const locale = await getCurrentLocale();
  const siteUrl = getSiteUrl();
  const pageUrl = locale === "fr" ? `${siteUrl}/fr/about` : `${siteUrl}/about`;

  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: t("about.meta.title"),
    description: t("about.meta.description"),
    url: pageUrl,
    inLanguage: locale === "fr" ? "fr-FR" : "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_DEFAULTS.name,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_DEFAULTS.name,
      url: siteUrl,
    },
  };

  const pillars = [
    {
      icon: Code2,
      title: t("about.pillars.devNews.title"),
      description: t("about.pillars.devNews.description"),
    },
    {
      icon: Brain,
      title: t("about.pillars.aiNews.title"),
      description: t("about.pillars.aiNews.description"),
    },
    {
      icon: BookOpen,
      title: t("about.pillars.education.title"),
      description: t("about.pillars.education.description"),
    },
  ];

  const values = [
    {
      icon: Sparkles,
      title: t("about.values.practical.title"),
      description: t("about.values.practical.description"),
    },
    {
      icon: Heart,
      title: t("about.values.honest.title"),
      description: t("about.values.honest.description"),
    },
    {
      icon: GitBranch,
      title: t("about.values.openSource.title"),
      description: t("about.values.openSource.description"),
    },
  ];

  return (
    <div className="relative overflow-hidden bg-dots glow-halo">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />

      {/* Hero */}
      <section className="container mx-auto px-6 py-16 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="hud-tag hud-tag-accent">
            <span className="hud-tag-dot" />
            {t("about.hero.badge")}
          </span>

          <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {t("about.hero.title")}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t("about.hero.description")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="btn-glow rounded-full px-6">
              <Link href="/blog">
                {t("about.hero.ctaPosts")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/categories">{t("about.hero.ctaCategories")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="container mx-auto px-6 py-12 lg:px-10">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t("about.pillars.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {t("about.pillars.subtitle")}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div
                className="mb-4 grid h-11 w-11 place-items-center rounded-lg text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent-rgb-2)))",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto border-t border-border/40 px-6 py-12 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t("about.values.title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("about.values.subtitle")}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {values.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-xl border border-border/60 bg-card/60 p-6"
            >
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-mono uppercase tracking-[0.18em]">{title}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16 lg:px-10">
        <div
          className="relative overflow-hidden rounded-2xl border p-8 text-center sm:p-12"
          style={{
            background:
              "linear-gradient(180deg, rgba(var(--accent-rgb) / 0.10), rgba(var(--accent-rgb-2) / 0.06))",
            borderColor: "rgba(var(--accent-rgb) / 0.25)",
          }}
        >
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t("about.cta.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t("about.cta.description")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="btn-glow rounded-full px-6">
              <Link href="/blog">
                {t("about.cta.readPosts")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/categories">{t("about.cta.browseCategories")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
