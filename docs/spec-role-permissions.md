# Spec — Refonte de la matrice de permissions (MODERATOR / ADMIN / SUPER_ADMIN)

> Statut : **prêt à implémenter**
> Auteur : PO
> Ticket : Permissions par rôle dans la zone admin
> Branche cible : `main`

---

## 1. Contexte et objectif

Le projet définit cinq rôles dans Prisma : `USER`, `CUSTOMER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`. Aujourd'hui, **seul `SUPER_ADMIN` peut promouvoir un utilisateur** via `lib/actions/admin.ts::changeUserRole`. L'utilisateur veut **déléguer une partie du pouvoir** : un `ADMIN` doit pouvoir **nommer des `MODERATOR`** sans pouvoir s'auto-promouvoir ou créer d'autres `ADMIN/SUPER_ADMIN`. En parallèle, on aligne les permissions sur les actions de modération (sanctions, corbeille).

Cibles fonctionnelles (verbatim utilisateur, traduit en règles) :

- **MODERATOR** : pas de gestion des rôles. **Peut** infliger des sanctions. **Peut** envoyer posts/commentaires à la corbeille.
- **ADMIN** : hérite des droits MODERATOR + **peut nommer des MODERATOR** + **peut hard-delete les posts/commentaires de la corbeille**.
- **SUPER_ADMIN** : tout, sans restriction (sauf suicide privilège, voir §3).

---

## 2. Matrice de permissions complète

Légende : ✅ autorisé · ❌ refusé · ⚠️ autorisé avec restrictions (voir §3 et §4).

| Action | USER | CUSTOMER | MODERATOR | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| Accéder à `/admin` (page liste users) | ❌ | ❌ | ✅ (vue restreinte) | ✅ | ✅ |
| Accéder à `/admin/trash` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `getUsers` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `getUserSanctions` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `createSanction` (sur un non-admin) | ❌ | ❌ | ✅ | ✅ | ✅ |
| `createSanction` (sur ADMIN/SUPER_ADMIN) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `revokeSanction` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `changeUserRole` | ❌ | ❌ | ❌ | ⚠️ (cf. §3) | ✅ |
| `deleteUser` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `moveToTrashPost` / `moveToTrashComment` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `restorePost` / `restoreComment` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `hardDeletePost` / `hardDeleteComment` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `emptyTrash` (vidage en masse) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `listTrashedPosts` / `listTrashedComments` | ❌ | ❌ | ✅ (sans notes) | ✅ (avec notes) | ✅ |

**Changements vs. existant** (en gras = changement requis) :

- `createSanction` : **MODERATOR+** (était ADMIN+).
- `revokeSanction` : ADMIN+ (inchangé — décision PO : la révocation reste une opération sensible).
- `changeUserRole` : **ADMIN+ avec restrictions** (était SUPER_ADMIN-only).
- `hardDeletePost` / `hardDeleteComment` : **ADMIN+** (était SUPER_ADMIN-only).
- `emptyTrash` : SUPER_ADMIN (inchangé — opération destructive non récupérable, on garde un seul garde-fou).
- `/admin` accessible aux MODERATOR : **nouveau** (vue restreinte, cf. §4).

---

## 3. Règles exactes pour `changeUserRole`

### 3.1 Auto-modification

**Interdit pour tous, y compris SUPER_ADMIN.** Aucun utilisateur ne peut modifier son propre rôle via cette action. Cela évite à un `SUPER_ADMIN` solitaire de se rétrograder par erreur (la création/changement de SUPER_ADMIN se fait via base de données ou un autre SUPER_ADMIN).

- Erreur : `"Cannot change your own role"` → clé i18n `admin.role.errors.selfChange`.

### 3.2 Matrice (rôle caller × rôle actuel cible × rôle nouveau)

#### Caller = ADMIN

