"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckout } from "@/lib/actions/payment";

interface CheckoutButtonProps {
  label: string;
  loadingLabel: string;
}

export function CheckoutButton({ label, loadingLabel }: CheckoutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      const { url } = await createCheckout();
      window.location.href = url;
    } catch (error) {
      console.error("Checkout failed:", error);
      setIsPending(false);
    }
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? loadingLabel : label}
    </Button>
  );
}
