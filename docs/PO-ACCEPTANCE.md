# PO Acceptance Criteria — Blog (Articles, Categories, Comments)

Scope: any registered, email-verified, non-banned user can author content. MODERATOR / ADMIN / SUPER_ADMIN can delete any content; authors can delete their own. All server actions validate input with Zod and re-check the active session + sanctions in the DB (never trust the cookie cache).

## Create Article

- **Who:** authenticated user, `emailVerified = true`, no `ACTIVE` sanction of type `TEMPORARY_BAN` / `PERMANENT_BAN` (and `User.banned = false`).
- **Required fields:** `title` (3–200 chars, trimmed), `content` (10–50 000 chars, Markdown), `categorySlug` (must exist), `slug` matching `^[a-z0-9-]+$` (3–80 chars, unique on `Article.slug`). Optional: `excerpt` (≤300), `coverImage` (https URL), `published` (default `false`).
- **Server rules:** auto-set `authorId` from session; set `publishedAt = now()` only when `published` flips to true.
- **Success UX:** toast "Article créé", redirect to `/blog/[slug]` (or `/dashboard/articles` if draft).
- **Errors:** duplicate slug → "Ce slug est déjà utilisé"; invalid category → 404 form error; sanction blocking → toast "Votre compte ne peut pas publier".

## Create Category

- **Who:** MODERATOR, ADMIN, SUPER_ADMIN only (categories are taxonomy, not user content).
- **Required fields:** `name` (2–60, unique), `slug` (`^[a-z0-9-]+$`, 2–60, unique), `color` (hex `^#[0-9a-fA-F]{6}$`), optional `description` (≤500), `icon` (lucide name, ≤40).
- **Success UX:** toast "Catégorie créée", redirect to `/categories/[slug]`.
- **Errors:** duplicate name/slug, invalid hex → inline field error.

## Create Comment

- **Who:** authenticated, `emailVerified = true`, no `ACTIVE` `MUTE` / `TEMPORARY_BAN` / `PERMANENT_BAN`.
- **Required:** `articleId` (must exist + `published = true`), `content` (1–2 000 chars, trimmed, no empty/whitespace-only). Optional `parentId` (must belong to same article).
- **Success UX:** optimistic insert in thread, toast "Commentaire publié".
- **Errors:** muted user → toast "Vous êtes en sourdine"; article unpublished → 404; parent mismatch → 400.

## Delete (own / moderator+)

- **Who can delete what:**
  - Author can delete **their own** article / comment.
  - MODERATOR+ can delete **any** article or comment.
  - Only ADMIN / SUPER_ADMIN can delete categories.
- **Article delete:** cascade-deletes its comments. Confirm dialog required.
- **Category delete:** **blocked if it has any article** (FK `onDelete: Restrict`); UI must surface "Catégorie non vide — déplacez ou supprimez les articles d'abord".
- **Comment delete:** soft-delete (`deletedAt = now()`); content replaced by "[supprimé]" in UI; thread structure preserved.
- **Author account deletion:** comments are kept (`authorId → null`, rendered "utilisateur supprimé"); articles cascade-delete with the user (per schema `onDelete: Cascade`) — confirm with PO if we want soft-archive instead.
- **Success UX:** toast confirming action, refresh list / redirect to parent (`/blog`, `/categories`, article page).
- **Errors:** unauthorized → toast "Action non autorisée", no state change.
