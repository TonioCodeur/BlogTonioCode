# Trash Feature — Cahier des charges (PO)

Référence: `prisma/schema.prisma` (modèles `Post`, `Comment`, `User`), `lib/actions/blog.ts` (actions actuelles `deletePost` / `deleteComment`), `docs/PO-ACCEPTANCE.md` (règles existantes).

Auteur: @PO — destiné à @DB (modèle) et @DF (back/front).

---

## 1. Objectif & motivation

Aujourd'hui un MODERATOR peut, via `deletePost`, **supprimer définitivement** un Post (et toute sa chaîne de Comments par cascade Prisma). Cette action est destructive, irréversible, et concentre un pouvoir trop important sur le rôle MODERATOR — qui est par définition un rôle de modération de premier niveau, pas de gouvernance.

Objectif: introduire une **corbeille** (soft-delete par modération) pour `Post` et `Comment`, afin que:

- Les MODERATOR puissent retirer du contenu litigieux **sans perte de données**.
- Les ADMIN / SUPER_ADMIN gardent seuls le contrôle des actions irréversibles (restauration, suppression définitive, vidage de la corbeille).
- Les auteurs conservent un droit minimal sur leur propre contenu, sans pouvoir contourner la modération une fois déclenchée.

Non-objectif: ce n'est pas un système d'audit/judiciaire. Pas de workflow d'approbation multi-niveaux, pas de notifications mail, pas de quotas. On reste sur un blog.

---

## 2. Règles métier détaillées

### 2.1 Vocabulaire

On distingue **trois états** pour un Post ou un Comment:

| État | Déclencheur | Visible public | Visible auteur | Visible modérateur | Visible admin |
|---|---|---|---|---|---|
| `VISIBLE` | défaut | oui (si `published=true` pour Post) | oui | oui | oui |
| `AUTHOR_DELETED` (soft-delete auteur) | l'auteur supprime son contenu | non | non (mais ses comments restent en tombstone, cf. 2.4) | non | oui (audit) |
| `TRASHED` (corbeille modération) | un MODERATOR+ envoie en corbeille | non | non (mais reçoit un signal "votre contenu a été modéré", cf. 2.5) | non (sauf la page admin trash si MODERATOR a l'accès lecture — voir 2.6) | oui (page `/admin/trash`) |

Note: un même contenu **ne peut pas être à la fois `AUTHOR_DELETED` et `TRASHED`**. Si l'auteur supprime son contenu **après** qu'il a été mis en corbeille par un modérateur, l'action est refusée (l'état modération prévaut). Si un modérateur envoie en corbeille un contenu déjà supprimé par son auteur, l'état bascule en `TRASHED` (la modération écrase le soft-delete auteur, car elle ajoute une traçabilité utile).

### 2.2 Matrice d'autorisations

Légende: ✅ autorisé · ❌ refusé · ✅* sur ses propres contenus uniquement.

#### Sur un Post

