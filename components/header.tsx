import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getI18n } from "@/locales/server";
import { ModeToggle } from "./mode-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { AuthButtons } from "./auth/auth-buttons";

export async function Header() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const t = await getI18n();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 38 38"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="19"
              cy="19"
              r="18"
              className="fill-primary"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M13 25L25 13M15 13H25V23"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dark:stroke-background"
            />
          </svg>
          <span className="text-xl font-bold tracking-tight">
            Ship<span className="text-muted-foreground">Stack</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6 text-sm">
          <Link
            href="#features"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.features")}
          </Link>
          <Link
            href="#stack"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.stack")}
          </Link>
          <Link
            href="#pricing"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.pricing")}
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          <LanguageSwitcher />
          <ModeToggle />
          <AuthButtons isAuthenticated={!!session} />
        </div>
      </div>
    </header>
  );
}
