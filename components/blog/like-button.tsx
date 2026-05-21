"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";
// NOTE: @DB will export `toggleLikePost` and `toggleLikeComment` from
// `@/lib/actions/likes` (cf. spec §A.4). Until the file lands the TS import
// errors are expected and non-blocking for @DF.
import { toggleLikePost, toggleLikeComment } from "@/lib/actions/likes";

/**
 * Discriminated union: either a post or a comment target.
 *
 * Mirrors the PO spec `targetType` + `targetId` shape (cf. §A.5.1) while
 * keeping enough context (postSlug / postId) for query-cache invalidation.
 */
type LikeTarget =
  | { targetType: "post"; targetId: string; postSlug?: string }
  | { targetType: "comment"; targetId: string; postId: string };

export type LikeButtonProps = LikeTarget & {
  initialCount: number;
  initialLiked: boolean;
  /** Anonymous visitor → click triggers a "sign in" toast. */
  isAuthenticated: boolean;
  /** Authed but email not verified → click triggers a verify-email toast. */
  requiresEmailVerification?: boolean;
  /** Visual variant. */
  size?: "sm" | "md";
  /** When true, label is screen-reader only (icon + count only). */
  iconOnly?: boolean;
  /** Optional extra className for layout fine-tuning. */
  className?: string;
};

type LikeMutationResult =
  | { success: true; data?: { liked: boolean; count: number } }
  | { success: false; error: string };

/**
 * Tiny `useState`-like helper that re-syncs with `initial` when the prop
 * changes (e.g. after `router.refresh()` pushes a fresh server snapshot).
 */
function useSyncedState<T>(initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    setValue(initial);
  }, [initial]);
  return [value, setValue];
}

/**
 * Generic like button (Post + Comment).
 *
 * - Optimistic UI: the icon fills and the counter updates on click before the
 *   server responds (spec §A.5.3).
 * - Anonymous / unverified-email visitors get a toast instead of a mutation.
 * - `aria-pressed` reflects the liked state for screen readers.
 * - When wrapped in a `<Link>` (e.g. `PostCard`) we `stopPropagation` +
 *   `preventDefault` so clicking the heart never navigates (spec §A.5.2).
 */
export function LikeButton(props: LikeButtonProps) {
  const {
    initialCount,
    initialLiked,
    isAuthenticated,
    requiresEmailVerification = false,
    size = "md",
    className,
  } = props;
  // `iconOnly` from the spec is a no-op visually here — the count is always
  // rendered next to the heart. The flag is accepted for API parity with §A.5.1
  // and may drive future label rendering.
  void props.iconOnly;

  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local optimistic state — kept in the React tree so even when the parent
  // query cache doesn't hold the post/comment we still get instant feedback.
  // `router.refresh` + `invalidateQueries` in `onSettled` reconciles eventually.
  const [liked, setLiked] = useSyncedState(initialLiked);
  const [count, setCount] = useSyncedState(initialCount);

  const queryKey =
    props.targetType === "post"
      ? props.postSlug
        ? queryKeys.posts.detail(props.postSlug)
        : queryKeys.posts.all
      : queryKeys.comments.forPost(props.postId);

  const mutation = useMutation<
    LikeMutationResult,
    Error,
    void,
    { prevLiked: boolean; prevCount: number }
  >({
    mutationFn: async () => {
      if (props.targetType === "post") {
        return toggleLikePost({ postId: props.targetId });
      }
      return toggleLikeComment({ commentId: props.targetId });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      return { prevLiked: liked, prevCount: count };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setLiked(ctx.prevLiked);
        setCount(ctx.prevCount);
      }
      toast.error(t("likes.toast.error"));
    },
    onSuccess: (res, _vars, ctx) => {
      if (!res.success) {
        // Roll back to the snapshot taken in onMutate.
        if (ctx) {
          setLiked(ctx.prevLiked);
          setCount(ctx.prevCount);
        }
        toast.error(
          res.error === "Banned"
            ? t("likes.toast.banned")
            : t("likes.toast.error"),
        );
        return;
      }
      if (res.data) {
        // Reconcile with authoritative server values.
        setLiked(res.data.liked);
        setCount(res.data.count);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      router.refresh();
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Always swallow click bubbling — the button can be nested under a wrapping
    // <Link> (e.g. PostCard) and we never want to navigate.
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.message(t("likes.toast.signInRequired"), {
        action: {
          label: t("likes.toast.signInLink"),
          onClick: () => router.push("/signin"),
        },
      });
      return;
    }
    if (requiresEmailVerification) {
      toast.message(t("likes.toast.verifyEmailRequired"), {
        action: {
          label: t("likes.toast.signInLink"),
          onClick: () => router.push("/verify-email"),
        },
      });
      return;
    }

    // Optimistic flip BEFORE firing the mutation so the user sees instant feedback.
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    mutation.mutate();
  };

  const ariaLabel = liked
    ? t("likes.button.unlikeAria")
    : t("likes.button.likeAria");

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={mutation.isPending}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md transition-all",
        "text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:opacity-70",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        liked && "text-rose-500 hover:text-rose-600",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn(
          "transition-transform duration-150 ease-out",
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          liked && "fill-current scale-110",
          !liked && "group-hover:scale-110",
        )}
      />
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  );
}
