"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/locales/client";
import { useRouter } from "next/navigation";
import { CalendarDays, Mail, Shield, CheckCircle, XCircle } from "lucide-react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string | Date, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DashboardUser = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role?: string; // Add role property, optional for safety
};

type DashboardSession = {
  user?: DashboardUser;
  session?: {
    createdAt?: string | Date;
  };
};

export default function DashboardPage() {
  const t = useI18n();
  const { data: session, isPending } = useSession() as { data: DashboardSession; isPending: boolean };
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/signin");
        },
      },
    });
  };

  if (isPending) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  const user = session?.user;
  const currentSession = session?.session;
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
          <Button variant="outline" onClick={handleSignOut}>
            {t("dashboard.signOut")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
                <AvatarFallback className="text-lg">
                  {getInitials(user?.name || t("dashboard.guest"))}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {t("dashboard.welcome", { name: user?.name || t("dashboard.guest") })}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("dashboard.account")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{user?.email}</span>
                  {user?.emailVerified ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t("dashboard.emailVerified")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0 gap-1">
                      <XCircle className="h-3 w-3" />
                      {t("dashboard.emailNotVerified")}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t("dashboard.role")}</span>
                <Badge variant="outline" className="ml-auto">
                  {user?.role ?? "USER"}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t("dashboard.memberSince")}</span>
                <span className="ml-auto text-sm">
                  {user?.createdAt ? formatDate(user.createdAt, locale) : t("dashboard.unknown")}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("dashboard.session")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {t("dashboard.sessionStarted")}
                </span>
                <span className="ml-auto text-sm">
                  {currentSession?.createdAt
                    ? formatDate(currentSession.createdAt, locale)
                    : t("dashboard.unknown")}
                </span>
              </div>



            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
