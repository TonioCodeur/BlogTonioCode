import { getI18n } from "@/locales/server";
import { I18nProviderClient } from "@/locales/client";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // params must be awaited before getI18n so the locale cookie is set
  await params;
  const t = await getI18n();

  return {
    title: t("meta.title"),
    description: t("meta.description"),
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
