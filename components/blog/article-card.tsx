import Link from "next/link";
import Image from "next/image";
import { Heart, MessageSquare } from "lucide-react";

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

function shortId(id: string): string {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
}

function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ArticleCard({ article }: ArticleCardProps) {
  const initials = article.author?.name ? authorInitials(article.author.name) : "??";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50">
      <Link href={`/blog/${article.slug}`} className="flex h-full flex-col">
        {/* Cover */}
        <div className="relative h-[130px] overflow-hidden border-b border-border">
          {article.coverImage ? (
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <>
              <div className="card-cover absolute inset-0" />
              <div className="card-cover-grid absolute inset-3" />
            </>
          )}

          {/* Category badge bottom-left */}
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <span
              className="hud-tag"
              style={
                article.category.color
                  ? {
                      borderColor: `${article.category.color}80`,
                      color: article.category.color,
                      background: "rgba(0,0,0,0.5)",
                    }
                  : undefined
              }
            >
              {article.category.name}
            </span>
          </div>

          {/* HUD-style id top-right */}
          <div className="absolute right-3 top-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            #{shortId(article.id)}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-[19px] font-semibold leading-snug tracking-[-0.015em] transition-colors group-hover:text-primary">
            {article.title}
          </h3>

          {article.excerpt ? (
            <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">
              {article.excerpt}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-2.5 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--accent-rgb))] to-[rgb(var(--accent-rgb-2))] text-[9px] font-bold text-white">
              {initials}
            </span>
            <span className="text-foreground/80">{article.author?.name ?? "—"}</span>
            <span className="flex-1" />
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />0
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />0
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
