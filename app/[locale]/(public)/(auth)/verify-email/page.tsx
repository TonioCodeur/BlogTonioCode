"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useI18n } from "@/locales/client";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function VerifyEmailContent() {
  const t = useI18n();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resending, setResending] = useState(false);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });
      toast.success(t("verifyEmail.resent"));
    } catch {
      toast.error(t("verifyEmail.resendError"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("verifyEmail.title")}</CardTitle>
          <CardDescription>
            {t("verifyEmail.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <p className="text-sm font-medium">{email}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {t("verifyEmail.checkSpam")}
          </p>
          {email && (
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending ? t("verifyEmail.resending") : t("verifyEmail.resend")}
            </Button>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            <Link href="/signin" className="text-primary hover:underline">
              {t("verifyEmail.backToSignIn")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
