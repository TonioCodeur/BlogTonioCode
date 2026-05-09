"use client";

import { useState, useTransition } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useI18n } from "@/locales/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User,
  KeyRound,
  CreditCard,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { updateName, changePassword, deleteOwnAccount } from "@/app/actions/user";

export default function SettingsPage() {
  const t = useI18n();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  // Name form
  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [isUpdatingName, startNameTransition] = useTransition();

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, startPasswordTransition] = useTransition();

  // Delete account
  const [isDeleting, startDeleteTransition] = useTransition();

  // Lemon Squeezy
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Initialize name from session
  if (session?.user?.name && !nameInitialized) {
    setName(session.user.name);
    setNameInitialized(true);
  }

  const user = session?.user;
  const userRole = (user as { role?: string } | undefined)?.role ?? "USER";
  const isUser = userRole === "USER";

  if (sessionLoading) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const handleUpdateName = () => {
    startNameTransition(async () => {
      const result = await updateName(name.trim());
      if (result.success) {
        toast.success(t("settings.nameUpdated"));
      } else {
        toast.error(result.error ?? t("admin.genericError"));
      }
    });
  };

  const handleChangePassword = () => {
    startPasswordTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        toast.success(t("settings.passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(result.error ?? t("admin.genericError"));
      }
    });
  };

  const handleDeleteAccount = () => {
    startDeleteTransition(async () => {
      const result = await deleteOwnAccount();
      if (result.success) {
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/signin");
            },
          },
        });
      } else {
        toast.error(result.error ?? t("admin.genericError"));
      }
    });
  };

  const handleLemonSqueezyCheckout = () => {
    const checkoutUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;
    if (!checkoutUrl) {
      toast.error("Payment is not configured yet.");
      return;
    }
    setIsRedirecting(true);
    window.location.href = checkoutUrl;
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("settings.description")}</p>
        </div>

        {/* ── General: Update Name ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" />
              {t("settings.updateName")}
            </CardTitle>
            <CardDescription>{t("settings.updateNameDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="name">{t("settings.updateName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.namePlaceholder")}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Button
              onClick={handleUpdateName}
              disabled={isUpdatingName || !name.trim() || name.trim() === user?.name}
            >
              {isUpdatingName ? t("settings.saving") : t("settings.save")}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Security: Change Password ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t("settings.changePassword")}
            </CardTitle>
            <CardDescription>{t("settings.changePasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Button
              onClick={handleChangePassword}
              disabled={isUpdatingPassword || !currentPassword || !newPassword}
            >
              {isUpdatingPassword ? t("settings.updatingPassword") : t("settings.updatePassword")}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Billing: Lemon Squeezy ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {t("settings.billing")}
            </CardTitle>
            <CardDescription>{t("settings.upgradeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isUser ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("settings.upgrade")}
                </p>
                <Button onClick={handleLemonSqueezyCheckout} disabled={isRedirecting}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isRedirecting ? t("settings.upgradeLoading") : t("settings.upgradeCta")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t("settings.alreadyCustomer")}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* ── Danger Zone: Delete Account ── */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              {t("settings.dangerZone")}
            </CardTitle>
            <CardDescription>{t("settings.deleteAccountDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("settings.deleteAccountButton")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.deleteAccountConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.deleteAccountConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("settings.deleteAccountConfirmCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting
                      ? t("settings.deleteAccountDeleting")
                      : t("settings.deleteAccountConfirmButton")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
