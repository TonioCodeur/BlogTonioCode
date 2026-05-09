"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dispatchBotsOnRoleChanged,
  dispatchBotsOnSanction,
} from "@/lib/bots/dispatch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  // Fetch role from DB to avoid acting on stale session cache
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!dbUser) throw new Error("Unauthorized");

  const role = dbUser.role;
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    throw new Error("Forbidden");
  }

  return { userId: session.user.id, role };
}

async function requireSuperAdmin() {
  const caller = await requireAdmin();
  if (caller.role !== "SUPER_ADMIN") throw new Error("Forbidden: SUPER_ADMIN required");
  return caller;
}

// ─── getUsers ─────────────────────────────────────────────────────────────────

export async function getUsers() {
  await requireAdmin();

  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          sanctions: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
}

// ─── getUserSanctions ─────────────────────────────────────────────────────────

const getUserSanctionsSchema = z.object({
  userId: z.string().min(1),
});

export async function getUserSanctions(input: z.infer<typeof getUserSanctionsSchema>) {
  await requireAdmin();
  const { userId } = getUserSanctionsSchema.parse(input);

  return prisma.sanction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      issuedBy: { select: { name: true } },
    },
  });
}

// ─── createSanction ───────────────────────────────────────────────────────────

const createSanctionSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["WARNING", "MUTE", "TEMPORARY_BAN", "PERMANENT_BAN"]),
  reason: z.string().min(1).max(1000),
  notes: z.string().max(2000).optional(),
  durationDays: z.number().int().positive().optional(),
});

export async function createSanction(input: z.infer<typeof createSanctionSchema>) {
  const caller = await requireAdmin();
  const { userId, type, reason, notes, durationDays } = createSanctionSchema.parse(input);

  // Prevent sanctioning yourself
  if (userId === caller.userId) throw new Error("Cannot sanction yourself");

  // Check target user exists
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("User not found");

  // Prevent sanctioning admins (unless caller is SUPER_ADMIN)
  if (
    ADMIN_ROLES.includes(target.role as (typeof ADMIN_ROLES)[number]) &&
    caller.role !== "SUPER_ADMIN"
  ) {
    throw new Error("Cannot sanction an admin");
  }

  let expiresAt: Date | null = null;
  if (type === "TEMPORARY_BAN" && durationDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
  }

  const sanction = await prisma.sanction.create({
    data: {
      type,
      reason,
      notes: notes ?? null,
      expiresAt,
      userId,
      issuedById: caller.userId,
    },
  });

  // Fire-and-forget: bot dispatch must never break the admin action.
  await dispatchBotsOnSanction(userId, { type: sanction.type });

  return sanction;
}

// ─── revokeSanction ───────────────────────────────────────────────────────────

const revokeSanctionSchema = z.object({
  sanctionId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export async function revokeSanction(input: z.infer<typeof revokeSanctionSchema>) {
  const caller = await requireAdmin();
  const { sanctionId, reason } = revokeSanctionSchema.parse(input);

  const sanction = await prisma.sanction.findUnique({ where: { id: sanctionId } });
  if (!sanction) throw new Error("Sanction not found");
  if (sanction.status !== "ACTIVE") throw new Error("Sanction is not active");

  return prisma.sanction.update({
    where: { id: sanctionId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedById: caller.userId,
      revokeReason: reason,
    },
  });
}

// ─── deleteUser ──────────────────────────────────────────────────────────────

const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

export async function deleteUser(input: z.infer<typeof deleteUserSchema>) {
  const caller = await requireSuperAdmin();
  const { userId } = deleteUserSchema.parse(input);

  if (userId === caller.userId) throw new Error("Cannot delete yourself");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("User not found");

  // Prevent deleting other SUPER_ADMINs
  if (target.role === "SUPER_ADMIN") {
    throw new Error("Cannot delete a SUPER_ADMIN");
  }

  // Cascade delete handles sessions, accounts, sanctions
  await prisma.user.delete({ where: { id: userId } });

  return { success: true };
}

// ─── changeUserRole ───────────────────────────────────────────────────────────

const changeUserRoleSchema = z.object({
  userId: z.string().min(1),
  newRole: z.enum(["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]),
});

export async function changeUserRole(input: z.infer<typeof changeUserRoleSchema>) {
  const caller = await requireSuperAdmin();
  const { userId, newRole } = changeUserRoleSchema.parse(input);

  if (userId === caller.userId) throw new Error("Cannot change your own role");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  // Fire-and-forget: bot dispatch must never break the admin action.
  await dispatchBotsOnRoleChanged(userId, newRole);

  return updated;
}
