import { getI18n } from "@/locales/server";
import { CheckoutButton } from "@/components/checkout-button";
import { Check } from "lucide-react";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getI18n();

  const features = [
    t("pricing.plan.features.0"),
    t("pricing.plan.features.1"),
    t("pricing.plan.features.2"),
    t("pricing.plan.features.3"),
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("pricing.title")}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("pricing.plan.name")}
          </p>
          <div className="mt-3 flex items-end justify-center gap-1">
            <span className="text-5xl font-bold text-foreground">
              {t("pricing.plan.price")}
            </span>
            <span className="mb-1 text-muted-foreground">
              {t("pricing.plan.period")}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("pricing.plan.description")}
          </p>
        </div>

        <ul className="mb-8 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <CheckoutButton
          label={t("pricing.plan.cta")}
          loadingLabel={t("pricing.plan.loading")}
        />
      </div>
    </div>
  );
}
