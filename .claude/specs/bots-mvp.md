# Bots (fake users) — MVP Spec

## Objectif
Permettre aux `ADMIN` et `SUPER_ADMIN` de créer dans leur dashboard de faux users marqués comme **bots**, et de configurer des **messages automatiques** que ces bots envoient aux vrais users lors d'événements cibles (inscription, changement de rôle/sanction).

## Scope MVP (in)
- Création manuelle d'un bot : tous les champs User saisis à la main par l'admin (email, name, image URL optionnel, role par défaut `USER` mais modifiable, `bio`/description optionnelle via champ bot).
- Bots = users normaux avec flag `isBot = true`, email auto-vérifié, pas de mot de passe (pas de login possible).
- Édition d'un bot (mêmes champs).
- Activation/désactivation d'un bot (`isBotActive` on/off) sans suppression.
- Suppression d'un bot (cascade soft via le flag existant, OU hard delete via `deleteUser` existant).
- Messages automatiques : par bot, liste de `BotAutoMessage { trigger, content, isActive }`.
- Triggers supportés MVP : `USER_SIGNUP`, `ROLE_CHANGED`, `SANCTION_APPLIED`.
- Déclenchement : quand l'événement se produit sur un real user, pour chaque bot actif ayant une règle active sur ce trigger, `getOrCreateConversation(bot -> user)` + `sendMessage` côté serveur (bypass rate limit bot, bypass email verif bot).
- Interpolation simple dans le contenu : `{{name}}`, `{{role}}`, `{{sanctionType}}` (selon trigger). Autres vars = laissées telles quelles.

## Scope MVP (out)
- Pas de planification (cron, delays) — envoi immédiat et synchrone dans la même requête.
- Pas de templating riche (markdown OK en affichage, pas de variables conditionnelles).
- Pas de targeting avancé (tous les nouveaux users reçoivent les messages des bots USER_SIGNUP actifs).
- Pas de statistiques (nb envoyés, taux de lecture).
- Pas d'API publique — tout est server actions.

## Données (à la charge de dev-back, ajuster si meilleure idée)

### `User` (modifications)
- `isBot Boolean @default(false)` — flag bot
- `isBotActive Boolean @default(true)` — activable sans delete
- `botDescription String?` — description libre visible uniquement en admin

### `BotAutoMessage` (nouveau)
```
id            String   @id @default(cuid())
botUserId     String   (FK User, cascade delete)
trigger       BotTrigger (enum)
content       String   @db.Text
isActive      Boolean  @default(true)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
```

### `BotTrigger` enum
```
USER_SIGNUP
ROLE_CHANGED
SANCTION_APPLIED
```

## Server actions (à créer dans `lib/actions/bots.ts`)

Toutes `"use server"` + `requireAdmin()` + Zod + `ActionResult<T>` (cohérent avec messaging).

- `listBots()` — tous les users `isBot=true` avec count des auto-messages
- `getBot(id)` — détail bot + auto-messages
- `createBot(input)` — crée un User avec `isBot=true`, emailVerified=true, pas de password
- `updateBot(id, input)` — patch champs (name, email, image, role, bio, isBotActive)
- `deleteBot(id)` — hard delete (cascade messages + conversations)
- `createBotAutoMessage(botId, { trigger, content, isActive })`
- `updateBotAutoMessage(id, { content, isActive })`
- `deleteBotAutoMessage(id)`

**Hooks** dans `lib/bots/dispatch.ts` (helpers appelés depuis les points d'événement) :
- `dispatchBotsOnSignup(newUserId)` — à appeler dans le hook Better Auth ou la route signup
- `dispatchBotsOnRoleChanged(userId, newRole)` — à appeler dans `changeUserRole` de `lib/actions/admin.ts`
- `dispatchBotsOnSanction(userId, sanction)` — à appeler dans `createSanction`

Ces helpers sont fire-and-forget (ne doivent pas faire planter l'action principale) — try/catch autour, log en cas d'erreur.

## UI (à la charge de dev-front)

### Routes
- `app/[locale]/(protected)/admin/bots/page.tsx` — liste bots (table : nom, email, role, actif, nb messages auto, actions)
- `app/[locale]/(protected)/admin/bots/new/page.tsx` — formulaire de création
- `app/[locale]/(protected)/admin/bots/[botId]/page.tsx` — détail + édition bot + gestion auto-messages

### Composants
- `bot-form.tsx` (client) — form de création/édition d'un bot
- `bot-auto-messages-section.tsx` (client) — liste + CRUD des auto-messages d'un bot avec éditeur par trigger
- `bots-table.tsx` (client) — table liste avec actions

### Nav
- Ajouter un lien "Bots" dans la sidebar sous la section Admin (visible uniquement `ADMIN`/`SUPER_ADMIN`, check côté UI via session).

### i18n
- Namespace `admin.bots.*` dans `locales/en.ts` ET `locales/fr.ts`.

## Règles métier / sécurité

- **Seuls `ADMIN` / `SUPER_ADMIN`** peuvent accéder aux routes et appeler les actions.
- Les bots **ne peuvent pas se connecter** (pas de password, pas de session possible).
- Envoi auto : **bypass** du check `muted`/`banned`/`emailVerified` côté expéditeur (le bot a toujours `emailVerified=true` via creation). **Bypass rate limit** (les bots peuvent envoyer N messages lors d'un event sans restriction).
- Envoi auto : si **destinataire** est banni ou a ses sanctions qui bloquent la réception — on envoie quand même (le destinataire pourra le lire après), on ne bloque QUE sur envoi par user.
- Interpolation : simple `.replace(/{{(\w+)}}/g, ...)` côté serveur, inputs déjà validés.
- **XSS** : content rendu via React (auto-escape), pas de `dangerouslySetInnerHTML`.

## Definition of Done

- Schema Prisma + migration appliquée (ou SQL prête avec doc pour ops)
- Server actions testées (`__tests__/actions-bots.test.ts`) : permissions, création/édition/suppression, dispatch on signup/role/sanction, interpolation
- UI admin fonctionnelle avec validation client + server
- i18n complète EN+FR, aucune string en dur
- `pnpm lint` 0 errors, `pnpm build` OK, tests verts
- Dispatch branché sur les 3 triggers dans les actions existantes (`admin.ts` pour role/sanction, Better Auth signup hook pour signup)

## Contrat partagé front/back

Suivre le pattern messagerie : types partagés dans `lib/bots-types.ts` (créé par dev-back, importé par dev-front). Actions renvoient `ActionResult<T>` discriminé (`{ ok: true, ...data } | { ok: false, errorKey }`). Erreurs = clés i18n `admin.bots.errors.*` définies dans les 2 locales.
