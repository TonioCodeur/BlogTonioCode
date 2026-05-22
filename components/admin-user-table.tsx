"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import { toast } from "sonner";
import { deleteUser, changeUserRole } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Search,
  Shield,
  ShieldAlert,
  Gavel,
  History,
  Trash2,
} from "lucide-react";
import { SanctionDialog } from "@/app/[locale]/(protected)/admin/sanction-dialog";
import { UserSanctionsDialog } from "@/app/[locale]/(protected)/admin/user-sanctions-dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: string;
  _count: { sanctions: number };
};

const ALL_ROLES: readonly Role[] = [
  "USER",
  "CUSTOMER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

const ADMIN_ASSIGNABLE_ROLES: readonly Role[] = [
  "USER",
  "CUSTOMER",
  "MODERATOR",
] as const;

const ROLE_COLORS: Record<string, string> = {
  USER: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  CUSTOMER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MODERATOR:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ADMIN:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isAdminLikeRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminUserTable({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: AdminUser[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const t = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sanctionTarget, setSanctionTarget] = useState<AdminUser | null>(null);
  const [sanctionsTarget, setSanctionsTarget] = useState<AdminUser | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
  const isAdmin = currentUserRole === "ADMIN";
  const isModerator = currentUserRole === "MODERATOR";

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  // ─── Error mapping (server → i18n) ────────────────────────────────────────

  // Maps known back-end error strings (English, hard-coded server-side) onto
  // localized keys. Falls back to a generic error message.
  function mapServerError(error: string): string {
    switch (error) {
      case "Cannot change your own role":
        return t("admin.role.errors.selfChange");
      case "Admins cannot modify other admins or super admins":
        return t("admin.role.errors.targetIsAdmin");
      case "Admins cannot grant ADMIN or SUPER_ADMIN role":
      // Tolerate older wording in case back is rolled back.
      case "Admins cannot promote users to admin roles":
        return t("admin.role.errors.cannotGrantAdmin");
      case "User not found":
        return t("admin.role.errors.userNotFound");
      case "Forbidden":
        return t("admin.role.errors.forbidden");
      case "Unauthorized":
        return t("admin.role.errors.unauthorized");
      default:
        return t("admin.genericError");
    }
  }

  // ─── Delete handler (keeps current throw pattern) ─────────────────────────

  const handleDelete = (user: AdminUser) => {
    setDeletingId(user.id);
    startTransition(async () => {
      try {
        await deleteUser({ userId: user.id });
        toast.success(t("admin.user.deleted"));
        setDeleteTarget(null);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        toast.error(t("admin.deleteError"), {
          description: message,
        });
      } finally {
        setDeletingId(null);
      }
    });
  };

  // ─── Role change handler (ActionResult pattern) ───────────────────────────

  const handleRoleChange = (userId: string, newRole: string) => {
    setChangingRoleId(userId);
    startTransition(async () => {
      const result = await changeUserRole({
        userId,
        newRole: newRole as Role,
      });
      if (result.success) {
        toast.success(t("admin.role.updated"));
        router.refresh();
      } else {
        toast.error(mapServerError(result.error));
      }
      setChangingRoleId(null);
    });
  };

  // ─── Per-row capability resolution ────────────────────────────────────────

  function canEditRole(target: AdminUser): boolean {
    if (target.id === currentUserId) return false;
    if (isSuperAdmin) return true;
    if (isAdmin) {
      // ADMIN cannot touch ADMIN / SUPER_ADMIN rows.
      return !isAdminLikeRole(target.role);
    }
    // MODERATOR or anyone else → read-only badges.
    return false;
  }

  function canSanction(target: AdminUser): boolean {
    if (target.id === currentUserId) return false;
    if (!isModerator && !isAdmin && !isSuperAdmin) return false;
    // Sanctioning ADMIN/SUPER_ADMIN is reserved to SUPER_ADMIN.
    if (isAdminLikeRole(target.role) && !isSuperAdmin) return false;
    return true;
  }

  function canDelete(target: AdminUser): boolean {
    if (!isSuperAdmin) return false;
    if (target.id === currentUserId) return false;
    if (target.role === "SUPER_ADMIN") return false;
    return true;
  }

  // Options offered in the role dropdown depend on caller. For ADMIN we only
  // ever render USER/CUSTOMER/MODERATOR; the higher roles are never available
  // as a Select option (defence in depth — back enforces the same).
  function roleOptionsFor(): readonly Role[] {
    if (isSuperAdmin) return ALL_ROLES;
    if (isAdmin) return ADMIN_ASSIGNABLE_ROLES;
    return [];
  }

  return (
    <>
      <div className="space-y-4">
        {/* ─── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("admin.description", { count: users.length })}
            </p>
            {isModerator ? (
              <p className="mt-1 text-xs italic text-muted-foreground">
                {t("admin.access.moderatorView")}
              </p>
            ) : null}
          </div>
        </div>

        {/* ─── Search + count ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("admin.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="ml-auto">
            {filtered.length} {t("admin.table.users")}
          </Badge>
        </div>

        {/* ─── Table ────────────────────────────────────────────────────── */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>{t("admin.table.name")}</TableHead>
                <TableHead>{t("admin.table.email")}</TableHead>
                <TableHead>{t("admin.table.role")}</TableHead>
                <TableHead>{t("admin.table.verified")}</TableHead>
                <TableHead>{t("admin.table.joined")}</TableHead>
                <TableHead className="text-center">
                  {t("admin.table.sanctions")}
                </TableHead>
                <TableHead className="text-right">
                  {t("admin.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t("admin.noUsers")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const showRoleSelect = canEditRole(user);
                  const showSanction = canSanction(user);
                  const showDelete = canDelete(user);

                  return (
                    <TableRow key={user.id}>
                      {/* Avatar */}
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={user.image ?? undefined}
                            alt={user.name}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>

                      {/* Name */}
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          {isCurrentUser ? (
                            <span className="text-xs text-muted-foreground">
                              {t("admin.you")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Email + verified icon */}
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{user.email}</span>
                          {user.emailVerified ? (
                            <CheckCircle
                              className="h-3.5 w-3.5 text-green-500"
                              aria-label={t("admin.table.verified")}
                            />
                          ) : (
                            <XCircle
                              className="h-3.5 w-3.5 text-destructive"
                              aria-label={t("admin.table.verified")}
                            />
                          )}
                        </div>
                      </TableCell>

                      {/* Role — Select for callers with rights, Badge otherwise */}
                      <TableCell>
                        {showRoleSelect ? (
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, value)
                            }
                            disabled={isPending && changingRoleId === user.id}
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptionsFor().map((role) => (
                                <SelectItem key={role} value={role}>
                                  <Badge
                                    variant="secondary"
                                    className={`pointer-events-none ${ROLE_COLORS[role] ?? ""}`}
                                  >
                                    {role}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={ROLE_COLORS[user.role] ?? ""}
                          >
                            <Shield className="mr-1 h-3 w-3" />
                            {user.role}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Verified (compact icon column) */}
                      <TableCell>
                        {user.emailVerified ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>

                      {/* Joined */}
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>

                      {/* Sanctions count */}
                      <TableCell className="text-center">
                        {user._count.sanctions > 0 ? (
                          <Badge variant="destructive">
                            {user._count.sanctions}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            0
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Sanction history — visible to all admin-like callers, even on own row */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSanctionsTarget(user)}
                            title={t("admin.sanctions.title")}
                            aria-label={t("admin.sanctions.title")}
                          >
                            <History className="h-4 w-4" />
                          </Button>

                          {/* Issue sanction */}
                          {showSanction ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSanctionTarget(user)}
                              title={t("admin.sanction.title")}
                              aria-label={t("admin.sanction.title")}
                            >
                              <Gavel className="h-4 w-4" />
                            </Button>
                          ) : null}

                          {/* Delete user — SUPER_ADMIN only */}
                          {showDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(user)}
                              disabled={
                                isPending && deletingId === user.id
                              }
                              title={t("admin.user.delete")}
                              aria-label={t("admin.user.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── Sanction dialog ────────────────────────────────────────────── */}
      {sanctionTarget ? (
        <SanctionDialog
          user={sanctionTarget}
          open={!!sanctionTarget}
          onClose={() => setSanctionTarget(null)}
        />
      ) : null}

      {/* ─── Sanction history dialog ────────────────────────────────────── */}
      {sanctionsTarget ? (
        <UserSanctionsDialog
          user={sanctionsTarget}
          open={!!sanctionsTarget}
          onClose={() => setSanctionsTarget(null)}
        />
      ) : null}

      {/* ─── Delete confirmation ────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.confirmDelete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("admin.confirmDelete.description", {
                    name: deleteTarget.name,
                    email: deleteTarget.email,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={!!(isPending && deletingId === deleteTarget?.id)}
            >
              {t("admin.confirmDelete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) handleDelete(deleteTarget);
              }}
              disabled={!!(isPending && deletingId === deleteTarget?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && deletingId === deleteTarget?.id
                ? t("admin.confirmDelete.deleting")
                : t("admin.confirmDelete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
