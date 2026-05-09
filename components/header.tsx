import { headers } from "next/headers";
import Link from "next/link";
import { Search, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { getI18n } from "@/locales/server";
import { ModeToggle } from "./mode-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { AuthButtons } from "./auth/auth-buttons";
import { NewContentMenu } from "./blog/new-content-menu";

export async function Header() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const t = await getI18n();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center gap-5 px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent-rgb-2)))",
              boxShadow:
                "0 0 calc(28px * var(--glow)) rgba(var(--accent-rgb) / calc(0.7 * var(--glow))), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Zap className="h-[17px] w-[17px]" fill="currentColor" />
          </span>
          <span className="font-display text-lg font-bold tracking-[-0.02em]">
            BlogTonio<span className="grad-text">.code</span>
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-5 text-[13.5px] md:flex">
          <Link
            href="/blog"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.articles")}
          </Link>
          <Link
            href="/categories"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.categories")}
          </Link>
          {session ? (
            <Link
              href="/blog/new"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.write")}
            </Link>
          ) : null}
          <Link
            href="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.about")}
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="hidden h-10 min-w-[260px] items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[12.5px] text-muted-foreground lg:flex">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">{t("nav.searchPlaceholder")}</span>
          <kbd className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-2">
          {session ? <NewContentMenu /> : null}
          <LanguageSwitcher />
          <ModeToggle />
          <AuthButtons isAuthenticated={!!session} />
        </div>
      </div>
    </header>
  );
}