Le `ADMIN` ne peut agir que sur des cibles dont le rôle actuel est `USER`, `CUSTOMER` ou `MODERATOR`. Il peut leur attribuer uniquement `USER`, `CUSTOMER` ou `MODERATOR`.

| Rôle actuel cible \ Nouveau rôle | USER | CUSTOMER | MODERATOR | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| USER | ✅ | ✅ | ✅ | ❌ | ❌ |
| CUSTOMER | ✅ | ✅ | ✅ | ❌ | ❌ |
| MODERATOR | ✅ | ✅ | ✅ | ❌ | ❌ |
| ADMIN | ❌ | ❌ | ❌ | ❌ | ❌ |
| SUPER_ADMIN | ❌ | ❌ | ❌ | ❌ | ❌ |

**Décision PO — rétrogradation d'un MODERATOR par un ADMIN : OUI, autorisée.**
Justification : si un `ADMIN` peut nommer un `MODERATOR`, il doit aussi pouvoir le révoquer pour gérer les erreurs de nomination et les comportements problématiques. Sans cela, on bloquerait l'`ADMIN` derrière un `SUPER_ADMIN` pour chaque révocation, ce qui casse l'autonomie qu'on lui donne. Symétrie de pouvoir = symétrie de responsabilité.

**Refus & messages d'erreur côté server action :**

- Cible a un rôle `ADMIN` ou `SUPER_ADMIN` → `"Admins cannot modify other admins or super admins"` (clé `admin.role.errors.targetIsAdmin`).
- Nouveau rôle = `ADMIN` ou `SUPER_ADMIN` → `"Admins cannot grant ADMIN or SUPER_ADMIN role"` (clé `admin.role.errors.cannotGrantAdmin`).

#### Caller = SUPER_ADMIN

Le `SUPER_ADMIN` peut **tout faire sauf modifier son propre rôle** (cf. §3.1). Il peut promouvoir vers tous les rôles, y compris `SUPER_ADMIN`, et peut rétrograder un autre `SUPER_ADMIN` (cohérence avec `deleteUser` qui interdit déjà la suppression d'un autre SUPER_ADMIN — ici on autorise la rétrogradation puisqu'on garde une trace user).

| Rôle actuel cible \ Nouveau rôle | USER | CUSTOMER | MODERATOR | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| USER | ✅ | ✅ | ✅ | ✅ | ✅ |
| CUSTOMER | ✅ | ✅ | ✅ | ✅ | ✅ |
| MODERATOR | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Caller = MODERATOR, USER, CUSTOMER

Refus systématique : `"Forbidden"` (clé `admin.role.errors.forbidden`).

### 3.3 No-op : nouveau rôle == rôle actuel

Si `newRole === target.role`, la requête est traitée comme un succès silencieux (`{ success: true }`) sans toucher la DB ni dispatcher de bot. Évite les écritures inutiles et les notifications parasites.

---

## 4. Contrat d'API — Server Actions modifiées

> Convention : toutes les actions utilisent `ActionResult<T>` (`{ success: true, data? } | { success: false, error: string }`). Les nouvelles règles sont implémentées dans **`lib/actions/admin.ts`** et **`lib/actions/trash.ts`**. Le fichier **`app/actions/admin.ts` doit être supprimé** (voir §6).

### 4.1 `changeUserRole` (`lib/actions/admin.ts`)

**Signature**

```ts
const changeUserRoleSchema = z.object({
  userId: z.string().min(1),
  newRole: z.enum(["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]),
});

export async function changeUserRole(
  input: z.infer<typeof changeUserRoleSchema>,
): Promise<ActionResult<{ id: string; role: Role }>>;
```

**Algorithme**

