import Link from "next/link";
import { getI18n } from "@/locales/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default async function OrderSuccessfulPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getI18n();

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">
              {t("orderSuccess.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground">
              {t("orderSuccess.description")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("orderSuccess.pending")}
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                {t("orderSuccess.backToDashboard")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
