# Likes & Upload d'image de couverture — Cahier des charges (PO)

Références codebase: `prisma/schema.prisma` (modèles `Post`, `Comment`, `User`), `lib/actions/blog.ts` (style des server actions et helpers d'auth), `lib/queries.ts` (clés TanStack Query), `components/blog/post-card.tsx` (placeholder `Heart` déjà présent), `components/blog/post-form.tsx` (champ `coverImage` actuel = URL libre), `docs/trash-feature-spec.md` (format de référence pour cette spec).

Auteur: @PO — destiné à @DB (modèle Prisma) et @DF (back/front).

---

# Partie A — Système de likes (Post + Comment)

## A.1 Objectif & motivation

Le blog affiche déjà des cœurs (`Heart` lucide-react dans `PostCard`) figés à `0`. On veut transformer ce placeholder en une vraie interaction:

- Un utilisateur authentifié peut "liker" un `Post` ou un `Comment`.
- Le compteur de likes est visible publiquement et reflète l'état réel en base.
- L'utilisateur connecté voit l'état "j'ai liké / je n'ai pas liké" sur le contenu, et peut basculer en un clic.

**Objectif business**: signal d'engagement minimal, lecture seule pour les visiteurs, idempotent et résistant au double-clic.

**Non-objectif**:
- Pas de "dislike", pas d'emojis multiples (👍❤️😂…), juste un like binaire.
- Pas de feed "vu par X amis", pas de notifications à l'auteur.
- Pas de page admin dédiée. Les modérateurs n'ont pas d'action spécifique sur les likes (la cascade soft-delete / trash gère leur visibilité, cf. règles 2.4).

## A.2 Règles métier détaillées

### A.2.1 Qui peut liker ?

| Acteur | Liker un Post visible | Liker un Comment visible | Liker son propre contenu | Liker un contenu `TRASHED` ou `AUTHOR_DELETED` |
|---|---|---|---|---|
| Visiteur anonyme | ❌ (redirection signin) | ❌ | n/a | ❌ |
| USER / CUSTOMER (email vérifié) | ✅ | ✅ | ✅ (autorisé) | ❌ |
| USER / CUSTOMER (email **non** vérifié) | ❌ | ❌ | ❌ | ❌ |
| MODERATOR / ADMIN / SUPER_ADMIN | ✅ | ✅ | ✅ | ❌ |
| Utilisateur banni (`Sanction` active `TEMPORARY_BAN` ou `PERMANENT_BAN`) | ❌ | ❌ | ❌ | ❌ |
| Utilisateur muté (`Sanction` active `MUTE`) | ✅ (le mute concerne l'écriture de contenu, pas les likes) | ✅ | ✅ | ❌ |

Pré-requis serveur: `requireAuthUser()` (qui exige `emailVerified = true`) + check `banned` via `getActiveSanctionFlags()` — helpers déjà présents dans `lib/actions/blog.ts`.

Décision motivée:
- **Le like sur son propre contenu est autorisé.** Filtrer ce cas alourdirait la logique sans bénéfice (ce n'est ni du spam ni de la triche pour un blog).
- **Le mute n'empêche pas de liker.** Un like n'est pas un message; le mute reste cohérent avec sa portée actuelle (interdit la création de `Comment`, cf. `lib/actions/blog.ts`).

### A.2.2 Unicité

Un même `(userId, postId)` ou `(userId, commentId)` ne peut produire qu'**un seul like**.

- L'action `toggleLikePost` / `toggleLikeComment` est **idempotente** au sens UI: cliquer ajoute si absent, retire si présent. Pas d'erreur en cas de doublon — c'est le comportement attendu.
- Contrainte d'unicité côté DB (`@@unique`) pour garantir l'invariant même en cas de course (double clic, double onglet).

### A.2.3 Visibilité publique des compteurs

- Le compteur affiché sur un `Post` visible inclut **tous** les likes en base pour ce post (pas de filtrage par état du liker — un user banni dont les likes restent en base est OK; on ne va pas faire de purge rétroactive).
- Le compteur affiché sur un `Comment` `VISIBLE` (ni `trashedAt` ni `deletedAt`) est exposé publiquement.
- Un `Comment` `TRASHED` ou `AUTHOR_DELETED` est rendu en tombstone — son compteur de likes **n'est pas affiché** (cohérent avec le masquage du contenu).
- Un `Post` `TRASHED` ou `AUTHOR_DELETED` n'est pas accessible au public → la question ne se pose pas.

### A.2.4 Cascade & cycle de vie

| Événement | Effet sur les likes |
|---|---|
| Post mis en corbeille (`trashedAt`) | Les likes restent en base; n'affichent plus côté public (le post n'est plus accessible). À la restauration, les compteurs reviennent intacts. |
| Post restauré | Les likes restent intacts (jamais touchés). |
| Post hard-delete (SUPER_ADMIN) | **Cascade**: les `PostLike` du post sont supprimés (`onDelete: Cascade`). |
| Comment hard-delete | Idem: `CommentLike` cascade. |
| User hard-delete (`deleteUser` SUPER_ADMIN) | **Cascade**: tous les likes émis par ce user sont supprimés (`onDelete: Cascade` sur `userId`). C'est intentionnel: on ne veut pas de ligne orpheline avec `userId` null, et on accepte que la suppression d'un user fasse baisser des compteurs. |
| User banni | Pas d'action sur les likes existants. Le ban interdit seulement l'émission de nouveaux likes. |

### A.2.5 État optimiste côté UI

Cible: feedback instantané au clic (cœur rempli + compteur incrémenté) avant retour serveur. Si l'action serveur échoue, rollback de l'état + toast d'erreur.

- TanStack Query: `useMutation` avec `onMutate` qui patch le cache des queries `posts.detail(slug)` et `comments.forPost(postId)` (cf. `lib/queries.ts`).
- En cas d'erreur, restaurer l'état précédent via le contexte renvoyé par `onMutate`.

### A.2.6 Comportement pour les utilisateurs non connectés

Sur le bouton like d'un visiteur anonyme:
- Affichage normal du compteur (lecture publique).
- Au clic: **toast** (`sonner`) avec message `"Connectez-vous pour aimer ce contenu"` et un lien `→ /signin`. Pas de redirection automatique (moins agressif et conserve la position de scroll).

Si l'utilisateur est connecté mais email non vérifié: toast `"Vérifiez votre email pour pouvoir aimer du contenu"` + lien vers `/verify-email`.

## A.3 Modèle de données

Deux tables séparées (`PostLike`, `CommentLike`) plutôt qu'une table polymorphe (`Like(targetType, targetId)`).

**Motivation du choix:**
- **Type-safety Prisma**: chaque table a sa FK explicite vers `Post` ou `Comment` → cascade `onDelete` automatique et `_count.likes` natif via la relation Prisma (`include: { _count: { select: { likes: true } } }`).
- **Index plus simples**: `(postId, userId)` unique, `(postId)` pour count → pas de discriminant `targetType` à indexer.
- **Pas de risque d'incohérence**: polymorphisme = FK nullables sans contrainte référentielle stricte (Prisma ne sait pas faire de FK conditionnelle). Avec deux tables, l'intégrité est garantie par la DB.
- **Coût**: deux fichiers de migration à la place d'un. Acceptable.

### A.3.1 Modèle `PostLike`

```prisma
model PostLike {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post      Post     @relation("PostLikes", fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation("PostLikesByUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@index([postId])
  @@index([userId])
  @@map("post_like")
}
```

### A.3.2 Modèle `CommentLike`

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  createdAt DateTime @default(now())

  comment   Comment  @relation("CommentLikes", fields: [commentId], references: [id], onDelete: Cascade)
  user      User     @relation("CommentLikesByUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
  @@index([commentId])
  @@index([userId])
  @@map("comment_like")
}
```

### A.3.3 Relations inverses à ajouter

Dans `Post`:
```prisma
likes  PostLike[]  @relation("PostLikes")
```

Dans `Comment`:
```prisma
likes  CommentLike[]  @relation("CommentLikes")
```

Dans `User`:
```prisma
postLikes     PostLike[]     @relation("PostLikesByUser")
commentLikes  CommentLike[]  @relation("CommentLikesByUser")
```

### A.3.4 Index — justification

- `@@unique([postId, userId])` / `@@unique([commentId, userId])`: invariant métier ET sert de filtre rapide pour "ce user a-t-il déjà liké ce post ?".
- `@@index([postId])` / `@@index([commentId])`: nécessaire pour `_count.likes` rapide quand on charge des listes (cas listing `/blog` avec N posts → N `_count` à calculer).
- `@@index([userId])`: utile pour un futur "mes contenus likés" et pour la cascade `onDelete` sur user.

## A.4 API / Server actions

À ajouter dans `lib/actions/likes.ts` (nouveau fichier — sépare le scope des autres actions). Style identique à `lib/actions/blog.ts`: `"use server"`, retour `ActionResult<T>`, validation Zod, helpers `requireAuthUser` (à dédupliquer dans `lib/auth/guards.ts` ou réexporter depuis `lib/actions/blog.ts`).

### A.4.1 Toggle

```ts
// USER+ avec email vérifié, non banni
toggleLikePost(input: { postId: string })
  : Promise<ActionResult<{ liked: boolean; count: number }>>

toggleLikeComment(input: { commentId: string })
  : Promise<ActionResult<{ liked: boolean; count: number }>>
```

Comportement:
1. `requireAuthUser()` → exception → renvoyer `{ success: false, error: "Unauthorized" }` (ou `"Email not verified"`).
2. `getActiveSanctionFlags(user.id)` → si `banned` → `{ success: false, error: "Banned" }`.
3. Vérifier que la cible existe **et est visible** (`trashedAt: null`, `deletedAt: null`, et pour Post: `published: true`). Sinon → `{ success: false, error: "Not found" }`.
4. `prisma.$transaction`:
   - Tenter `delete` sur la composite key `(postId, userId)` / `(commentId, userId)`.
   - Si rien à delete (`P2025`), `create` à la place.
5. Recompter via `prisma.postLike.count({ where: { postId } })` dans la même transaction.
6. `revalidatePath` sur `/blog`, `/blog/[slug]` (pour le post), et la page parent du comment.
7. Retourner `{ liked: boolean, count: number }`.

Gestion de la race: la contrainte `@@unique` garantit qu'un double-create simultané jettera une `P2002` côté Prisma. Catch → retry `delete` une fois (le second clic du double a déjà créé le like).

### A.4.2 Lecture du statut

Pas d'action séparée `getPostLikeStatus`. À la place, **enrichir les queries existantes**:

- Toutes les queries qui retournent un `Post` côté public (`page.tsx` de `/blog`, `/blog/[slug]`, `/categories/[slug]`, dashboard, listing card) doivent inclure:
  ```ts
  include: {
    _count: { select: { likes: true } },
    likes: currentUserId
      ? { where: { userId: currentUserId }, select: { id: true } }
      : false,
  }
  ```
  → expose `post._count.likes` (number) et `post.likes` (array de 0 ou 1 élément → `likedByMe = post.likes.length > 0`).

- Idem pour les `Comment` chargés sur `/blog/[slug]` (page détail).

@DF: prévoir un helper `withLikeMeta(currentUserId)` qui renvoie le fragment d'include réutilisable.

### A.4.3 Format pour le client

Le `RawComment` actuel (dans `app/[locale]/(public)/blog/[slug]/page.tsx`) doit être étendu:
```ts
type RawComment = {
  // … champs existants …
  likeCount: number;
  likedByMe: boolean;
};
```

Et le type `CommentNode` (dans `components/blog/comments-section.tsx`) reçoit les mêmes deux champs.

## A.5 UI requise

### A.5.1 Bouton like — composant générique

Nouveau composant: `components/blog/like-button.tsx` (client component).

Props:
```ts
type LikeButtonProps = {
  target:
    | { kind: "post"; postId: string }
    | { kind: "comment"; commentId: string };
  initialCount: number;
  initialLiked: boolean;
  /** When false, click triggers a "sign in" toast instead of mutation. */
  isAuthenticated: boolean;
  /** When true (authenticated but email not verified), click triggers a verify-email toast. */
  requiresEmailVerification?: boolean;
  /** Visual variant. */
  size?: "sm" | "md";
  /** When true, label is screen-reader only. */
  iconOnly?: boolean;
};
```

Comportement:
- Affiche l'icône `Heart` (`lucide-react`). Style **rempli** (`fill-current`) si `liked = true`, sinon contour seulement.
- Affiche le compteur à côté (ex: `<Heart /> 12`).
- Loading: pendant la mutation, le bouton est disabled visuellement (opacité légère, pas de spinner — l'optimistic UI suffit).
- Accessibilité: `aria-pressed={liked}`, `aria-label` traduit (`"Aimer ce post"` / `"Je n'aime plus ce post"`).
- États visuels:
  - Hover (non-liked, authentifié): cœur outline → cœur rouge clair en preview.
  - Liké: cœur rouge plein.
  - Authentifié avec email non vérifié OU non connecté: cœur outline standard, clic → toast.

### A.5.2 Intégrations

| Emplacement | Variante | Action si non connecté |
|---|---|---|
| `components/blog/post-card.tsx` (listings `/blog`, `/categories/[slug]`, dashboard) | `size="sm"`, `iconOnly={true}` (icône + nombre uniquement, le bouton lui-même est cliquable sans navigation — `e.stopPropagation()` puisque la card est wrappée dans un `<Link>`) | Toast |
| `app/[locale]/(public)/blog/[slug]/page.tsx` (page détail post, header) | `size="md"`, avec label visible | Toast |
| `components/blog/comments-section.tsx` (`CommentItem`) | `size="sm"`, sous le `<MarkdownComment>` | Toast |

Cas particulier `PostCard`: le `Heart` actuel à `0` est **dans** le `<Link>` qui enveloppe toute la card. Il faut sortir le bouton like de ce Link (ou utiliser `e.preventDefault()` + `e.stopPropagation()` dans le handler) pour éviter qu'un clic navigue vers `/blog/[slug]`.

### A.5.3 Optimistic UI (TanStack Query)

Pattern à appliquer dans `useLikeMutation`:

```ts
const mutation = useMutation({
  mutationFn: toggleLikePost,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.posts.detail(slug) });
    const prev = queryClient.getQueryData(queryKeys.posts.detail(slug));
    queryClient.setQueryData(queryKeys.posts.detail(slug), (old) => ({
      ...old,
      likeCount: old.likedByMe ? old.likeCount - 1 : old.likeCount + 1,
      likedByMe: !old.likedByMe,
    }));
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(queryKeys.posts.detail(slug), ctx.prev);
    toast.error(t("likes.toast.error"));
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(slug) });
  },
});
```

Pour les comments: idem avec `queryKeys.comments.forPost(postId)`.

### A.5.4 Traductions

Ajouter dans `locales/en.ts` et `locales/fr.ts` sous le scope `likes`:

```
likes.button.likeAria
likes.button.unlikeAria
likes.toast.signInRequired
likes.toast.signInLink
likes.toast.verifyEmailRequired
likes.toast.error
likes.toast.banned
```

Exemples FR:
- `likes.toast.signInRequired`: `"Connectez-vous pour aimer ce contenu"`
- `likes.toast.signInLink`: `"Se connecter"`
- `likes.toast.verifyEmailRequired`: `"Vérifiez votre email pour pouvoir aimer du contenu"`

## A.6 Sécurité (checklist serveur)

- [ ] `toggleLikePost` / `toggleLikeComment`: `"use server"` en tête de fichier.
- [ ] Validation Zod stricte de l'input (`postId` / `commentId` non vide, format cuid optionnel).
- [ ] `requireAuthUser()` qui exige `emailVerified`.
- [ ] `getActiveSanctionFlags()` → refus si `banned`.
- [ ] Pas de log du `userId` complet en clair (`console.log` à éviter; si debug, hash partiel).
- [ ] La query qui vérifie la cible filtre `published`, `trashedAt`, `deletedAt` côté serveur (jamais faire confiance à l'UI).
- [ ] Pas de retour de données sensibles dans `ActionResult` (uniquement `liked` et `count`).

## A.7 Critères d'acceptation (testables)

- [ ] Un visiteur anonyme cliquant sur un bouton like reçoit un toast `"Connectez-vous pour aimer ce contenu"` et **aucune** ligne n'est créée en DB.
- [ ] Un utilisateur connecté avec email non vérifié reçoit le toast verify-email et **aucune** ligne n'est créée.
- [ ] Un USER connecté + email vérifié peut liker un post: la ligne `PostLike` est créée, le bouton bascule en "liked", le compteur s'incrémente immédiatement (optimistic).
- [ ] Re-cliquer sur le même post supprime la ligne `PostLike`; le compteur décrémente.
- [ ] Double-clic rapide produit le même état final qu'un clic unique (le compteur ne dérive pas).
- [ ] Deux utilisateurs différents likant le même post produisent deux lignes; `_count.likes = 2`.
- [ ] Tenter de liker un post `trashedAt != null` renvoie `{ success: false, error: "Not found" }`.
- [ ] Tenter de liker un post `published: false` (brouillon) renvoie `{ success: false, error: "Not found" }`.
- [ ] Un user banni (sanction `TEMPORARY_BAN` ou `PERMANENT_BAN` active) ne peut pas liker.
- [ ] Un user muté **peut** liker (le mute ne bloque que la création de comments).
- [ ] Supprimer un Post (hard-delete par SUPER_ADMIN sur un post `TRASHED`) supprime tous ses `PostLike` (cascade DB).
- [ ] Supprimer un User (hard-delete par SUPER_ADMIN) supprime tous ses likes (cascade DB).
- [ ] Le `_count.likes` chargé via `include: { _count: { select: { likes: true } } }` est cohérent avec un `prisma.postLike.count({ where: { postId } })`.
- [ ] Sur le listing `/blog`, le bouton like d'une card ne déclenche **pas** la navigation vers `/blog/[slug]`.
- [ ] L'attribut `aria-pressed` du bouton like reflète l'état `liked`.
- [ ] La contrainte `@@unique` rejette correctement les inserts en double; l'action serveur catch `P2002` et bascule en delete (idempotence).

## A.8 Hors-scope explicite (likes)

- Likes sur les `Category` ou les `Message` (DM).
- Liste publique "X personnes ont liké ceci".
- Notifications à l'auteur d'un post/comment liké.
- Anti-bot / rate limiting fin (>100 likes/min). Si besoin futur, ajouter via middleware ou table `RateLimit` à part.
- Statistiques admin (top posts likés, top likers). À voir en post-MVP.
- Animation cœur fancy (bursts de particules, etc.). Le `fill-current` + transition CSS courte suffit.

---

# Partie B — Upload d'image pour `Post.coverImage`

## B.1 Objectif & motivation

Actuellement, `Post.coverImage` est saisi comme une **URL libre** dans `PostForm` (`components/blog/post-form.tsx`, champ `<Input type="url">`). Conséquences:
- L'auteur doit héberger l'image ailleurs (Imgur, Cloudinary perso, etc.) → friction.
- Aucun contrôle sur la taille, le format, la pérennité (un domaine tiers peut tomber).
- Possibilité de pointer vers des images externes inappropriées sans modération.

Objectif: permettre à l'auteur d'**uploader directement** une image depuis le formulaire, stockée dans une infrastructure contrôlée par le blog, avec une **limite stricte de 1 Mo** et une validation MIME serveur.

## B.2 Règles métier détaillées

### B.2.1 Qui peut uploader ?

| Acteur | Upload sur **son propre** Post (création/édition) | Upload sur le Post d'**un autre** |
|---|---|---|
| Visiteur anonyme | ❌ | ❌ |
| USER / CUSTOMER (email vérifié, non banni) | ✅ | ❌ |
| USER / CUSTOMER (email non vérifié) | ❌ | ❌ |
| USER muté | ✅ (le mute concerne les commentaires/messages, pas les posts — cohérent avec l'action `createPost` actuelle) | ❌ |
| USER banni | ❌ | ❌ |
| MODERATOR | ❌ (pas de modification de contenu d'autrui via upload — un mod peut mettre en corbeille, pas éditer) | ❌ |
| ADMIN / SUPER_ADMIN | ✅ sur tout Post (utile pour corriger une image inappropriée par exemple) | ✅ |

Pré-requis serveur: `requireAuthUser()` + `getActiveSanctionFlags()` + check `post.authorId === user.id` (ou rôle ADMIN+).

### B.2.2 Contraintes sur le fichier

| Critère | Valeur | Vérifié côté client | Vérifié côté serveur |
|---|---|---|---|
| Taille max | **1 048 576 octets** (1 Mo, base 1024) | ✅ (refus avant upload, message clair) | ✅ (`Content-Length` ET taille réelle après lecture) |
| Types MIME acceptés | `image/jpeg`, `image/png`, `image/webp` | ✅ (`accept` HTML + check `file.type`) | ✅ (header `Content-Type` ET magic bytes) |
| Extension fichier | `.jpg`, `.jpeg`, `.png`, `.webp` | ✅ | ✅ (regex sur le nom sanitizé) |
| SVG / GIF / AVIF / HEIC | ❌ (refus) | ✅ | ✅ |
| Nom de fichier | sanitisé: ASCII, `[a-z0-9._-]+`, ≤ 80 chars | n/a (renommé serveur) | ✅ (renommage forcé) |
| Dimensions | Pas de validation explicite (la limite de 1 Mo borne déjà l'usage abusif) | n/a | n/a |

Le serveur **renomme systématiquement** le fichier en `<cuid>.<ext>` pour garantir l'unicité et éliminer tout risque sur le nom d'origine.

### B.2.3 Stratégie de stockage

**Choix retenu pour le MVP**: stockage local dans `public/uploads/posts/<filename>` (option (a)).

Motivation:
- Zéro dépendance supplémentaire, zéro variable d'env à provisioner.
- Marche immédiatement en `pnpm dev` et `pnpm build` local.
- Permet de valider le flux UX/sécurité sans bloquer sur des credentials externes.

**Disclaimer prod (à documenter dans le README ou un commentaire de la couche storage)**:

> Le stockage local **ne fonctionne pas** sur Vercel (filesystem éphémère + read-only en runtime serverless). Avant déploiement en production sur Vercel, il faut basculer la couche de stockage vers **Vercel Blob** (`@vercel/blob`), qui nécessite la variable d'environnement `BLOB_READ_WRITE_TOKEN`. La spec impose une abstraction (`lib/storage/cover-image.ts`) pour que ce swap soit isolé en un seul fichier.

### B.2.4 Couche d'abstraction obligatoire

Créer `lib/storage/cover-image.ts` qui exporte:

```ts
export type UploadedCoverImage = {
  /** Public URL to store in Post.coverImage. */
  url: string;
  /** Storage key for future deletion (optional, useful for cleanup). */
  storageKey: string;
};

