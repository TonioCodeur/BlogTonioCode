"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Gavel,
  History,
  Trash2,
} from "lucide-react";
import { changeUserRole, deleteUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import { SanctionDialog } from "./sanction-dialog";
import { UserSanctionsDialog } from "./user-sanctions-dialog";

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

const ROLES = ["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

const ROLE_COLORS: Record<string, string> = {
  USER: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  CUSTOMER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MODERATOR: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AdminUsersTable({
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
  const [search, setSearch] = useState("");
  const [sanctionTarget, setSanctionTarget] = useState<AdminUser | null>(null);
  const [sanctionsTarget, setSanctionsTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await changeUserRole({ userId, newRole: newRole as (typeof ROLES)[number] });
      toast.success(t("admin.role.updated"));
      router.refresh();
    } catch {
      toast.error(t("admin.genericError"));
    }
  }

  async function handleDelete(userId: string) {
    try {
      await deleteUser({ userId });
      toast.success(t("admin.user.deleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(t("admin.genericError"));
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.table.name")}</TableHead>
              <TableHead>{t("admin.table.email")}</TableHead>
              <TableHead>{t("admin.table.role")}</TableHead>
              <TableHead>{t("admin.table.joined")}</TableHead>
              <TableHead className="text-center">{t("admin.table.sanctions")}</TableHead>
              <TableHead className="text-right">{t("admin.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("admin.noUsers")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image ?? undefined} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.name}</span>
                        {user.id === currentUserId && (
                          <span className="text-xs text-muted-foreground">{t("admin.you")}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{user.email}</span>
                      {user.emailVerified ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {currentUserRole === "SUPER_ADMIN" && user.id !== currentUserId ? (
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleRoleChange(user.id, v)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={ROLE_COLORS[user.role] ?? ""}>
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>

                  <TableCell className="text-center">
                    {user._count.sanctions > 0 ? (
                      <Badge variant="destructive">{user._count.sanctions}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSanctionsTarget(user)}
                        title={t("admin.sanctions.title")}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {user.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSanctionTarget(user)}
                          title={t("admin.sanction.title")}
                        >
                          <Gavel className="h-4 w-4" />
                        </Button>
                      )}
                      {currentUserRole === "SUPER_ADMIN" && user.id !== currentUserId && user.role !== "SUPER_ADMIN" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(user)}
                          title={t("admin.user.delete")}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sanctionTarget && (
        <SanctionDialog
          user={sanctionTarget}
          open={!!sanctionTarget}
          onClose={() => setSanctionTarget(null)}
        />
      )}

      {sanctionsTarget && (
        <UserSanctionsDialog
          user={sanctionsTarget}
          open={!!sanctionsTarget}
          onClose={() => setSanctionsTarget(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.user.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.user.deleteDescription", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.sanction.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.user.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
