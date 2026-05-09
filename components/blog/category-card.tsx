import Link from "next/link";
import { FolderOpen } from "lucide-react";

type CategoryCardProps = {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    _count?: { articles: number };
  };
};

export function CategoryCard({ category }: CategoryCardProps) {
  const count = category._count?.articles ?? 0;

  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex items-start gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        style={
          category.color
            ? { backgroundColor: `${category.color}20`, color: category.color }
            : undefined
        }
      >
        <FolderOpen className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-mono font-semibold transition-colors group-hover:text-primary">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {category.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {count} article{count > 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}