export interface CoverImageStorage {
  upload(input: {
    file: ArrayBuffer;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    ownerId: string;
  }): Promise<UploadedCoverImage>;

  delete(storageKey: string): Promise<void>;
}
```

Et deux implémentations:

```ts
// lib/storage/cover-image.local.ts  — DEV/MVP
export const localCoverImageStorage: CoverImageStorage = { /* écrit dans public/uploads/posts/ */ };

// lib/storage/cover-image.vercel-blob.ts  — PROD (à activer plus tard)
export const vercelBlobCoverImageStorage: CoverImageStorage = { /* @vercel/blob */ };
```

Le choix d'implémentation se fait dans `lib/storage/cover-image.ts`:

```ts
export const coverImageStorage: CoverImageStorage =
  process.env.BLOB_READ_WRITE_TOKEN
    ? vercelBlobCoverImageStorage
    : localCoverImageStorage;
```

→ Aucun changement de code applicatif au moment du switch prod, juste la présence de la var d'env.

### B.2.5 Remplacement d'image et orphelins

Cas: un Post avait déjà un `coverImage` et l'auteur en upload un nouveau.

**Décision MVP**: l'ancienne image **n'est pas supprimée** physiquement (orpheline acceptée). Raison: simplicité, et un fichier de < 1 Mo orphelin coûte 0,00x€/an. À l'inverse, supprimer l'ancien fichier introduit des risques (suppression d'une image encore référencée si l'URL avait été collée manuellement, race avec un cache CDN, etc.).

**Documenter** ce choix dans le code + un TODO post-MVP pour ajouter une commande de purge orphelins (cron `pnpm cleanup:orphan-covers` qui scanne `public/uploads/posts/` et croise avec `Post.coverImage`).

Cas hard-delete du Post: idem, le fichier reste sur disque. Cleanup post-MVP.

### B.2.6 Conservation du champ URL manuel ?

**Oui**, on garde la possibilité de saisir une URL externe à la place de l'upload, pour deux raisons:
1. Migration: les posts existants ont déjà des URLs externes (ne pas casser).
2. Cas où l'auteur veut explicitement référencer une image hébergée ailleurs (article sur Unsplash, etc.).

UI: l'utilisateur choisit entre **"Uploader une image"** (tab principal) ou **"Coller une URL"** (tab secondaire). Le champ `coverImage` en DB reste un `String?` unique.

## B.3 Modèle de données

**Aucun changement Prisma requis** pour cette feature: le champ `Post.coverImage: String?` existe déjà et reste une URL publique (qu'elle pointe vers `/uploads/posts/...` ou un domaine externe).

Optionnel (à discuter avec @DB, peut être ajouté en post-MVP si on veut tracker l'origine):
```prisma
coverImageStorageKey String?  // null si URL externe, sinon clé pour suppression future
```

→ **Hors-scope MVP** pour ne pas bloquer.

## B.4 API / Server actions

### B.4.1 Route handler dédiée (préférée à une server action)

**Choix**: `app/api/upload/post-cover/route.ts` (Route Handler) plutôt qu'une server action.

Motivation:
- Les server actions Next.js ont une limite par défaut sur la taille du body (`bodySizeLimit`, ~1 Mo). Configurer cette limite globalement est risqué; un route handler isolé permet de borner précisément.
- Un route handler facilite la lecture en streaming (pas obligé de tout charger en mémoire pour valider la taille).
- Plus simple à tester (mock `fetch` direct).

### B.4.2 Signature

```ts
// POST /api/upload/post-cover
// Body: multipart/form-data avec champ "file"
// Réponse: { success: true, url: string } | { success: false, error: string }

