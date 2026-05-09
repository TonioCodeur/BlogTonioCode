import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LemonSqueezyWebhookBody {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      customer_id?: number | string;
      status?: string;
      order_number?: number;
      first_order_item?: {
        variant_id?: number;
        product_id?: number;
      };
      // Subscription fields
      variant_id?: number;
      product_id?: number;
      ends_at?: string | null;
    };
  };
}

// ─── Signature Verification ──────────────────────────────────────────────────

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  const digestBuffer = Buffer.from(digest, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleOrderCreated(body: LemonSqueezyWebhookBody) {
  const userId = body.meta?.custom_data?.user_id;
  const lemonSqueezyCustomerId =
    body.data?.attributes?.customer_id?.toString();

  if (!userId) {
    console.error("order_created: missing user_id in custom_data");
    return NextResponse.json(
      { error: "Missing user_id in custom_data" },
      { status: 400 },
    );
  }

  if (!lemonSqueezyCustomerId) {
    console.error("order_created: missing customer_id");
    return NextResponse.json(
      { error: "Missing customer_id" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`order_created: user not found (id=${userId})`);
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: "CUSTOMER",
      lemonSqueezyCustomerId,
    },
  });

  console.log(
    `order_created: user ${userId} upgraded to CUSTOMER (ls_customer=${lemonSqueezyCustomerId})`,
  );
  return null;
}

async function handleOrderRefunded(body: LemonSqueezyWebhookBody) {
  const userId = body.meta?.custom_data?.user_id;
  if (!userId) {
    console.error("order_refunded: missing user_id in custom_data");
    return null; // Non-blocking — log and continue
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`order_refunded: user not found (id=${userId})`);
    return null;
  }

  // Only downgrade if currently a CUSTOMER (don't touch admins/moderators)
  if (user.role === "CUSTOMER") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "USER" },
    });
    console.log(`order_refunded: user ${userId} downgraded to USER`);
  }

  return null;
}

async function handleSubscriptionUpdated(body: LemonSqueezyWebhookBody) {
  const userId = body.meta?.custom_data?.user_id;
  const status = body.data?.attributes?.status;

  if (!userId) {
    console.error("subscription_updated: missing user_id in custom_data");
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`subscription_updated: user not found (id=${userId})`);
    return null;
  }

  // If subscription is cancelled/expired, downgrade CUSTOMER to USER
  if (
    (status === "cancelled" || status === "expired") &&
    user.role === "CUSTOMER"
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "USER" },
    });
    console.log(
      `subscription_updated: user ${userId} downgraded (status=${status})`,
    );
  }

  // If subscription is active/resumed, upgrade back to CUSTOMER
  if (
    (status === "active" || status === "resumed") &&
    user.role === "USER"
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "CUSTOMER" },
    });
    console.log(
      `subscription_updated: user ${userId} upgraded back to CUSTOMER (status=${status})`,
    );
  }

  return null;
}

// ─── Idempotency ────────────────────────────────────────────────────────────

const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

function markEventProcessed(eventId: string): boolean {
  if (processedEvents.has(eventId)) return false;
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }
  processedEvents.add(eventId);
  return true;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify webhook secret is configured
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  // 2. Verify HMAC signature
  const signature = request.headers.get("X-Signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  // 3. Parse body
  let body: LemonSqueezyWebhookBody;
  try {
    body = JSON.parse(rawBody) as LemonSqueezyWebhookBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // 4. Idempotency check — prevent replay attacks
  const eventId = body.data?.id;
  const eventName = body.meta?.event_name;
  const idempotencyKey = `${eventName}:${eventId}`;

  if (eventId && !markEventProcessed(idempotencyKey)) {
    console.log(`Duplicate webhook ignored: ${idempotencyKey}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 5. Route events
  try {
    let errorResponse: NextResponse | null = null;

    switch (eventName) {
      case "order_created":
        errorResponse = await handleOrderCreated(body);
        break;
      case "order_refunded":
        await handleOrderRefunded(body);
        break;
      case "subscription_created":
        errorResponse = await handleOrderCreated(body); // Same logic as order
        break;
      case "subscription_updated":
      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_resumed":
        await handleSubscriptionUpdated(body);
        break;
      default:
        console.log(`Unhandled LemonSqueezy event: ${eventName}`);
    }

    if (errorResponse) {
      return errorResponse;
    }
  } catch (error) {
    console.error(`Error handling ${eventName}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
