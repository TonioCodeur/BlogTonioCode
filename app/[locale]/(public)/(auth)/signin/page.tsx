"use client";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/locales/client";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const t = useI18n();
  const [, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("signIn.title")}</CardTitle>
          <CardDescription>{t("signIn.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButtons
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            separatorText={t("signIn.orContinueWith")}
          />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("signIn.noAccount")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("signIn.signUpLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
