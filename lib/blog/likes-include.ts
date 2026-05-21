/**
 * Prisma `include` fragments to attach like metadata to Post / Comment queries.
 *
 * Usage in a public listing or detail page:
 *
 *   const posts = await prisma.post.findMany({
 *     where: { ... },
 *     include: {
 *       author: { select: { name: true, image: true } },
 *       category: { select: { name: true, slug: true, color: true } },
 *       ...withPostLikeMeta(currentUserId),
 *     },
 *   });
 *
 * `_count.likes` is always included (cheap COUNT(*) leveraging the
 * `@@index([postId])` / `@@index([commentId])` from the schema).
 * `likes` is only fetched when a user is signed in — it returns a 0/1-length
 * array used to derive `likedByMe = post.likes.length > 0`.
 *
 * Important: these helpers return *plain* literal objects rather than typed
 * Prisma helpers because we want to spread them into multiple call sites
 * (some that also include other relations). Prisma's type inference picks
 * them up correctly when spread inline.
 */

type LikeIncludeFragment = {
  _count: { select: { likes: true } };
  likes?: { where: { userId: string }; select: { id: true } };
};

export function withPostLikeMeta(
  currentUserId: string | null,
): LikeIncludeFragment {
  if (currentUserId) {
    return {
      _count: { select: { likes: true } },
      likes: { where: { userId: currentUserId }, select: { id: true } },
    };
  }
  return {
    _count: { select: { likes: true } },
  };
}

// Comment uses the same shape — separate export for clarity at call site.
export function withCommentLikeMeta(
  currentUserId: string | null,
): LikeIncludeFragment {
  if (currentUserId) {
    return {
      _count: { select: { likes: true } },
      likes: { where: { userId: currentUserId }, select: { id: true } },
    };
  }
  return {
    _count: { select: { likes: true } },
  };
}
