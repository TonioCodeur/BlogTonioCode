import { getI18n } from "@/locales/server";
import { I18nProviderClient } from "@/locales/client";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { getSiteUrl, localeAlternates, SITE_DEFAULTS } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getI18n();
  const siteUrl = getSiteUrl();

  const title = t("meta.title");
  const description = t("meta.description");
  const keywords = t("meta.keywords");
  const siteName = t("meta.ogSiteName");
  const titleTemplate = t("meta.titleTemplate");

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    applicationName: SITE_DEFAULTS.name,
    authors: [{ name: SITE_DEFAULTS.name, url: siteUrl }],
    creator: SITE_DEFAULTS.name,
    publisher: SITE_DEFAULTS.name,
    alternates: localeAlternates("/"),
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: siteUrl,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      alternateLocale: locale === "fr" ? ["en_US"] : ["fr_FR"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: "/favicon.ico",
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    category: "technology",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <I18nProviderClient locale={locale}>
      <QueryProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </QueryProvider>
    </I18nProviderClient>
  );
}