| Action | USER / CUSTOMER (auteur) | USER / CUSTOMER (non-auteur) | MODERATOR | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| `softDeleteOwn` (auteur supprime son post) | ✅* | ❌ | ❌ | ❌ | ❌ |
| `moveToTrash` (envoi en corbeille) | ❌ | ❌ | ✅ | ✅ | ✅ |
| `restoreFromTrash` (sortie de corbeille) | ❌ | ❌ | ❌ | ✅ | ✅ |
| `hardDelete` (suppression définitive d'un item en corbeille) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `emptyTrash` (vidage global) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `listTrashed` (lecture de la corbeille) | ❌ | ❌ | ✅ (lecture seule) | ✅ | ✅ |

#### Sur un Comment

Même matrice. Seule différence: `softDeleteOwn` d'un commentaire est conservé tel quel (cf. champ `deletedAt` déjà présent), mais doit être **distinct** de `TRASHED` (cf. 2.1).

#### Décisions clés motivées

- **Auteur = soft-delete uniquement** (pas de hard-delete par l'auteur). Raison: un auteur ne doit pas pouvoir effacer un contenu litigieux pour échapper à la modération. Son "suppression" met le contenu en `AUTHOR_DELETED` — invisible du public, mais récupérable côté admin si besoin (ex: contestation d'une sanction).
- **MODERATOR ne peut pas restaurer.** Raison principale: éviter qu'un MODERATOR mette en corbeille puis "ré-active" à volonté un contenu, ce qui équivaudrait à un pouvoir éditorial complet. Restaurer est une décision éditoriale → ADMIN+.
- **Hard-delete réservé au SUPER_ADMIN.** Raison: l'ADMIN modère, le SUPER_ADMIN gouverne. Cohérent avec `lib/actions/admin.ts` qui réserve déjà `deleteUser` et `changeUserRole` au SUPER_ADMIN.
- **MODERATOR a un accès lecture** à `/admin/trash` (mais pas d'actions destructives ni restauration). Raison: leur permettre de voir l'historique de leurs propres mises en corbeille et d'éviter les doublons.

### 2.3 Que voit le public ?

- Un Post `TRASHED` ou `AUTHOR_DELETED` est **invisible** sur `/blog`, `/categories/[slug]`, `/blog/[slug]` (404), recherche, RSS, sitemap.
- Un Comment `TRASHED` ou `AUTHOR_DELETED` est **rendu comme tombstone** (`"[supprimé]"`) dans le thread, pour préserver la structure des réponses (cf. règle existante dans `PO-ACCEPTANCE.md`). Le contenu original n'est jamais exposé côté public.

### 2.4 Que voit l'auteur ?

- Sur son dashboard `/dashboard`, ses posts `TRASHED` sont listés dans une section dédiée **"Modéré"** avec un libellé clair (`"Retiré par la modération"`) et la raison (`trashReason`) si elle est marquée publique (par défaut: oui pour le post, voir 3.1). Pas de bouton de restauration.
- Ses posts `AUTHOR_DELETED` ne sont **pas** listés (cohérent avec une suppression assumée par l'utilisateur).
- Sur ses commentaires: même logique, mais regroupés sous "Commentaires modérés" si l'UI dashboard évolue (post-MVP — non bloquant).

### 2.5 Que voit le modérateur ?

- Dans le fil public, les Posts `TRASHED` n'apparaissent pas (un modérateur lit le site comme tout le monde).
- Dans `/admin/trash`, il voit la liste des contenus en corbeille, qui les a mis, quand, pour quelle raison. Pas de bouton "Restaurer" ni "Supprimer définitivement".
- Sur la page d'un post visible, chaque comment expose une action **"Mettre en corbeille"** (avec dialog de confirmation + champ "Raison").
- Idem sur la liste des posts: action **"Mettre en corbeille ce post"** depuis un menu contextuel.

### 2.6 Que voit l'admin ?

- Tout ce que voit le modérateur, **plus**:
  - Boutons "Restaurer" et (SUPER_ADMIN uniquement) "Supprimer définitivement".
  - Un bouton "Vider la corbeille" (SUPER_ADMIN uniquement), avec confirmation explicite et double saisie ("tapez VIDER pour confirmer").
  - Le contenu intégral du Post / Comment en corbeille (titre, body, slug, auteur), pas seulement les métadonnées.

### 2.7 Cascade

**Quand un Post passe en `TRASHED`:**

- Ses commentaires **ne changent pas d'état** individuellement. Ils restent `VISIBLE` en base, mais ne sont **plus accessibles** parce que le post lui-même ne l'est pas. Raison: si on restaure le post plus tard, le thread doit revivre intact. Pas de double soft-delete artificiel.
- Si un comment était déjà `TRASHED` indépendamment, il reste `TRASHED` (pas de doublon).
- À la restauration du Post: les comments redeviennent accessibles automatiquement (ils n'ont jamais changé).
- Au **hard-delete** du Post: la cascade Prisma actuelle (`onDelete: Cascade` sur `Comment.postId`) s'applique → les comments sont eux aussi supprimés définitivement. C'est voulu et documenté à l'utilisateur dans le dialog de confirmation.

**Quand un Comment passe en `TRASHED`:**

- N'affecte pas le Post.
- Les `replies` (enfants) restent visibles en base, mais l'UI affiche un tombstone à la place du parent et continue d'afficher les enfants (cohérent avec la pratique actuelle).

### 2.8 Effets dérivés

- **Compteur de commentaires d'un post (`_count.comments`)**: ne doit compter **que les comments visibles publiquement**, càd ni `TRASHED` ni `AUTHOR_DELETED`. Conséquence pour @DB / @DF: toutes les queries publiques qui font un `_count.comments` doivent filtrer (`where: { trashedAt: null, deletedAt: null }`).
- **Author affiché**: pour un comment en tombstone, on rend `"[supprimé]"` au lieu du nom d'auteur (déjà la convention pour `deletedAt`). Aucun changement pour `TRASHED` côté public — c'est aussi un tombstone.
- **Recherche, RSS, sitemap, OG cards**: doivent exclure tout post `trashedAt != null` ou `deletedAt != null`.
- **Sanctions**: la mise en corbeille **n'émet pas** automatiquement de sanction. Une mise en corbeille répétée d'un même auteur reste à l'appréciation de l'ADMIN qui décidera manuellement d'appliquer un `WARNING` ou `MUTE` via le flux existant.

---

## 3. Modèle de données (haut niveau)

@DB est responsable de la version Prisma finale. Voici les besoins métier.

### 3.1 Post — nouveaux champs

| Champ | Type | Nullable | Sens |
|---|---|---|---|
| `deletedAt` | `DateTime` | oui | Soft-delete par l'auteur (analogue à `Comment.deletedAt` actuel). |
| `trashedAt` | `DateTime` | oui | Mise en corbeille par modération. `null` = pas en corbeille. |
| `trashedById` | `String` (FK `User.id`, `onDelete: SetNull`) | oui | Modérateur ayant déclenché l'action. `null` toléré si le compte est supprimé. |
| `trashReason` | `String` | oui (mais requis à l'écriture, cf. 4.1) | Motif de modération. ≤ 500 caractères. **Visible par l'auteur** (cf. 2.4). |
| `trashNotes` | `String` | oui | Notes internes admin (≤ 2 000 chars), non visibles par l'auteur. Analogue à `Sanction.notes`. |

**Invariant**: `trashedAt != null ⇔ trashedById` peut être null (cas: compte modérateur supprimé) **mais** `trashReason` doit être renseigné au moment de la mise en corbeille.

### 3.2 Comment — nouveaux champs

Le champ `deletedAt` existe déjà → conservé pour le soft-delete auteur.

| Champ | Type | Nullable | Sens |
|---|---|---|---|
| `trashedAt` | `DateTime` | oui | Mise en corbeille modération. |
| `trashedById` | `String` (FK `User.id`, `onDelete: SetNull`) | oui | Modérateur déclencheur. |
| `trashReason` | `String` | oui (idem 3.1) | Motif visible par l'auteur. |
| `trashNotes` | `String` | oui | Notes internes admin. |

Pas besoin d'un enum d'état: la combinaison `(deletedAt, trashedAt)` suffit. Lecture canonique:

```
trashedAt != null              → TRASHED
trashedAt == null && deletedAt != null → AUTHOR_DELETED
les deux null                  → VISIBLE
```

### 3.3 Indexes recommandés

- `Post`: `@@index([trashedAt])` pour lister la corbeille triée par date.
- `Post`: l'index existant `@@index([published, publishedAt])` reste, mais @DF veillera à ajouter `trashedAt: null` dans les queries publiques (pas besoin de l'index pour ça).
- `Comment`: `@@index([trashedAt])` idem.
- Optionnel mais utile: `@@index([trashedById])` sur `Post` et `Comment` pour filtrer la corbeille par modérateur.

### 3.4 Pas de table séparée

On reste sur des colonnes en place. Une table `TrashEntry` ajouterait de la complexité (jointures, sync, désynchros possibles) sans bénéfice — la corbeille est lue à la volée comme `where: { trashedAt: { not: null } }`.

---

## 4. API / Server actions

À ajouter dans `lib/actions/blog.ts` (style existant: `"use server"`, retours `ActionResult<T>`, validation Zod, helpers `requireAuthUser` / `requireModerator` déjà en place + nouveaux `requireAdmin` / `requireSuperAdmin` à importer depuis `lib/actions/admin.ts` ou à dédupliquer dans `lib/auth/guards.ts`).

### 4.1 Mise en corbeille

```ts
// MODERATOR / ADMIN / SUPER_ADMIN
moveToTrashPost(input: { postId: string; reason: string; notes?: string })
  : Promise<ActionResult>

moveToTrashComment(input: { commentId: string; reason: string; notes?: string })
  : Promise<ActionResult>
```

- `reason`: 1–500 chars, requis, trimé.
- `notes`: ≤ 2 000 chars, optionnel.
- Erreurs: 404 si l'entité n'existe pas; `"Already in trash"` si `trashedAt != null` (idempotence soft: on retourne `success: true` sans rejouer — à confirmer @DF, je tranche pour **erreur explicite** afin d'éviter un double-clic silencieux).
- Side-effects: `revalidatePath` sur `/blog`, `/blog/[slug]`, `/admin/trash`, `/dashboard`.

### 4.2 Restauration

```ts
// ADMIN / SUPER_ADMIN
restorePost(input: { postId: string }): Promise<ActionResult>
restoreComment(input: { commentId: string }): Promise<ActionResult>
```

- Annule `trashedAt`, `trashedById`, `trashReason`, `trashNotes` (les met à `null`).
- N'affecte pas `published` du Post (un post non publié restauré reste non publié).
- N'affecte pas `deletedAt` (si l'auteur l'avait aussi supprimé avant, il reste `AUTHOR_DELETED`).
- Erreurs: 404; `"Not in trash"` si déjà restauré.

### 4.3 Suppression définitive

```ts
// SUPER_ADMIN
hardDeletePost(input: { postId: string }): Promise<ActionResult>
hardDeleteComment(input: { commentId: string }): Promise<ActionResult>
```

- **Pré-requis**: l'entité doit être `TRASHED` (`trashedAt != null`). Refus sinon → force le flux "corbeille d'abord, suppression ensuite", évitant qu'un SUPER_ADMIN supprime accidentellement un contenu live.
- Action: `prisma.post.delete` / `prisma.comment.delete` (cascade Prisma s'applique).

### 4.4 Vidage de corbeille

```ts
// SUPER_ADMIN
emptyTrash(input: { olderThanDays?: number }): Promise<ActionResult<{ posts: number; comments: number }>>
```

- Supprime définitivement tous les Posts et Comments avec `trashedAt != null`.
- Si `olderThanDays` est fourni: ne supprime que ceux dont `trashedAt < now - olderThanDays`.
- Retourne le nombre d'éléments supprimés par type.

### 4.5 Lecture de la corbeille

```ts
// MODERATOR (lecture seule) / ADMIN / SUPER_ADMIN
listTrashedPosts(input?: { page?: number; pageSize?: number })
  : Promise<ActionResult<{
      items: Array<{
        id: string; title: string; slug: string;
        authorName: string | null;
        trashedAt: Date; trashedBy: { name: string } | null;
        trashReason: string; trashNotes: string | null;
      }>;
      total: number;
    }>>

listTrashedComments(input?: { page?: number; pageSize?: number })
  : Promise<ActionResult<{
      items: Array<{
        id: string; content: string;
        postId: string; postSlug: string; postTitle: string;
        authorName: string | null;
        trashedAt: Date; trashedBy: { name: string } | null;
        trashReason: string; trashNotes: string | null;
      }>;
      total: number;
    }>>
```

- Pagination: `pageSize` par défaut 20, max 100.
- Tri: `trashedAt desc`.
- `trashNotes` est inclus uniquement si le caller est ADMIN/SUPER_ADMIN (filtré côté serveur si MODERATOR).

### 4.6 Modification des actions existantes

`deletePost` et `deleteComment` (dans `lib/actions/blog.ts`) doivent être réécrits:

- Si caller = auteur → soft-delete (`deletedAt = now()`) pour Post et Comment (uniformisation: aujourd'hui `deletePost` fait un hard-delete pour l'auteur, ce qui devient incohérent).
- Si caller = MODERATOR+ → **bascule en corbeille** (`moveToTrashPost` / `moveToTrashComment`), avec une `reason` par défaut `"Modération sans motif renseigné"` si l'appel se fait depuis l'ancien flux. **Mieux**: déprécier `deletePost`/`deleteComment` pour les MODERATOR+ et forcer l'appel explicite à `moveToTrashPost` côté UI.
- Refus si auteur tente de supprimer un contenu déjà `TRASHED` (cf. 2.1).

---

## 5. UI requise

### 5.1 Page admin `/admin/trash`

Nouveau dossier `app/[locale]/(protected)/admin/trash/`:

- `page.tsx` — Server Component. Check `requireAdmin()` (lecture autorisée à MODERATOR aussi, donc plutôt `requireModerator()`). Affiche deux onglets / tables: **Posts en corbeille** et **Commentaires en corbeille**.
- Colonnes Posts: titre (lien vers preview admin), auteur, modérateur, date de mise en corbeille, raison, actions.
- Colonnes Comments: extrait (50 chars + tooltip), post parent (lien), auteur, modérateur, date, raison, actions.
- Actions (boutons conditionnels selon rôle):
  - `MODERATOR`: aucun bouton d'action — lecture seule.
  - `ADMIN`: "Restaurer".
  - `SUPER_ADMIN`: "Restaurer" + "Supprimer définitivement" + "Vider la corbeille" (en haut de page).
- Chaque action destructive ouvre un `<Dialog>` shadcn de confirmation, avec rappel des conséquences (cascade pour Post).
- "Vider la corbeille" demande une **saisie explicite** ("Tapez VIDER pour confirmer") et accepte un input optionnel `olderThanDays`.

### 5.2 Actions modérateur dans le site

- Sur `/blog/[slug]` (page post): un menu contextuel "Modération" visible si MODERATOR+. Items:
  - "Mettre ce post en corbeille" → ouvre un dialog avec champ `reason` (requis, 1–500 chars) + champ `notes` (admin only).
- Sur chaque comment d'un thread: un bouton "..." visible si MODERATOR+ avec:
  - "Mettre en corbeille" → même dialog.

### 5.3 Actions auteur

- Sur ses propres posts (dashboard ou page post si auteur connecté): bouton "Supprimer" → dialog de confirmation simple → `softDeleteOwn`. Pas de champ `reason`.
- Sur ses propres comments: bouton "Supprimer" → soft-delete (`deletedAt`) avec confirmation inline.
- Si le contenu est déjà `TRASHED`: les boutons "Supprimer" sont **désactivés** côté auteur, avec un tooltip explicatif ("Ce contenu est sous modération").

### 5.4 Feedback (toasts)

Utiliser `sonner` (déjà branché dans `app/[locale]/layout.tsx`). Messages en français:

- Mise en corbeille: `"Contenu envoyé en corbeille"`.
- Restauration: `"Contenu restauré"`.
- Hard-delete: `"Contenu supprimé définitivement"`.
- Vidage: `"Corbeille vidée — {n} éléments supprimés"`.
- Erreurs serveur: relayer `result.error` du `ActionResult` tel quel.

### 5.5 Traductions

Ajouter les clés dans `locales/en.ts` et `locales/fr.ts` sous le scope `trash`:

```
trash.title, trash.tabs.posts, trash.tabs.comments,
trash.actions.moveToTrash, trash.actions.restore, trash.actions.hardDelete, trash.actions.emptyTrash,
trash.confirm.moveToTrash, trash.confirm.restore, trash.confirm.hardDelete, trash.confirm.empty,
trash.fields.reason, trash.fields.reasonPlaceholder, trash.fields.notes, trash.fields.confirmEmpty,
trash.toast.moved, trash.toast.restored, trash.toast.hardDeleted, trash.toast.emptied,
trash.authorView.moderated, trash.authorView.moderatedReason
```

---

## 6. Critères d'acceptation (testable)

- [ ] `moveToTrashPost` appelé par un USER renvoie `{ success: false, error: "Forbidden" }`.
- [ ] `moveToTrashPost` appelé par un MODERATOR avec une `reason` valide met `trashedAt`, `trashedById`, `trashReason` à jour.
- [ ] Un post `TRASHED` n'apparaît pas dans `/blog`, `/blog/[slug]` (404), `/categories/[slug]`.
- [ ] Le `_count.comments` d'un post visible **n'inclut pas** les comments `TRASHED` ni `AUTHOR_DELETED`.
- [ ] `restorePost` appelé par un MODERATOR renvoie `Forbidden`.
- [ ] `restorePost` appelé par un ADMIN remet `trashedAt = null` et réaffiche le post (si `published = true`).
- [ ] `hardDeletePost` appelé par un ADMIN (non SUPER) renvoie `Forbidden`.
- [ ] `hardDeletePost` appelé par un SUPER_ADMIN sur un post **non en corbeille** est refusé (`"Post must be in trash before hard delete"`).
- [ ] `hardDeletePost` sur un post en corbeille supprime le Post et cascade sur ses Comments.
- [ ] `emptyTrash({ olderThanDays: 30 })` ne supprime que les éléments dont `trashedAt < now - 30 jours`.
- [ ] Un auteur tentant de soft-delete un contenu déjà `TRASHED` reçoit une erreur (`"Content is under moderation"`).
- [ ] La page `/admin/trash` est inaccessible (redirect `/dashboard`) pour un USER/CUSTOMER.
- [ ] La page `/admin/trash` est accessible en lecture seule pour un MODERATOR (aucun bouton d'action visible).
- [ ] Le dialog "Vider la corbeille" refuse la soumission tant que l'utilisateur n'a pas tapé exactement `VIDER`.
- [ ] Sur le dashboard d'un auteur dont un post est `TRASHED`, ce post apparaît dans une section "Modéré" avec la `trashReason` visible (pas `trashNotes`).
- [ ] Un comment `TRASHED` est rendu comme `"[supprimé]"` côté public, et ses replies restent affichées.
- [ ] Toutes les nouvelles server actions: validation Zod en place, retour `ActionResult`, jamais d'exception non catchée.

---

## 7. Hors-scope explicite

Ce qui **n'est pas** dans cette itération:

- Notifications email à l'auteur lors d'une mise en corbeille (à voir post-MVP).
- Historique chronologique multi-événements (`trashedAt → restoredAt → re-trashedAt`). On garde un seul état courant; pas d'audit log dédié pour l'instant.
- Système d'appel / contestation par l'auteur.
- Purge automatique programmée (cron) de la corbeille. `emptyTrash` reste manuel.
- Mise en corbeille de `Category`. Une catégorie reste protégée par `onDelete: Restrict` côté Prisma (cf. `PO-ACCEPTANCE.md`).
- Quotas anti-abus modérateur (ex: "max 50 mises en corbeille / 24h"). À ajouter si on observe un abus en prod.
- Recherche / filtre avancé dans `/admin/trash` (par modérateur, par auteur, par date). Pagination simple suffit pour le MVP.
- Export CSV de la corbeille.
- Synchronisation messaging (`Message.deletedByAdminId`) — ce flux existe déjà et reste indépendant.
