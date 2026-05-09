import {
  lemonSqueezySetup,
  createCheckout as lsCreateCheckout,
} from "@lemonsqueezy/lemonsqueezy.js";

// Initialise the SDK lazily — only when a checkout is actually requested.
let isSetupDone = false;

function ensureSetup() {
  if (isSetupDone) return;

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing LemonSqueezy configuration: LEMONSQUEEZY_API_KEY is required.",
    );
  }

  lemonSqueezySetup({
    apiKey,
    onError(error) {
      console.error("[LemonSqueezy]", error);
    },
  });

  isSetupDone = true;
}

/**
 * Create a LemonSqueezy hosted-checkout and return the redirect URL.
 *
 * @param userId    - The app user id, forwarded in `checkoutData.custom` so the
 *                    webhook handler can identify who completed the purchase.
 * @param userEmail - Pre-fills the email field in the checkout overlay.
 */
export async function createCheckoutUrl(
  userId: string,
  userEmail: string,
): Promise<string> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

  ensureSetup();

  if (!storeId || !variantId) {
    throw new Error(
      "Missing LemonSqueezy configuration: LEMONSQUEEZY_STORE_ID and LEMONSQUEEZY_VARIANT_ID are required.",
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "Missing configuration: NEXT_PUBLIC_APP_URL is required.",
    );
  }

  const response = await lsCreateCheckout(storeId, variantId, {
    checkoutData: {
      email: userEmail,
      custom: {
        user_id: userId,
      },
    },
    productOptions: {
      redirectUrl: `${appUrl}/order-successfull`,
    },
  });

  if (response.error) {
    throw new Error(
      `LemonSqueezy checkout creation failed: ${response.error.message}`,
    );
  }

  const url = response.data?.data?.attributes?.url;

  if (!url) {
    throw new Error("LemonSqueezy returned a checkout without a URL.");
  }

  return url;
}