export async function POST(request: Request): Promise<Response>
```

### B.4.3 Algorithme serveur

1. **Auth**: `auth.api.getSession({ headers: request.headers })`. Si pas de session → `401`.
2. **Validation utilisateur**: charger `User` en DB, vérifier `emailVerified`. Vérifier `getActiveSanctionFlags` → si banni → `403`.
3. **Lire `Content-Length`** du header. Si > 1 048 576 → `413 Payload Too Large` **avant** de lire le body.
4. **Lire `multipart/form-data`** via `request.formData()`. Récupérer `file: File`.
5. **Re-vérifier `file.size` ≤ 1 048 576** (le client peut mentir sur Content-Length, mais l'API Web `File.size` est fiable côté serveur après parse).
6. **Vérifier `file.type`** ∈ `["image/jpeg", "image/png", "image/webp"]`. Sinon → `415 Unsupported Media Type`.
7. **Lire l'`ArrayBuffer`** du fichier.
8. **Vérifier les magic bytes** (premiers octets):
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `52 49 46 46 ?? ?? ?? ?? 57 45 42 50` (RIFF…WEBP)
   - Si mismatch entre `file.type` et magic bytes → `400 Bad Request` (`"MIME mismatch"`).
9. **Sanitize / regénérer le nom**: `<cuid()>.<ext>` où ext ∈ `jpg|png|webp`.
10. **Appeler `coverImageStorage.upload(...)`** → reçoit `{ url, storageKey }`.
11. **Retourner** `{ success: true, url }`. Pas de revalidation ici — le client mettra à jour le formulaire et appellera `createPost` / `updatePost` qui revalidera.

### B.4.4 Server action pour la mise à jour du Post

L'upload **ne met pas à jour `Post.coverImage` directement**. Le flux UI:

1. L'utilisateur sélectionne un fichier.
2. Le client appelle `POST /api/upload/post-cover` et reçoit une URL.
3. Le client met le champ `coverImage` du formulaire à cette URL.
4. À la soumission du formulaire, le flow normal `createPost` / `updatePost` est appelé avec la nouvelle URL.

**Avantage**: découple la validation de fichier de la validation de contenu Post. Si l'utilisateur ferme l'onglet entre 2 et 4, on a une image orpheline (acceptée — cf. B.2.5).

### B.4.5 Server action complémentaire (optionnelle, post-MVP)

```ts
// Pour supprimer une image de couverture sans recharger toute la form
removePostCoverImage(input: { postId: string }): Promise<ActionResult>
```

→ Hors-scope MVP.

## B.5 UI requise

### B.5.1 Modifications de `components/blog/post-form.tsx`

Remplacer le champ `FormField name="coverImage"` actuel (simple `<Input type="url">`) par un nouveau composant `CoverImagePicker` (à créer dans `components/blog/cover-image-picker.tsx`).

Le `CoverImagePicker` expose deux modes (tabs shadcn):
1. **Upload** (tab par défaut):
   - Zone de drop + bouton "Choisir un fichier".
   - `<input type="file" accept="image/jpeg,image/png,image/webp" />`.
   - Au changement: validation client (taille ≤ 1 Mo, type MIME), preview locale via `URL.createObjectURL`.
   - Si valide: appel `fetch("/api/upload/post-cover", { method: "POST", body: formData })` avec barre de progression (via `XMLHttpRequest.upload.onprogress` — `fetch` ne supporte pas la progression d'upload nativement) — **MVP simplifié**: juste un spinner + `disabled` du bouton submit pendant l'upload, pas de % précis.
   - À la réponse: si `success`, set `field.onChange(url)`; sinon, toast d'erreur.
2. **URL externe** (tab secondaire, comportement actuel conservé):
   - Champ `<Input type="url">` qui met `coverImage` directement.

### B.5.2 États visuels

- **Vide**: zone pointillée avec icône `ImagePlus` (lucide-react) + texte `"Glissez une image ou cliquez pour parcourir"`.
- **Sélection en cours** (avant upload): preview de l'image + bouton "Annuler" + bouton "Uploader".
- **Upload en cours**: preview + spinner overlay + désactivation des boutons. Le bouton submit du formulaire principal est désactivé tant que l'upload n'est pas terminé.
- **Uploaded**: preview de l'image hébergée + bouton "Remplacer" + bouton "Retirer" (set `coverImage` à `""`).
- **Erreur**:
  - Taille: `"Image trop volumineuse (max 1 Mo)"`.
  - Format: `"Format non supporté (JPEG, PNG ou WebP uniquement)"`.
  - Réseau / serveur: `"Erreur d'envoi, réessayez"`.

### B.5.3 Drag & drop

**Bonus, recommandé mais pas bloquant pour le MVP**. Si implémenté: dropzone simple (un `<div>` avec `onDragOver` / `onDrop`), pas de lib externe.

### B.5.4 Traductions

Ajouter dans `locales/en.ts` et `locales/fr.ts` sous le scope `blog.coverUpload`:

```
blog.coverUpload.tabs.upload
blog.coverUpload.tabs.url
blog.coverUpload.dropzone.empty
blog.coverUpload.dropzone.button
blog.coverUpload.preview.replace
blog.coverUpload.preview.remove
blog.coverUpload.uploading
blog.coverUpload.errors.tooLarge
blog.coverUpload.errors.invalidFormat
blog.coverUpload.errors.network
blog.coverUpload.errors.unauthorized
blog.coverUpload.constraints.size
blog.coverUpload.constraints.formats
```

Exemples FR:
- `blog.coverUpload.dropzone.empty`: `"Glissez une image ou cliquez pour parcourir"`
- `blog.coverUpload.constraints.size`: `"Max 1 Mo"`
- `blog.coverUpload.constraints.formats`: `"JPEG, PNG ou WebP"`

## B.6 Sécurité (checklist serveur — point critique)

- [ ] **Authentification obligatoire** avant tout traitement (avant même de lire le body).
- [ ] **`emailVerified` requis**.
- [ ] **`banned` interdit**.
- [ ] **Vérification `Content-Length` ≤ 1 048 576** **avant** lecture du body → réponse `413` immédiate sans consommer de mémoire.
- [ ] **Re-vérification `file.size`** après parse `formData` (le `Content-Length` peut être trompé).
- [ ] **Validation MIME par magic bytes** (les 8 premiers octets), pas seulement par `Content-Type`. Tableau de signatures hardcodé dans `lib/storage/mime-detect.ts`.
- [ ] **Refus explicite de SVG** (risque XSS via `<script>` ou `onload`). Pas d'exception, même si certains acteurs ADMIN demanderaient.
- [ ] **Refus implicite de tout type non listé** (`image/gif`, `image/avif`, `image/heic`, `application/pdf`, etc.) — liste blanche stricte, pas de liste noire.
- [ ] **Nom de fichier ignoré**: le serveur génère systématiquement `<cuid>.<ext>` à partir du MIME détecté. Aucune traversée de chemin possible.
- [ ] **Pas de log du contenu** du fichier (binaire) ni du userId en clair dans les logs d'erreur.
- [ ] **Pas de retour serveur d'informations système** (chemin disque, stacktrace). En cas d'erreur, message générique `"Erreur d'envoi"`.
- [ ] **Headers de réponse** sur `/api/upload/post-cover`: `Cache-Control: no-store`.
- [ ] **Headers de service** sur le dossier `public/uploads/`: par défaut Next.js sert ces fichiers en statique — vérifier qu'aucune route `app/uploads/...` ne masque le statique. (Next 16 sert `public/*` à la racine).
- [ ] **CSRF**: le route handler utilise `request.headers` pour la session via Better Auth qui gère le cookie samesite — pas de protection custom à ajouter tant qu'on reste sur des cookies session.
- [ ] **Rate limiting**: hors-scope MVP, mais `TODO` dans le code (commenter avec lien vers un futur middleware `lib/rate-limit.ts`).

## B.7 Critères d'acceptation (testables)

- [ ] Un visiteur anonyme appelant `POST /api/upload/post-cover` reçoit `401`.
- [ ] Un user connecté mais email non vérifié reçoit `403` (ou `401`, à confirmer @DF, mais explicite).
- [ ] Un user banni reçoit `403`.
- [ ] Un user authentifié uploadant un PNG de 800 ko reçoit `{ success: true, url: "/uploads/posts/<cuid>.png" }`.
- [ ] Le fichier physique existe à `public/uploads/posts/<cuid>.png` après upload (mode local).
- [ ] Un upload de 1 100 000 octets (>1 Mo) est refusé avec `413`.
- [ ] Un upload de 2 000 000 octets est refusé **sans consommer de mémoire serveur** pour lire le body (vérification `Content-Length` préalable).
- [ ] Un fichier `.svg` est refusé (`415`) même si renommé en `.png` côté client (magic bytes différents).
- [ ] Un fichier `.exe` renommé `.png` (magic bytes ≠ PNG) est refusé (`400 "MIME mismatch"`).
- [ ] Un fichier `.gif` est refusé (`415`).
- [ ] Le nom de fichier renvoyé par l'API ne contient **jamais** le nom original (toujours `<cuid>.<ext>`).
- [ ] Le client refuse l'upload côté UI **avant** d'appeler l'API si la taille > 1 Mo (économie d'aller-retour).
- [ ] Le formulaire `PostForm` continue de marcher avec une URL externe collée manuellement (mode "URL externe" du picker).
- [ ] Après upload réussi, le champ `coverImage` du formulaire est rempli avec l'URL retournée, et la soumission du formulaire crée bien un `Post` avec ce `coverImage`.
- [ ] Remplacer une image: l'ancien fichier reste sur disque (orphelin documenté), le nouveau remplace l'URL en DB.
- [ ] La preview locale du fichier sélectionné s'affiche avant l'upload (via `URL.createObjectURL`).
- [ ] L'image uploadée s'affiche correctement via `<Image>` de Next.js sur `/blog/[slug]` (vérifier que le `next.config` autorise les paths `/uploads/*` — local, OK par défaut).
- [ ] Le bouton submit du PostForm est désactivé pendant l'upload (race condition).
- [ ] La couche `coverImageStorage` peut être swappée vers une implémentation Vercel Blob en changeant uniquement la sélection dans `lib/storage/cover-image.ts` (aucun changement dans le route handler ni dans `PostForm`).

## B.8 Hors-scope explicite (upload)

- **Redimensionnement / compression automatique** côté serveur (sharp, etc.). On garde le fichier tel quel.
- **CDN custom** ou cache headers fins. Next.js Image Optimization s'en charge déjà pour les URLs locales.
- **Images multiples par Post** (galerie).
- **Upload pour les `Comment`** (clairement hors-scope, demandé par le PO).
- **Upload pour `User.image`** (avatar). Reste sur la valeur OAuth ou URL Better Auth.
- **Cleanup automatique des orphelins**.
- **Rate limiting per-user**.
- **Antivirus / scan de contenu** (ClamAV, etc.).
- **Watermarking**.
- **EXIF stripping**. À ajouter si on découvre que les EXIFs contiennent des données sensibles (GPS) — pas une priorité pour un blog tech.
- **Migration vers Vercel Blob**. Décrite mais à exécuter au moment du déploiement prod, pas dans cette itération.
- **Suppression du fichier au hard-delete du Post**. La cascade Prisma supprime la ligne; le fichier reste. Cleanup post-MVP.

---

# Synthèse pour @DB et @DF

**@DB** (modèle Prisma):
- Ajouter `PostLike` et `CommentLike` (cf. A.3.1 / A.3.2) avec relations inverses (A.3.3) et index (A.3.4).
- **Aucun changement** sur `Post.coverImage` — le champ existant est suffisant.
- Migration: `pnpm db:migrate` standard, pas de data backfill.

**@DF** (back):
- Créer `lib/actions/likes.ts` avec `toggleLikePost` et `toggleLikeComment` (cf. A.4.1).
- Créer `lib/storage/cover-image.ts` + impl local + stub Vercel Blob (cf. B.2.4).
- Créer `app/api/upload/post-cover/route.ts` (cf. B.4).
- Étendre toutes les queries Post/Comment publiques avec `_count.likes` + filtre par `userId` courant (cf. A.4.2).

**@DF** (front):
- Créer `components/blog/like-button.tsx` (cf. A.5.1).
- Intégrer le bouton dans `PostCard`, page détail post, `CommentsSection` (cf. A.5.2).
- Créer `components/blog/cover-image-picker.tsx` avec tabs Upload/URL (cf. B.5.1).
- Modifier `components/blog/post-form.tsx` pour intégrer le picker.
- Ajouter les clés de traduction (cf. A.5.4 et B.5.4).
- Implémenter l'optimistic UI TanStack Query (cf. A.5.3).

**Tests prioritaires** (Vitest + jsdom):
- Server actions likes: auth, ban, idempotence, cascade.
- Route handler upload: tailles limites, MIME mismatch, magic bytes.
- Composant `LikeButton`: rendu, états, comportement non-connecté.
