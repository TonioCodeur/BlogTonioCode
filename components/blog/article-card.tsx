import Link from "next/link";
import Image from "next/image";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ArticleCardProps = {
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    author: { name: string; image: string | null } | null;
    category: { name: string; slug: string; color: string | null };
  };
  locale: string;
};

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ArticleCard({ article, locale }: ArticleCardProps) {
  const publishedDate = article.publishedAt ?? article.createdAt;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-lg">
      <Link href={`/blog/${article.slug}`} className="flex flex-col h-full">
        {article.coverImage ? (
          <div className="relative aspect-video overflow-hidden bg-muted">
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        )}

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex items-center gap-2">
            <Badge
              variant="secondary"
              style={
                article.category.color
                  ? { backgroundColor: `${article.category.color}20`, color: article.category.color }
                  : undefined
              }
            >
              {article.category.name}
            </Badge>
          </div>

          <h3 className="font-mono text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
            {article.title}
          </h3>

          {article.excerpt ? (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
          ) : null}

          <div className="mt-4 flex items-center gap-3 pt-3 text-xs text-muted-foreground border-t">
            {article.author?.name ? (
              <span className="font-medium">{article.author.name}</span>
            ) : null}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(publishedDate, locale)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
