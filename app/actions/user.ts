"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type ActionResult = { success: boolean; error?: string };

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ─── updateName ──────────────────────────────────────────────────────────────

const updateNameSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function updateName(name: string): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const parsed = updateNameSchema.parse({ name });

    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.name },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid name" };
    }
    console.error("updateName failed:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─── changePassword ──────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    await requireAuth();
    changePasswordSchema.parse({ currentPassword, newPassword });

    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid password format" };
    }
    console.error("changePassword failed:", error);
    return { success: false, error: "Failed to change password" };
  }
}

// ─── deleteOwnAccount ────────────────────────────────────────────────────────

export async function deleteOwnAccount(): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (dbUser?.role === "SUPER_ADMIN") {
      return { success: false, error: "Super admins cannot delete their own account" };
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteOwnAccount failed:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─── upgradeToCustomer (called from order-success) ───────────────────────────

export async function upgradeToCustomer(): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser) {
      return { success: false, error: "User not found" };
    }

    if (dbUser.role !== "USER") {
      return { success: false, error: "Only users with USER role can be upgraded" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "CUSTOMER" },
    });

    return { success: true };
  } catch (error) {
    console.error("upgradeToCustomer failed:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
