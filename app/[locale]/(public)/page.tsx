import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Shield,
  CreditCard,
  Database,
  Mail,
  Palette,
  Github,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { getI18n } from "@/locales/server";

const techStack = [
  { name: "Next.js 16", description: "React Framework" },
  { name: "TypeScript", description: "Type Safety" },
  { name: "Tailwind CSS", description: "Styling" },
  { name: "Prisma", description: "Database ORM" },
  { name: "Better Auth", description: "Authentication" },
  { name: "Zod", description: "Validation" },
  { name: "shadcn/ui", description: "UI Components" },
  { name: "Lemon Squeezy", description: "Payments" },
];

export default async function HomePage() {
  const t = await getI18n();

  const features = [
    {
      icon: Shield,
      title: t("home.features.auth.title"),
      description: t("home.features.auth.description"),
    },
    {
      icon: Database,
      title: t("home.features.db.title"),
      description: t("home.features.db.description"),
    },
    {
      icon: CreditCard,
      title: t("home.features.payments.title"),
      description: t("home.features.payments.description"),
    },
    {
      icon: Mail,
      title: t("home.features.emails.title"),
      description: t("home.features.emails.description"),
    },
    {
      icon: Palette,
      title: t("home.features.ui.title"),
      description: t("home.features.ui.description"),
    },
    {
      icon: Zap,
      title: t("home.features.perf.title"),
      description: t("home.features.perf.description"),
    },
  ];

  const pricingFeatures = [
    t("home.pricing.feature1"),
    t("home.pricing.feature2"),
    t("home.pricing.feature3"),
    t("home.pricing.feature4"),
    t("home.pricing.feature5"),
    t("home.pricing.feature6"),
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl" aria-hidden="true">
          <div
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-primary/20 to-primary/5 opacity-30"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="container mx-auto px-4 py-24 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              {t("home.hero.badge")}
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {t("home.hero.h1")}
              <span className="block text-primary">{t("home.hero.h1Highlight")}</span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("home.hero.description")}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/signup">
                  {t("home.hero.ctaStart")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="https://github.com" target="_blank">
                  <Github className="mr-2 h-4 w-4" />
                  {t("home.hero.ctaGitHub")}
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{t("home.hero.noCard")}</p>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="stack" className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-sm font-medium text-muted-foreground mb-8">
            {t("home.stack.subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {techStack.map((tech) => (
              <div key={tech.name} className="flex items-center gap-2">
                <span className="font-semibold">{tech.name}</span>
                <span className="text-muted-foreground text-sm hidden sm:inline">
                  {tech.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              {t("home.features.badge")}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.features.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("home.features.description")}</p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/50"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              {t("home.pricing.badge")}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.pricing.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("home.pricing.description")}</p>
          </div>

          <div className="mx-auto max-w-lg">
            <div className="rounded-2xl border-2 border-primary bg-card p-8 shadow-xl">
              <div className="text-center">
                <h3 className="text-lg font-semibold">{t("home.pricing.plan")}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-x-2">
                  <span className="text-5xl font-bold tracking-tight">$199</span>
                  <span className="text-muted-foreground line-through">$299</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t("home.pricing.oneTime")}</p>
              </div>

              <ul className="mt-8 space-y-3">
                {pricingFeatures.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button className="mt-8 w-full" size="lg" asChild>
                <Link href="/signup">
                  {t("home.pricing.cta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("home.pricing.guarantee")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 sm:px-16 sm:py-24">
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                {t("home.cta.title")}
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80">{t("home.cta.description")}</p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/signup">
                    {t("home.cta.button")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <svg
                width="24"
                height="24"
                viewBox="0 0 38 38"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="19" cy="19" r="18" className="fill-primary" />
                <path
                  d="M13 25L25 13M15 13H25V23"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="dark:stroke-background"
                />
              </svg>
              <span className="font-semibold">ShipStack</span>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>

            <div className="flex items-center space-x-4">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                {t("footer.privacy")}
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                {t("footer.terms")}
              </Link>
              <Link href="https://github.com" className="text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
