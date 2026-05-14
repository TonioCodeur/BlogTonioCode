/**
 * Centralised TanStack Query keys + helpers.
 *
 * Keep keys hierarchical so `invalidateQueries({ queryKey: [...]" })` can
 * sweep related caches in one call.
 */

export const queryKeys = {
  messages: {
    all: ["messages"] as const,
    unreadCount: () => [...queryKeys.messages.all, "unread-count"] as const,
  },
  posts: {
    all: ["posts"] as const,
    list: () => [...queryKeys.posts.all, "list"] as const,
    detail: (slug: string) => [...queryKeys.posts.all, "detail", slug] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
  },
  comments: {
    all: ["comments"] as const,
    forPost: (postId: string) => [...queryKeys.comments.all, "post", postId] as const,
  },
} as const;
