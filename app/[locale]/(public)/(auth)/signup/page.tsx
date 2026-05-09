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

export default function SignUpPage() {
  const t = useI18n();
  const [, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("signUp.title")}</CardTitle>
          <CardDescription>{t("signUp.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButtons
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            separatorText={t("signUp.orContinueWith")}
          />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("signUp.hasAccount")}{" "}
            <Link href="/signin" className="text-primary hover:underline">
              {t("signUp.signInLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
