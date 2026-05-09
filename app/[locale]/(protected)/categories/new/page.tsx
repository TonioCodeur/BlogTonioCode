import { getI18n } from "@/locales/server";
import { CategoryForm } from "@/components/blog/category-form";

export default async function NewCategoryPage() {
  const t = await getI18n();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-mono text-3xl font-bold tracking-tight">
          {t("category.new.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("category.new.description")}
        </p>
      </header>
      <CategoryForm />
    </div>
  );
}
