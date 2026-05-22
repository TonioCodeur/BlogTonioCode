import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { CategoryDeleteButton } from "@/components/blog/category-delete-button";
import { MoveToTrashDialog } from "@/components/blog/move-to-trash-dialog";

type CategoryRole = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
const MODERATOR_ROLES: ReadonlyArray<CategoryRole> = [
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
];

type CategoryCardProps = {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    createdById?: string | null;
    _count?: { posts: number };
  };
  currentUserId?: string | null;
  currentUserRole?: CategoryRole | null;
};

export function CategoryCard({
  category,
  currentUserId,
  currentUserRole,
}: CategoryCardProps) {
  const count = category._count?.posts ?? 0;
  const isMod =
    !!currentUserRole && MODERATOR_ROLES.includes(currentUserRole);
  const isCreator =
    !!currentUserId &&
    !!category.createdById &&
    currentUserId === category.createdById;

  return (
    <div className="group relative flex items-start gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md">
      <Link
        href={`/categories/${category.slug}`}
        className="flex flex-1 items-start gap-4"
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
            {count} post{count > 1 ? "s" : ""}
          </p>
        </div>
      </Link>
      {/* Author of the category can soft-delete (routes through trash). */}
      {isCreator ? (
        <div className="absolute right-2 top-2">
          <CategoryDeleteButton categoryId={category.id} />
        </div>
      ) : null}
      {/* Moderators+ get the moderation flow (with reason) when not the author. */}
      {!isCreator && isMod ? (
        <div className="absolute right-2 top-2">
          <MoveToTrashDialog
            target={{ kind: "category", categoryId: category.id }}
            iconOnly
            variant="ghost"
          />
        </div>
      ) : null}
    </div>
  );
}