1. `requireAdmin()` (ADMIN ou SUPER_ADMIN, sinon throw `Forbidden`).
2. `changeUserRoleSchema.parse(input)`.
3. Si `userId === caller.userId` → erreur `selfChange`.
4. `target = prisma.user.findUnique({ where: { id: userId } })`. Si null → erreur `"User not found"`.
5. Si `newRole === target.role` → `return { success: true, data: { id: target.id, role: target.role } }`.
6. **Si caller.role === "ADMIN"** :
   - Si `target.role ∈ {ADMIN, SUPER_ADMIN}` → erreur `targetIsAdmin`.
   - Si `newRole ∈ {ADMIN, SUPER_ADMIN}` → erreur `cannotGrantAdmin`.
7. `update`, dispatch bots (`dispatchBotsOnRoleChanged`), retourner `{ success: true, data: { id, role } }`.

**Erreurs renvoyées (toutes via `ActionResult.error`, message anglais côté server)**

| Code conceptuel | Message anglais | Clé i18n |
|---|---|---|
| `unauthorized` | `Unauthorized` | `admin.role.errors.unauthorized` |
| `forbidden` | `Forbidden` | `admin.role.errors.forbidden` |
| `selfChange` | `Cannot change your own role` | `admin.role.errors.selfChange` |
| `userNotFound` | `User not found` | `admin.role.errors.userNotFound` |
| `targetIsAdmin` | `Admins cannot modify other admins or super admins` | `admin.role.errors.targetIsAdmin` |
| `cannotGrantAdmin` | `Admins cannot grant ADMIN or SUPER_ADMIN role` | `admin.role.errors.cannotGrantAdmin` |
| `validation` | message Zod | `admin.role.errors.invalidInput` |

**Décision retour** : on harmonise sur le pattern `ActionResult` (try/catch + `{ success, error }`) plutôt que `throw`. Cela aligne `changeUserRole` sur le reste du module (les actions trash sont déjà sous ce format) et évite que la UI dépende de `try/catch` global.

### 4.2 `createSanction` (`lib/actions/admin.ts`)

**Changement** : abaisser le seuil de `requireAdmin()` à **MODERATOR+**.

```ts
// avant : await requireAdmin();
// après :
const caller = await requireModerator(); // MODERATOR | ADMIN | SUPER_ADMIN
```

Règle conservée : un `MODERATOR` ou `ADMIN` ne peut pas sanctionner un `ADMIN` ou `SUPER_ADMIN`. Seul un `SUPER_ADMIN` peut sanctionner un `ADMIN`. Personne ne peut sanctionner un `SUPER_ADMIN` via cette action (PO décision : pour sanctionner un SUPER_ADMIN, passer par une autre voie hors-app).

Ajout du helper `requireModerator()` (équivalent à `requireModeratorRole` dans `trash.ts`, mais à placer dans `admin.ts` ; ou bien factoriser dans `lib/auth-roles.ts` — voir §6).

Erreur `"Cannot sanction an admin"` → clé i18n `admin.sanction.errors.targetIsAdmin`.

### 4.3 `revokeSanction` (`lib/actions/admin.ts`)

**Inchangé** : reste à `requireAdmin()` (ADMIN+). Décision PO : la révocation est un acte de désaveu de modérateur, on garde le contrôle au niveau ADMIN.

### 4.4 `hardDeletePost` / `hardDeleteComment` (`lib/actions/trash.ts`)

**Changement** : passer de `requireSuperAdminRole()` à `requireAdminRole()`.

```ts
// avant : const caller = await requireSuperAdminRole();
// après :
const caller = await requireAdminRole();
```

Le reste de la logique (post doit être dans la corbeille avant hard-delete, log, revalidate) ne change pas.

### 4.5 `emptyTrash` (`lib/actions/trash.ts`)

**Inchangé** : reste `requireSuperAdminRole()`. Décision PO : vidage en masse irréversible, on conserve un dernier garde-fou.

### 4.6 `deleteUser` (`lib/actions/admin.ts`)

**Inchangé** : reste `requireSuperAdmin()`.

---

## 5. Règles UI — Page `/admin` et table utilisateurs

### 5.1 Accès à la page `/admin`

