"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

// ─── createCheckout ───────────────────────────────────────────────────────────

/**
 * Server Action — creates a LemonSqueezy hosted-checkout for the authenticated
 * user and returns the redirect URL.
 *
 * Throws "Unauthorized" when called without a valid session.
 */
export async function createCheckout(): Promise<{ url: string }> {
  const user = await requireAuth();

  const url = await createCheckoutUrl(user.id, user.email);

  return { url };
}
