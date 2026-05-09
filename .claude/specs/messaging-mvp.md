# Messaging MVP — Spec

**Statut :** Draft v1 — brief pour dev-back (schema + server actions) et dev-front (UI shadcn + i18n).
**Owner :** Product Owner
**Cible :** MVP shippable en 1 à 2 sprints.

---

## 1. Objectif

Permettre aux utilisateurs authentifiés d'échanger des messages privés **1-to-1** dans l'application. Base solide et extensible, sans sur-ingénierie.

---

## 2. Scope MVP

### In scope
- Messagerie **1-to-1** (DM) entre deux utilisateurs authentifiés (email vérifié).
- Liste des conversations (inbox) avec dernier message et compteur de non-lus.
- Vue d'une conversation avec historique paginé (scroll vers le haut).
- Envoi d'un message texte (plain text, max 2 000 caractères).
- Marquage automatique "lu" à l'ouverture de la conversation.
- Démarrer une nouvelle conversation à partir du profil d'un autre utilisateur.
- Soft-delete d'un message par son auteur (affiché comme "Message supprimé").
- Polling côté client (toutes les 10–15 s sur la vue active) pour rafraîchir les nouveaux messages et le compteur inbox.
- i18n complet (en + fr).
- Respect des sanctions `MUTE` et des bans : un utilisateur muté ne peut **pas envoyer** de messages mais peut lire.
- Modération admin : lecture de n'importe quelle conversation, suppression de message.

### Out of scope (post-MVP)
- Group chat / channels.
- Typing indicators / presence.
- WebSocket / Server-Sent Events temps réel (polling suffit pour le MVP).
- Pièces jointes, images, emojis picker, réactions.
- Édition d'un message envoyé.
- Recherche full-text dans les conversations.
- Notifications push / email sur nouveau message.
- Blocage utilisateur à utilisateur (UX de blocklist côté user).
- Brouillons persistés serveur.
- E2E encryption.

---

## 3. User stories

### US-1 — Voir mon inbox
**En tant que** utilisateur connecté,
**je veux** voir la liste de mes conversations triées par date du dernier message,
**afin de** reprendre mes échanges rapidement.
**Critères d'acceptation :**
- Route `/messages` affiche la liste, avatar + nom de l'interlocuteur, extrait du dernier message (80 char max), timestamp relatif, badge non-lus.
- Liste vide : état "aucune conversation" + CTA vers le profil/recherche.
- Inbox paginée (20 conversations par page).

### US-2 — Lire une conversation
**En tant que** utilisateur connecté,
**je veux** ouvrir une conversation et voir tout l'historique,
**afin de** suivre le fil de discussion.
**Critères d'acceptation :**
- Route `/messages/[conversationId]`.
- Messages chronologiques, plus récent en bas, auto-scroll bottom à l'ouverture.
- Pagination "load more" vers le haut par batches de 30.
- Tous les messages non-lus de cette conversation passent en `read` dès l'ouverture.
- 404 si la conversation n'existe pas ou si l'utilisateur n'en est pas participant.

### US-3 — Envoyer un message
**En tant que** utilisateur connecté (non muté, non banni, email vérifié),
**je veux** envoyer un message texte dans une conversation,
**afin de** communiquer avec l'autre participant.
**Critères d'acceptation :**
- Textarea + bouton envoyer ; `Cmd/Ctrl+Enter` envoie.
- Validation Zod serveur : 1–2 000 caractères, pas uniquement whitespace.
- Message apparaît optimistiquement dans le fil ; rollback si l'action serveur échoue.
- Rate limiting : max 10 messages / minute / user (protection spam). À implémenter via compteur en base ou middleware simple.

### US-4 — Démarrer une nouvelle conversation
**En tant que** utilisateur connecté,
**je veux** démarrer une conversation avec un autre utilisateur depuis son profil,
**afin d'** initier un échange.
**Critères d'acceptation :**
- Bouton "Envoyer un message" sur la page profil d'un utilisateur (hors self).
- Si une conversation 1-to-1 existe déjà entre les deux, redirect vers celle-ci.
- Sinon, création à la volée et redirect vers la conversation vide.

### US-5 — Supprimer un de mes messages
**En tant qu'** auteur d'un message,
**je veux** pouvoir supprimer un message que j'ai envoyé,
**afin de** retirer du contenu publié par erreur.
**Critères d'acceptation :**
- Menu contextuel sur mes messages → "Supprimer".
- Soft-delete : `deletedAt` rempli, `content` remplacé par un placeholder côté rendu.
- Le destinataire voit "Message supprimé" à la place.
- Pas de limite de temps pour supprimer au MVP.

### US-6 — Compteur global de non-lus
**En tant qu'** utilisateur connecté,
**je veux** voir un pastille de non-lus dans le Header,
**afin de** savoir qu'on m'a écrit sans ouvrir l'inbox.
**Critères d'acceptation :**
- Icône messagerie dans le Header avec badge (nombre total de messages non-lus, toutes conversations confondues, capé à "9+").
- Rafraîchi au polling (15 s) et après chaque envoi / ouverture de conversation.

