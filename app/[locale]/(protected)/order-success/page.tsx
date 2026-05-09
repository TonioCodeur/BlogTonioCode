import { redirect } from "next/navigation";

/**
 * Legacy order-success page — redirects to the canonical /order-successfull URL.
 * The actual upgrade is handled securely by the LemonSqueezy webhook,
 * NOT by a client-side action (which was a security vulnerability).
 */
export default function OrderSuccessPage() {
  redirect("/order-successfull");
}
