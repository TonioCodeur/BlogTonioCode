"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import { toast } from "sonner";
import { deleteUser, changeUserRole } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Trash2, ShieldAlert } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: Date;
};

const ALL_ROLES = ["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

// ─── Helpers ──────────────────────────────────────���──────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "destructive" as const;
    case "ADMIN":
      return "default" as const;
    case "MODERATOR":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

// ─── Component ────────────��──────────────────────────────��───────────────────

export function AdminUserTable({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: User[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const t = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
  const isAdmin = currentUserRole === "ADMIN";

  // ─── Delete handler ──────────────────────────────────────────────────────

  const handleDelete = (userId: string) => {
    setDeletingId(userId);
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.success) {
        toast.success(t("admin.deleteSuccess"));
        router.refresh();
      } else {
        toast.error(t("admin.deleteError"), {
          description: result.error,
        });
      }
      setDeletingId(null);
    });
  };

  // ─── Role change handler ────────────────────��────────────────────────────

  const handleRoleChange = (userId: string, newRole: string) => {
    setChangingRoleId(userId);
    startTransition(async () => {
      const result = await changeUserRole(userId, newRole);
      if (result.success) {
        toast.success(t("admin.role.updated"));
        router.refresh();
      } else {
        toast.error(t("admin.genericError"), {
          description: result.error,
        });
      }
      setChangingRoleId(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.description", { count: users.length })}
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>{t("admin.table.name")}</TableHead>
              <TableHead>{t("admin.table.email")}</TableHead>
              <TableHead>{t("admin.table.role")}</TableHead>
              <TableHead>{t("admin.table.verified")}</TableHead>
              <TableHead>{t("admin.table.joined")}</TableHead>
              <TableHead className="w-20">{t("admin.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isTargetAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

              // SUPER_ADMIN can change any user's role (except their own)
              // ADMIN can change roles of non-admin users only
              const canChangeRole =
                !isCurrentUser &&
                (isSuperAdmin || (isAdmin && !isTargetAdmin));

              const canDelete = isSuperAdmin && !isCurrentUser && user.role !== "SUPER_ADMIN";

              return (
                <TableRow key={user.id}>
                  {/* Avatar */}
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image ?? undefined} alt={user.name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>

                  {/* Name */}
                  <TableCell className="font-medium">
                    {user.name}
                    {isCurrentUser && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {t("admin.you")}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Email */}
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>

                  {/* Role — Select or Badge */}
                  <TableCell>
                    {canChangeRole ? (
                      <Select
                        defaultValue={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={isPending && changingRoleId === user.id}
                      >
                        <SelectTrigger className="w-[150px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES
                            .filter((role) =>
                              // ADMIN cannot assign ADMIN or SUPER_ADMIN roles
                              isSuperAdmin ? true : !["ADMIN", "SUPER_ADMIN"].includes(role)
                            )
                            .map((role) => (
                            <SelectItem key={role} value={role}>
                              <Badge
                                variant={getRoleBadgeVariant(role)}
                                className="pointer-events-none"
                              >
                                {role}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Verified */}
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

                  {/* Actions */}
                  <TableCell>
                    {canDelete ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={isPending && deletingId === user.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("admin.confirmDelete.title")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.confirmDelete.description", {
                                name: user.name,
                                email: user.email,
                              })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("admin.confirmDelete.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isPending && deletingId === user.id
                                ? t("admin.confirmDelete.deleting")
                                : t("admin.confirmDelete.confirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
