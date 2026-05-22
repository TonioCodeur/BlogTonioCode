import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    sanction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  dispatchBotsOnRoleChanged: vi.fn(),
  dispatchBotsOnSanction: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/bots/dispatch", () => ({
  dispatchBotsOnRoleChanged: (...args: unknown[]) =>
    mocks.dispatchBotsOnRoleChanged(...args),
  dispatchBotsOnSanction: (...args: unknown[]) =>
    mocks.dispatchBotsOnSanction(...args),
}));

// Import AFTER mocks.
import { changeUserRole, createSanction } from "@/lib/actions/admin";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CallerRole = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

function mockCaller(role: CallerRole | null, callerId = "caller-id") {
  if (role === null) {
    mocks.getSession.mockResolvedValueOnce(null);
    return;
  }
  mocks.getSession.mockResolvedValueOnce({ user: { id: callerId } });
  // requireAuthed reads role from DB.
  mocks.prisma.user.findUnique.mockResolvedValueOnce({ role });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── changeUserRole ───────────────────────────────────────────────────────────

describe("changeUserRole", () => {
  it("rejects unauthenticated callers", async () => {
    mockCaller(null);
    const result = await changeUserRole({ userId: "u1", newRole: "MODERATOR" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a USER caller (Forbidden)", async () => {
    mockCaller("USER");
    const result = await changeUserRole({ userId: "u1", newRole: "MODERATOR" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a MODERATOR caller (Forbidden)", async () => {
    mockCaller("MODERATOR");
    const result = await changeUserRole({ userId: "u1", newRole: "USER" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Forbidden");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects ADMIN trying to change their own role", async () => {
    mockCaller("ADMIN", "caller-id");
    const result = await changeUserRole({
      userId: "caller-id",
      newRole: "USER",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Cannot change your own role");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects SUPER_ADMIN trying to change their own role", async () => {
    mockCaller("SUPER_ADMIN", "caller-id");
    const result = await changeUserRole({
      userId: "caller-id",
      newRole: "USER",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Cannot change your own role");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns User not found when target does not exist", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null); // target lookup
    const result = await changeUserRole({
      userId: "missing",
      newRole: "MODERATOR",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("User not found");
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("ADMIN promotes USER → MODERATOR (success, bot dispatched)", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: "target-id",
      role: "MODERATOR",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "MODERATOR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "target-id", role: "MODERATOR" });
    }
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "target-id" },
      data: { role: "MODERATOR" },
      select: { id: true, role: true },
    });
    expect(mocks.dispatchBotsOnRoleChanged).toHaveBeenCalledWith(
      "target-id",
      "MODERATOR",
    );
  });

  it("ADMIN demotes MODERATOR → USER (success)", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "MODERATOR",
    });
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "USER",
    });
    expect(result.success).toBe(true);
    expect(mocks.prisma.user.update).toHaveBeenCalled();
  });

  it("ADMIN cannot promote USER → ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "ADMIN",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Admins cannot grant ADMIN or SUPER_ADMIN role");
    }
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.dispatchBotsOnRoleChanged).not.toHaveBeenCalled();
  });

  it("ADMIN cannot promote USER → SUPER_ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "SUPER_ADMIN",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Admins cannot grant ADMIN or SUPER_ADMIN role");
    }
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("ADMIN cannot modify another ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "ADMIN",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "USER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Admins cannot modify other admins or super admins",
      );
    }
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("ADMIN cannot modify a SUPER_ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "SUPER_ADMIN",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "USER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Admins cannot modify other admins or super admins",
      );
    }
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN promotes USER → SUPER_ADMIN (success)", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: "target-id",
      role: "SUPER_ADMIN",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "SUPER_ADMIN",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "target-id", role: "SUPER_ADMIN" });
    }
    expect(mocks.dispatchBotsOnRoleChanged).toHaveBeenCalledWith(
      "target-id",
      "SUPER_ADMIN",
    );
  });

  it("SUPER_ADMIN can demote another ADMIN", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "ADMIN",
    });
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "USER",
    });
    expect(result.success).toBe(true);
  });

  it("no-op: newRole === currentRole returns success without DB write or bot dispatch", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "MODERATOR",
    });

    const result = await changeUserRole({
      userId: "target-id",
      newRole: "MODERATOR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "target-id", role: "MODERATOR" });
    }
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.dispatchBotsOnRoleChanged).not.toHaveBeenCalled();
  });

  it("returns invalid-input error on bad payload", async () => {
    mockCaller("ADMIN");
    const result = await changeUserRole({
      userId: "",
      // @ts-expect-error — deliberately invalid for Zod
      newRole: "NOT_A_ROLE",
    });
    expect(result.success).toBe(false);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});

// ─── createSanction ───────────────────────────────────────────────────────────

describe("createSanction", () => {
  it("rejects a USER caller (Forbidden)", async () => {
    mockCaller("USER");
    await expect(
      createSanction({
        userId: "target-id",
        type: "WARNING",
        reason: "spam",
      }),
    ).rejects.toThrow("Forbidden");
    expect(mocks.prisma.sanction.create).not.toHaveBeenCalled();
  });

  it("lets a MODERATOR sanction a USER", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "USER",
    });
    mocks.prisma.sanction.create.mockResolvedValueOnce({
      id: "sanction-id",
      type: "WARNING",
    });

    const result = await createSanction({
      userId: "target-id",
      type: "WARNING",
      reason: "spam",
    });
    expect(result.id).toBe("sanction-id");
    expect(mocks.prisma.sanction.create).toHaveBeenCalledOnce();
    expect(mocks.dispatchBotsOnSanction).toHaveBeenCalledWith("target-id", {
      type: "WARNING",
    });
  });

  it("rejects a MODERATOR sanctioning an ADMIN", async () => {
    mockCaller("MODERATOR");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "ADMIN",
    });

    await expect(
      createSanction({
        userId: "target-id",
        type: "WARNING",
        reason: "abuse of power",
      }),
    ).rejects.toThrow("Cannot sanction an admin");
    expect(mocks.prisma.sanction.create).not.toHaveBeenCalled();
  });

  it("rejects an ADMIN sanctioning another ADMIN", async () => {
    mockCaller("ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "ADMIN",
    });

    await expect(
      createSanction({
        userId: "target-id",
        type: "WARNING",
        reason: "abuse of power",
      }),
    ).rejects.toThrow("Cannot sanction an admin");
    expect(mocks.prisma.sanction.create).not.toHaveBeenCalled();
  });

  it("lets a SUPER_ADMIN sanction an ADMIN", async () => {
    mockCaller("SUPER_ADMIN");
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "target-id",
      role: "ADMIN",
    });
    mocks.prisma.sanction.create.mockResolvedValueOnce({
      id: "sanction-id",
      type: "WARNING",
    });

    const result = await createSanction({
      userId: "target-id",
      type: "WARNING",
      reason: "policy violation",
    });
    expect(result.id).toBe("sanction-id");
    expect(mocks.prisma.sanction.create).toHaveBeenCalledOnce();
  });

  it("rejects a MODERATOR trying to sanction themselves", async () => {
    mockCaller("MODERATOR", "caller-id");

    await expect(
      createSanction({
        userId: "caller-id",
        type: "WARNING",
        reason: "self-flagellation",
      }),
    ).rejects.toThrow("Cannot sanction yourself");
    expect(mocks.prisma.sanction.create).not.toHaveBeenCalled();
  });
});