### US-7 — Utilisateur muté ne peut pas écrire
**En tant qu'** admin,
**je veux** qu'une sanction `MUTE` active empêche l'envoi de messages,
**afin de** modérer le service.
**Critères d'acceptation :**
- Check serveur sur `sendMessage` : si l'utilisateur a une `Sanction` active de type `MUTE` ou `TEMPORARY_BAN` ou `PERMANENT_BAN`, l'action retourne une erreur localisée.
- Le champ de saisie est disabled côté client avec un message explicite ("Vous êtes actuellement muté jusqu'à …").
- L'utilisateur muté peut toujours **lire** ses conversations.

### US-8 — Admin peut auditer une conversation
**En tant qu'** ADMIN ou SUPER_ADMIN,
**je veux** pouvoir consulter n'importe quelle conversation et supprimer un message abusif,
**afin de** gérer la modération.
**Critères d'acceptation :**
- Route admin `/admin/messages` : liste de toutes les conversations (paginée, triée par dernier message).
- Drill-down vers la conversation en lecture seule pour l'admin (pas d'input d'envoi).
- Bouton "Supprimer (modération)" sur chaque message → soft-delete avec `deletedByAdminId` renseigné.
- Action tracée (qui, quand, raison optionnelle).

---

## 4. Modèle de données (suggéré)

Le dev-back finalisera la forme exacte (index, contraintes, cascade). Proposition :

### `Conversation`
- `id` (cuid)
- `createdAt`, `updatedAt`
- `lastMessageAt` (DateTime, index) — pour tri inbox efficace
- Pas de `type` au MVP (toutes les conversations sont 1-to-1).

### `ConversationParticipant` (join table user ↔ conversation)
- `id`
- `conversationId` → `Conversation.id` (cascade delete)
- `userId` → `User.id` (cascade delete)
- `joinedAt`
- `lastReadAt` (DateTime?) — sert à calculer le non-lu (messages > lastReadAt)
- `mutedByUser` (Boolean, default false) — prévu pour extension post-MVP ("silencieux"), pas exposé UI au MVP mais OK à poser en base
- `@@unique([conversationId, userId])`
- Contrainte applicative : exactement 2 participants par conversation au MVP.

### `Message`
- `id` (cuid)
- `conversationId` → `Conversation.id` (cascade delete)
- `authorId` → `User.id` (onDelete: SetNull, pour conserver l'historique si user supprimé)
- `content` (String, max 2 000, validé serveur)
- `createdAt` (index composite avec conversationId)
- `updatedAt`
- `deletedAt` (DateTime?) — soft-delete user
- `deletedByAdminId` (String?, → User.id) — soft-delete admin avec traçabilité
- `deletionReason` (String?) — optionnel

### Indices recommandés
- `Message (conversationId, createdAt DESC)` — pagination historique
- `Conversation (lastMessageAt DESC)` — tri inbox
- `ConversationParticipant (userId, lastReadAt)` — compteur non-lus

### Calcul du "non-lu"
Nombre de messages d'une conversation dont `createdAt > participant.lastReadAt` et `authorId != userId` et `deletedAt IS NULL`.

---

## 5. Routes / écrans front

Toutes dans `app/[locale]/(protected)/` (auth guard déjà géré par `proxy.ts`).

| Route | Type | Description |
|---|---|---|
| `app/[locale]/(protected)/messages/page.tsx` | Server Component | Inbox : liste des conversations de l'utilisateur. |
| `app/[locale]/(protected)/messages/[conversationId]/page.tsx` | Server Component + Client child | Thread d'une conversation + formulaire d'envoi (client). |
| `app/[locale]/(protected)/messages/new/page.tsx` *(optionnel)* | Client Component | Sélecteur d'utilisateur pour démarrer une conversation (si pas d'entrée depuis profil). |
| `app/[locale]/(protected)/admin/messages/page.tsx` | Server Component | Audit modérateur, liste paginée. |
| `app/[locale]/(protected)/admin/messages/[conversationId]/page.tsx` | Server Component | Vue conversation en lecture seule avec actions de modération. |

### Composants clés (`components/messaging/`)
- `ConversationListItem.tsx` — item d'inbox.
- `MessageThread.tsx` — liste des messages (client, polling).
- `MessageComposer.tsx` — textarea + send (client, server action).
- `MessageBubble.tsx` — rendu d'un message (support soft-delete).
- `UnreadBadge.tsx` — badge Header.

### Server Actions (`lib/actions/messaging.ts`, `"use server"`)
- `getInbox(page?: number)` — conversations du user courant.
- `getConversation(conversationId)` — thread + messages paginés.
- `sendMessage(conversationId, content)` — valide Zod, check MUTE/ban, insert, update `lastMessageAt`.
- `createOrGetConversation(targetUserId)` — idempotent, renvoie la conversation.
- `markConversationRead(conversationId)` — update `lastReadAt`.
- `deleteMyMessage(messageId)` — soft-delete par auteur.
- `adminDeleteMessage(messageId, reason?)` — requireAdmin, trace.
- `getUnreadCount()` — pour le badge Header.