**Décision PO : MODERATOR a accès à `/admin`, mais en vue restreinte.**

Justification : forcer un `MODERATOR` à naviguer ailleurs pour sanctionner casse l'ergonomie ; il a déjà accès à `/admin/trash` aujourd'hui. On unifie le hub modération.

`app/[locale]/(protected)/admin/page.tsx` :

```ts
const ALLOWED = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];
if (!currentUser || !ALLOWED.includes(currentUser.role)) {
  redirect("/dashboard");
}
```

### 5.2 Vue par rôle sur la table users (`components/admin-user-table.tsx`)

> ⚠️ Le composant ACTIF est **`components/admin-user-table.tsx`** (importé par `page.tsx`). Le composant `app/[locale]/(protected)/admin/admin-users-table.tsx` n'est **pas branché** et doit être **supprimé** dans le même PR pour éviter la dérive (cf. §6). On porte les fonctionnalités utiles (search, badges colorés, bouton sanction, bouton historique) dans `components/admin-user-table.tsx`.

Colonnes : Avatar · Nom · Email · Rôle · Vérifié · Inscription · Sanctions (badge count) · Actions.

#### Bouton sanction (icône Gavel)

- Visible pour : **MODERATOR, ADMIN, SUPER_ADMIN**.
- Masqué : sur sa propre ligne ; sur une ligne dont le rôle est `ADMIN` ou `SUPER_ADMIN` **sauf si le caller est SUPER_ADMIN**.

#### Bouton historique des sanctions (icône History)

- Visible pour : MODERATOR, ADMIN, SUPER_ADMIN (sur toutes les lignes, y compris la sienne — lecture seule).

#### Bouton delete user (icône Trash2)

- Visible pour : **SUPER_ADMIN uniquement**.
- Masqué : sur sa propre ligne ; sur une ligne `SUPER_ADMIN`.

#### Dropdown rôle (colonne Rôle)

Règles d'affichage (afficher le `<Select>` versus un `<Badge>` en lecture seule) :

| Rôle caller | Sur sa propre ligne | Cible USER/CUSTOMER/MODERATOR | Cible ADMIN | Cible SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| MODERATOR | Badge | Badge | Badge | Badge |
| ADMIN | Badge | **Select** | Badge | Badge |
| SUPER_ADMIN | Badge | **Select** | **Select** | **Select** |

**Options proposées dans le `<Select>` selon le caller :**

- `SUPER_ADMIN` : `[USER, CUSTOMER, MODERATOR, ADMIN, SUPER_ADMIN]` (toutes).
- `ADMIN` : `[USER, CUSTOMER, MODERATOR]` (les options `ADMIN` et `SUPER_ADMIN` ne sont PAS rendues dans le dropdown).

#### Recherche & compteur

La barre de recherche (Input + icône Search) et le badge `{n} users` doivent être présents (port depuis `admin-users-table.tsx`).

### 5.3 Page `/admin/trash`

Aucun changement structurel. Le bouton **hard-delete** (et son `AlertDialog` de confirmation) devient visible pour `ADMIN` et `SUPER_ADMIN`. Le bouton **empty trash** reste **SUPER_ADMIN uniquement**.

Variables côté composant `trash-tables.tsx` :

```ts
const canHardDelete = role === "ADMIN" || role === "SUPER_ADMIN";
const canEmptyTrash = role === "SUPER_ADMIN";
```

### 5.4 Toasts & messages

Tous les messages d'erreur server reviennent dans `result.error`. Le composant client utilise une fonction `mapServerError(error: string): string` qui mappe les messages connus sur les clés i18n et fallback sur `admin.genericError`. Cf. §8 pour la liste.

---

## 6. Fichiers à modifier / créer / supprimer

### Back

