import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/locales/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Shield,
  CheckCircle,
  XCircle,
  KeyRound,
  Link2,
} from "lucide-react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getProviderLabel(providerId: string): string {
  const labels: Record<string, string> = {
    github: "GitHub",
    google: "Google",
    apple: "Apple",
    microsoft: "Microsoft",
    facebook: "Facebook",
    credential: "Email/Password",
  };
  return labels[providerId] ?? providerId;
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "destructive" as const;
    case "ADMIN":
      return "default" as const;
    case "MODERATOR":
      return "secondary" as const;
    case "CUSTOMER":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default async function ProfilePage() {
  const t = await getI18n();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      accounts: {
        select: {
          providerId: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/signin");
  }

  const locale = "en"; // Will be resolved by next-international
  const hasPassword = user.accounts.some((a) => a.providerId === "credential");
  const oauthAccounts = user.accounts.filter((a) => a.providerId !== "credential");

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("profile.description")}</p>
        </div>

        {/* Header card with avatar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="text-xl">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">{user.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  {user.emailVerified ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t("profile.verified")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      {t("profile.notVerified")}
                    </Badge>
                  )}
                </div>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("profile.accountInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("profile.name")}</span>
                <span className="text-sm font-medium">{user.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("profile.email")}</span>
                <span className="text-sm font-medium truncate ml-4">{user.email}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("profile.role")}</span>
                <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("profile.memberSince")}</span>
                <span className="text-sm">{formatDate(user.createdAt, locale)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("profile.lastUpdated")}</span>
                <span className="text-sm">{formatDate(user.updatedAt, locale)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Security & Access */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("profile.securityInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasPassword && (
                <>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {t("profile.hasPassword")}
                      </span>
                    </div>
                    <Badge variant="secondary">{t("profile.enabled")}</Badge>
                  </div>
                  {oauthAccounts.length > 0 && <Separator />}
                </>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("profile.linkedAccounts")}
                  </span>
                </div>
                {oauthAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {oauthAccounts.map((account) => (
                      <div
                        key={account.providerId}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm font-medium">
                          {getProviderLabel(account.providerId)}
                        </span>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("profile.noLinkedAccounts")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