Toutes les actions valident via Zod, appellent `auth.api.getSession()`, check sanctions quand pertinent.

---

## 6. Règles métier

1. **Prérequis d'envoi** : user authentifié, `emailVerified === true`, pas de sanction `MUTE` / `TEMPORARY_BAN` / `PERMANENT_BAN` active (status `ACTIVE` et `expiresAt` null ou futur).
2. **Prérequis de lecture** : user authentifié, participant de la conversation. Les bannis peuvent lire mais pas écrire (cohérent avec la politique de sanctions existante).
3. **Rate limit envoi** : 10 messages / minute / user. Dépassement → erreur 429 localisée.
4. **Self-messaging** : interdit. `createOrGetConversation` refuse si `targetUserId === currentUserId`.
5. **Soft-delete utilisateur** : seul l'auteur peut supprimer son message. Le message reste en base, le rendu affiche un placeholder i18n.
6. **Soft-delete admin** : ADMIN ou SUPER_ADMIN uniquement. Trace `deletedByAdminId` + `deletionReason`. Prend priorité sur un soft-delete auteur.
7. **Suppression d'un compte user** : ses messages restent visibles (`authorId` set null → affiché "Utilisateur supprimé"). Ses conversations restent pour l'autre participant.
8. **Pas de notifications email** au MVP.
9. **Pas de blocage user-to-user** au MVP. Les admins sont le seul levier de modération.
10. **Ordre inbox** : par `lastMessageAt DESC`. Nouvelle conversation vide → en haut (basé sur `createdAt` comme fallback).

---

## 7. i18n

Toutes les chaînes UI doivent passer par i18n. **Ajouter les clés dans `locales/en.ts` ET `locales/fr.ts`** (voir CLAUDE.md). `en.ts` est la source de vérité TypeScript.

Namespace proposé : `messages.*`

Clés a minima :
- `messages.inbox.title`, `messages.inbox.empty.title`, `messages.inbox.empty.cta`
- `messages.thread.loadMore`, `messages.thread.deleted`, `messages.thread.deletedByAdmin`
- `messages.composer.placeholder`, `messages.composer.send`, `messages.composer.mutedUntil` (interpole `{date}`)
- `messages.composer.errors.tooLong`, `messages.composer.errors.empty`, `messages.composer.errors.rateLimited`
- `messages.badge.nine_plus` → "9+"
- `messages.actions.delete`, `messages.actions.deleteConfirm`
- `messages.admin.title`, `messages.admin.readOnly`, `messages.admin.deleteReason`

Server components utilisent `await getI18n()`, client components `useI18n()`. Pas de mix.

---

## 8. Definition of Done

- [ ] Schema Prisma mergé (`Conversation`, `ConversationParticipant`, `Message`) avec index, migration générée via `pnpm db:migrate`.
- [ ] Server actions dans `lib/actions/messaging.ts` avec validation Zod + check auth + check sanctions. Toutes exportées `"use server"`.
- [ ] Pages `/messages` et `/messages/[conversationId]` fonctionnelles, protégées par `proxy.ts` (vérifier que ces routes sont dans la liste des protected prefixes).
- [ ] Composer avec polling 10–15 s, marquage "lu" automatique à l'ouverture.
- [ ] Bouton "Envoyer un message" sur page profil d'un autre user.
- [ ] Badge non-lus dans le Header.
- [ ] Soft-delete message (user) fonctionnel, rendu placeholder i18n.
- [ ] Pages admin `/admin/messages` + action `adminDeleteMessage` (requireAdmin).
- [ ] Rate limit envoi (10/min) en place côté server action.
- [ ] Clés i18n complètes en `en.ts` et `fr.ts`, tests visuels sur les deux locales.
- [ ] Tests Vitest : server actions (happy path + permissions + MUTE + rate limit + self-messaging refusé). Cible ≥ 70 % sur `lib/actions/messaging.ts`.
- [ ] `pnpm lint` et `pnpm test:run` passent.
- [ ] `pnpm build` passe (Prisma client régénéré).
- [ ] Pas de `any` non justifié. Props React typées. Aucune chaîne hardcodée dans l'UI.
- [ ] README interne / CLAUDE.md mis à jour si nouveau répertoire de composants ou nouvelle convention.

---

## 9. Notes techniques

- **Pas de websocket au MVP.** Polling côté client via un hook `useInterval` ou `SWR`/`useEffect`. Simple, robuste, suffit pour le volume attendu.
- **Pas de Server Actions pour le polling.** Utiliser une route API ou un simple `fetch` sur une route de lecture — les server actions sont pour les mutations. (à trancher par dev-back : lire via SA est OK, mais attention au coût de la roundtrip.)
- **Cache** : pas de cache Next au MVP sur les conversations (contenu dynamique per-user). `revalidatePath` ou `revalidateTag` après chaque mutation.
- **Transactions** : `sendMessage` doit être une transaction (insert message + update `lastMessageAt` sur la conversation).
