"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChangeLocale, useCurrentLocale, useI18n } from "@/locales/client";

const locales = [
  { code: "en" as const, flag: "🇬🇧" },
  { code: "fr" as const, flag: "🇫🇷" },
] as const;

export function LanguageSwitcher() {
  const t = useI18n();
  const currentLocale = useCurrentLocale();
  const changeLocale = useChangeLocale();

  const currentFlag = locales.find((l) => l.code === currentLocale)?.flag;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("language.label")}>
          <span className="text-base leading-none">{currentFlag}</span>
          <span className="sr-only">{t("language.label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => changeLocale(locale.code)}
            className={currentLocale === locale.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{locale.flag}</span>
            {t(`language.${locale.code}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
