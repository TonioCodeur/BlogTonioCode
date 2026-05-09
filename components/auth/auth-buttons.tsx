"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { useI18n } from "@/locales/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AuthButtonsProps {
  isAuthenticated: boolean;
}

export function AuthButtons({ isAuthenticated }: AuthButtonsProps) {
  const t = useI18n();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  if (isAuthenticated) {
    return (
      <>
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link href="/dashboard">{t("auth.dashboard")}</Link>
        </Button>
        <Button variant="default" onClick={handleSignOut}>
          {t("auth.signOut")}
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" asChild className="hidden sm:inline-flex">
        <Link href="/signin">{t("auth.signIn")}</Link>
      </Button>
      <Button asChild>
        <Link href="/signup">{t("auth.signUp")}</Link>
      </Button>
    </>
  );
}
