"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
const ALL_ROLES = ["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

type ActionResult = { success: boolean; error?: string };

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new Error("Forbidden: Admin access required");
  }

  return { ...session.user, role: user.role };
}

async function requireSuperAdmin() {
  const caller = await requireAdmin();
  if (caller.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: SUPER_ADMIN required");
  }
  return caller;
}

// ─── deleteUser (SUPER_ADMIN only) ───────────────────────────────────────────

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const currentUser = await requireSuperAdmin();

    if (currentUser.id === userId) {
      return { success: false, error: "You cannot delete your own account" };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return { success: false, error: "Cannot delete a Super Admin" };
    }

    // Cascade delete handles sessions, accounts, sanctions
    await prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─── changeUserRole (SUPER_ADMIN only) ───────────────────────────────────────

const changeUserRoleSchema = z.object({
  userId: z.string().min(1),
  newRole: z.enum(ALL_ROLES),
});

export async function changeUserRole(
  userId: string,
  newRole: string,
): Promise<ActionResult> {
  try {
    const caller = await requireAdmin();
    const parsed = changeUserRoleSchema.parse({ userId, newRole });

    if (parsed.userId === caller.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { role: true },
    });

    if (!target) {
      return { success: false, error: "User not found" };
    }

    const isSuperAdmin = caller.role === "SUPER_ADMIN";

    // ADMIN can only change roles of non-admin users (USER, CUSTOMER, MODERATOR)
    if (!isSuperAdmin) {
      const adminRoles = ["ADMIN", "SUPER_ADMIN"];
      if (adminRoles.includes(target.role)) {
        return { success: false, error: "Admins cannot modify other admins or super admins" };
      }
      // ADMIN cannot promote to ADMIN or SUPER_ADMIN
      if (adminRoles.includes(parsed.newRole)) {
        return { success: false, error: "Admins cannot promote users to admin roles" };
      }
    }

    await prisma.user.update({
      where: { id: parsed.userId },
      data: { role: parsed.newRole },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─── getUsers ─────────────────────────────────────────────────────────────────

export async function getUsers() {
  await requireAdmin();

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
