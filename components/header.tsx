import { headers } from "next/headers";
import Link from "next/link";
import { Code2 } from "lucide-react";
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Code2 className="h-5 w-5" />
          </span>
          <span className="font-mono text-lg font-bold tracking-tight">
            Blog<span className="text-primary">Tonio</span>Code
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.articles")}
          </Link>
          <Link
            href="/categories"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.categories")}
          </Link>
          <Link
            href="/about"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.about")}
          </Link>
        </nav>

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