| Fichier | Action | Détail |
|---|---|---|
| `lib/actions/admin.ts` | **Modifier** | `createSanction` → MODERATOR+ ; `changeUserRole` → ADMIN+ avec règles §3 ; passer `changeUserRole` au pattern `ActionResult` (try/catch) ; ajouter helper `requireModerator()` |
| `lib/actions/trash.ts` | **Modifier** | `hardDeletePost` et `hardDeleteComment` : `requireSuperAdminRole()` → `requireAdminRole()`. Reste inchangé. |
| `app/actions/admin.ts` | **Supprimer** | Doublon obsolète et incohérent. Les imports de `components/admin-user-table.tsx` doivent être migrés vers `@/lib/actions/admin`. Signature : ajuster `deleteUser(userId)` → `deleteUser({ userId })` et `changeUserRole(userId, newRole)` → `changeUserRole({ userId, newRole })`. |
| `lib/auth-roles.ts` | **(Optionnel)** créer | Si on veut factoriser `requireUser/Moderator/Admin/SuperAdmin` partagés entre `admin.ts` et `trash.ts`. Pas bloquant — un dev peut laisser pour un suivi. |

### Front

| Fichier | Action | Détail |
|---|---|---|
| `app/[locale]/(protected)/admin/page.tsx` | **Modifier** | Étendre l'allowlist à `MODERATOR`. Charger les sanctions via `getUsers()` (qui retourne déjà `_count.sanctions`) pour pouvoir afficher la colonne. Passer `currentUserRole` au composant. |
| `components/admin-user-table.tsx` | **Modifier (gros)** | Voir §5.2 : ajouter recherche, badge count sanctions, bouton sanction, bouton historique, bouton delete (SA only), corriger `canChangeRole` (ADMIN ne peut pas changer rôle d'un autre ADMIN), retirer logique d'auto-modification interdite déjà OK, intégrer dialogues `SanctionDialog` et `UserSanctionsDialog`. Migrer les imports vers `@/lib/actions/admin`. |
| `app/[locale]/(protected)/admin/admin-users-table.tsx` | **Supprimer** | Composant orphelin, on porte ce qui manque dans le composant actif. |
| `app/[locale]/(protected)/admin/sanction-dialog.tsx` | **Déplacer/Garder** | Continue d'importer `createSanction` depuis `@/lib/actions/admin`. Aucune logique à changer côté form. |
| `app/[locale]/(protected)/admin/user-sanctions-dialog.tsx` | **Garder** | Aucun changement. |
| `app/[locale]/(protected)/admin/trash/trash-tables.tsx` | **Modifier** | Étendre la visibilité du bouton hard-delete à `ADMIN`. Garder `emptyTrash` SA-only. |
| `app/[locale]/(protected)/admin/trash/empty-trash-dialog.tsx` | **Vérifier** | Doit rester gated à SUPER_ADMIN dans le parent. |

### Tests à mettre à jour / ajouter

| Fichier | Action |
|---|---|
| `__tests__/lib/actions/admin.test.ts` (créer si absent) | Couvrir : ADMIN promeut USER→MODERATOR ✅, ADMIN promeut USER→ADMIN ❌, ADMIN modifie un ADMIN ❌, ADMIN rétrograde MODERATOR→USER ✅, auto-modification ❌, SUPER_ADMIN tout autorisé, MODERATOR createSanction sur USER ✅, MODERATOR createSanction sur ADMIN ❌. |
| `__tests__/lib/actions/trash.test.ts` (créer si absent) | Couvrir : ADMIN hardDelete ✅, MODERATOR hardDelete ❌, ADMIN emptyTrash ❌, SUPER_ADMIN emptyTrash ✅. |

---

## 7. Clés i18n nouvelles ou modifiées

À ajouter dans **`locales/en.ts`** ET **`locales/fr.ts`** (même clés).

### Anglais (`locales/en.ts`)

```ts
'admin.role.errors.unauthorized': 'You must be signed in.',
'admin.role.errors.forbidden': 'You are not allowed to change roles.',
'admin.role.errors.selfChange': 'You cannot change your own role.',
'admin.role.errors.userNotFound': 'User not found.',
'admin.role.errors.targetIsAdmin': 'Admins cannot modify other admins or super admins.',
'admin.role.errors.cannotGrantAdmin': 'Admins cannot grant the ADMIN or SUPER_ADMIN role.',
'admin.role.errors.invalidInput': 'Invalid input.',
'admin.sanction.errors.targetIsAdmin': 'You cannot sanction an admin.',
'admin.trash.hardDelete.forbidden': 'Only ADMIN or SUPER_ADMIN can hard-delete items.',
'admin.trash.empty.forbidden': 'Only SUPER_ADMIN can empty the trash.',
'admin.access.moderatorView': 'Moderator view — limited actions available.',
```

### Français (`locales/fr.ts`)

```ts
'admin.role.errors.unauthorized': 'Vous devez être connecté.',
'admin.role.errors.forbidden': 'Vous n\'êtes pas autorisé à modifier les rôles.',
'admin.role.errors.selfChange': 'Vous ne pouvez pas modifier votre propre rôle.',
'admin.role.errors.userNotFound': 'Utilisateur introuvable.',
'admin.role.errors.targetIsAdmin': 'Les administrateurs ne peuvent pas modifier d\'autres administrateurs ou super-administrateurs.',
'admin.role.errors.cannotGrantAdmin': 'Les administrateurs ne peuvent pas attribuer les rôles ADMIN ou SUPER_ADMIN.',
'admin.role.errors.invalidInput': 'Entrée invalide.',
'admin.sanction.errors.targetIsAdmin': 'Vous ne pouvez pas sanctionner un administrateur.',
'admin.trash.hardDelete.forbidden': 'Seuls les ADMIN ou SUPER_ADMIN peuvent supprimer définitivement.',
'admin.trash.empty.forbidden': 'Seul un SUPER_ADMIN peut vider la corbeille.',
'admin.access.moderatorView': 'Vue modérateur — actions limitées.',
```

Les clés existantes (`admin.role.updated`, `admin.deleteSuccess`, `admin.genericError`, etc.) restent inchangées.

---

## 8. Critères d'acceptation (Gherkin léger)

> Chaque scénario doit être couvert par au moins un test unitaire ou un test e2e selon ce qui est pertinent.

### 8.1 `changeUserRole` — back

1. **Étant donné** un caller `SUPER_ADMIN`, **quand** il change le rôle d'un user `USER` vers `MODERATOR`, **alors** la DB est mise à jour et `success: true` est retourné.
2. **Étant donné** un caller `ADMIN`, **quand** il change le rôle d'un user `USER` vers `MODERATOR`, **alors** la DB est mise à jour et `success: true` est retourné.
3. **Étant donné** un caller `ADMIN`, **quand** il tente de changer le rôle d'un user `USER` vers `ADMIN`, **alors** la réponse est `{ success: false, error: "Admins cannot grant ADMIN or SUPER_ADMIN role" }` et la DB n'est pas modifiée.
4. **Étant donné** un caller `ADMIN`, **quand** il tente de modifier le rôle d'un autre `ADMIN`, **alors** la réponse est `{ success: false, error: "Admins cannot modify other admins or super admins" }`.
5. **Étant donné** un caller `ADMIN`, **quand** il rétrograde un `MODERATOR` vers `USER`, **alors** la DB est mise à jour et `success: true`.
6. **Étant donné** un caller `ADMIN`, **quand** il tente de modifier son propre rôle, **alors** la réponse est `{ success: false, error: "Cannot change your own role" }`.
7. **Étant donné** un caller `MODERATOR`, **quand** il tente n'importe quel `changeUserRole`, **alors** la réponse est `{ success: false, error: "Forbidden" }`.
8. **Étant donné** un caller `USER`, **quand** il tente `changeUserRole`, **alors** la réponse est `{ success: false, error: "Forbidden" }`.
9. **Étant donné** un `newRole` identique au rôle actuel, **alors** `success: true` est retourné sans appel `prisma.user.update` (vérifié par mock).

### 8.2 `createSanction` — back

10. **Étant donné** un caller `MODERATOR`, **quand** il sanctionne un `USER`, **alors** la sanction est créée.
11. **Étant donné** un caller `MODERATOR`, **quand** il tente de sanctionner un `ADMIN`, **alors** erreur `"Cannot sanction an admin"`.
12. **Étant donné** un caller `SUPER_ADMIN`, **quand** il sanctionne un `ADMIN`, **alors** la sanction est créée.

### 8.3 Trash — back

13. **Étant donné** un caller `ADMIN`, **quand** il appelle `hardDeletePost` sur un post en corbeille, **alors** le post est supprimé et `success: true`.
14. **Étant donné** un caller `MODERATOR`, **quand** il appelle `hardDeletePost`, **alors** `Forbidden`.
15. **Étant donné** un caller `ADMIN`, **quand** il appelle `emptyTrash`, **alors** `Forbidden: SUPER_ADMIN required`.

### 8.4 UI `/admin`

16. **Étant donné** un user `MODERATOR` connecté, **quand** il visite `/admin`, **alors** la page s'affiche (pas de redirect) et le dropdown de rôle n'apparaît sur aucune ligne (badges en lecture seule partout).
17. **Étant donné** un user `MODERATOR`, **alors** le bouton sanction est visible sur les lignes des non-admins, et invisible sur les lignes `ADMIN` / `SUPER_ADMIN` et sa propre ligne.
18. **Étant donné** un user `ADMIN`, **alors** sur les lignes `USER`, `CUSTOMER`, `MODERATOR` le dropdown rôle s'affiche avec les options `[USER, CUSTOMER, MODERATOR]` ; sur les lignes `ADMIN` et `SUPER_ADMIN` un badge en lecture seule s'affiche.
19. **Étant donné** un user `ADMIN`, **alors** le bouton delete user n'est jamais visible.
20. **Étant donné** un user `SUPER_ADMIN`, **alors** le dropdown rôle propose les 5 rôles sur toutes les lignes sauf la sienne.
21. **Étant donné** un user `MODERATOR` connecté à `/admin/trash`, **alors** le bouton hard-delete et le bouton empty trash sont invisibles ; seul le bouton restore-vers-corbeille (si pertinent) est masqué aussi car restore est ADMIN+.

### 8.5 UI `/admin/trash`

22. **Étant donné** un user `ADMIN` sur `/admin/trash`, **alors** les boutons restore et hard-delete sont visibles, et le bouton empty trash est invisible.
23. **Étant donné** un user `SUPER_ADMIN` sur `/admin/trash`, **alors** tous les boutons sont visibles.

---

## 9. Points de sécurité

1. **Les checks UI ne sont JAMAIS suffisants.** Tout le contrôle d'accès doit être appliqué dans les server actions. Un attaquant peut appeler une server action via la convention React (form action, fetch directement vers l'endpoint) — sans check serveur, on ouvre une élévation de privilèges immédiate.
2. **Risque principal : élévation de privilèges.** Un `ADMIN` malicieux pourrait tenter de s'auto-promouvoir en `SUPER_ADMIN` ou de promouvoir un complice en `ADMIN`. Mitigation : la logique §3 doit être appliquée **avant** tout `prisma.user.update` et doit lire le rôle du caller **depuis la DB** (pas depuis la session cache) — c'est déjà le pattern dans `lib/actions/admin.ts::requireAdmin`. **Conserver ce pattern, ne PAS faire confiance à la session cookie pour le rôle.**
3. **Validation Zod systématique** sur tous les inputs des server actions (déjà en place dans `lib/actions/admin.ts`, à conserver).
4. **Log de modération** : utiliser le helper existant `logModerationAction` (de `trash.ts`) pour tracer `changeUserRole` également. Champs : `callerId`, `callerRole`, `targetUserId`, `oldRole`, `newRole`. À ajouter dans la nouvelle implémentation de `changeUserRole`. **Ne pas logger** de PII non nécessaire (pas d'email).
5. **Race condition** : entre la lecture de `target.role` et `prisma.user.update`, un autre admin pourrait avoir changé le rôle. Acceptable pour ce ticket — la dernière écriture gagne. Si on veut renforcer : ajouter une condition `where: { id, role: target.role }` au `update`. **Décision PO : pas dans ce ticket.**
6. **Pas de log de secrets** (déjà respecté).
7. **Tests** : ajouter au moins un test qui appelle `changeUserRole` en tant que `USER` et vérifie que l'action throw `Forbidden` — pour éviter qu'un futur refactor casse silencieusement le check.

---

## 10. Hors-scope (NE PAS faire dans ce ticket)

- Refonte du système de rôles (ajout/suppression de rôles).
- Bulk role change (changer le rôle de plusieurs users d'un coup).
- Audit log persistant en DB des changements de rôle (on garde le `console.info` actuel ; un suivi sera un autre ticket).
- Différenciation `USER` vs `CUSTOMER` (les deux sont traités identiquement par cette spec).
- Notification email aux users dont le rôle a changé (le dispatch bot existant suffit).
- Permissions plus fines (par exemple : ADMIN qui peut sanctionner uniquement dans certaines catégories de contenu).
- Gestion de la première création de SUPER_ADMIN (cas de bootstrap initial — reste manuel via Prisma Studio ou seed).
- Migration de données / backfill de rôles existants.
- Modification de `app/api/auth/[...all]/route.ts` ou de la config Better Auth.
- Changement du modèle Prisma `User.role` (les enums actuels sont suffisants).

---

## 11. Checklist d'implémentation pour les devs

### Back

- [ ] Modifier `lib/actions/admin.ts::createSanction` → `requireModerator()`.
- [ ] Modifier `lib/actions/admin.ts::changeUserRole` → règles §3, pattern `ActionResult`, ajout log.
- [ ] Ajouter helper `requireModerator()` dans `lib/actions/admin.ts` (ou `lib/auth-roles.ts`).
- [ ] Modifier `lib/actions/trash.ts::hardDeletePost` → `requireAdminRole()`.
- [ ] Modifier `lib/actions/trash.ts::hardDeleteComment` → `requireAdminRole()`.
- [ ] Supprimer `app/actions/admin.ts`.
- [ ] Ajouter tests unitaires §8.1, §8.2, §8.3.

### Front

- [ ] Modifier `app/[locale]/(protected)/admin/page.tsx` : étendre l'allowlist à `MODERATOR`, passer `currentUserRole`.
- [ ] Refondre `components/admin-user-table.tsx` selon §5.2 (porter les features de l'orphan, corriger règles dropdown, ajouter sanction + historique, migrer imports vers `@/lib/actions/admin`).
- [ ] Supprimer `app/[locale]/(protected)/admin/admin-users-table.tsx`.
- [ ] Modifier `app/[locale]/(protected)/admin/trash/trash-tables.tsx` : étendre hard-delete à ADMIN, garder empty-trash SA.
- [ ] Mapper les nouveaux messages d'erreur back vers les clés i18n (helper `mapServerError`).

### i18n

- [ ] Ajouter les clés §7 dans `locales/en.ts`.
- [ ] Ajouter les clés §7 dans `locales/fr.ts`.

### Vérifs finales

- [ ] `pnpm lint` passe.
- [ ] `pnpm test:run` passe.
- [ ] `pnpm build` passe.
- [ ] Smoke test manuel des scénarios §8.4 et §8.5 avec un compte ADMIN et un compte MODERATOR.

---

**Fin du document.**
