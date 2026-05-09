# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

```bash
pnpm dev             # Start development server
pnpm build           # Generate Prisma client + build Next.js
pnpm lint            # Run ESLint

# Testing (Vitest + jsdom)
pnpm test            # Run tests in watch mode
pnpm test:run        # Run tests once
pnpm test:coverage   # Run tests with coverage
pnpm vitest run __tests__/utils.test.ts  # Run a single test file

# Database (Prisma + PostgreSQL/Neon)
pnpm db:generate     # Generate Prisma client
pnpm db:push         # Push schema to database (no migration file)
pnpm db:migrate      # Create and apply a migration
pnpm db:studio       # Open Prisma Studio GUI
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Prisma 7 + PostgreSQL (Neon) + Better Auth + next-international (i18n) + Zod

**Path alias:** `@/*` maps to the project root.

### Routing & Middleware

All user-facing routes live under `app/[locale]/`. The root `app/layout.tsx` is a minimal shell (html/body + fonts only); all providers live in `app/[locale]/layout.tsx` (ThemeProvider, I18nProviderClient, Header, Toaster).

Route groups:
- `app/[locale]/(public)/` — landing page and auth pages (`/signin`, `/signup`, `/verify-email`)
- `app/[locale]/(protected)/` — dashboard, profile, settings, admin (requires authentication)
- `app/api/auth/[...all]/route.ts` — Better Auth handler (not locale-prefixed)

Next.js 16 uses **`proxy.ts`** at the root instead of `middleware.ts`. It handles two concerns in sequence:
1. Auth guard — redirects unauthenticated users away from protected routes and authenticated users away from auth routes.
2. i18n routing — delegates to `createI18nMiddleware` with `urlMappingStrategy: "rewrite"`: locale is never visible in URLs (`/` serves English, `/fr` serves French with no redirect).

`stripLocale()` in `proxy.ts` normalises paths before auth checks (e.g. `/fr/dashboard` → `/dashboard`).

### Authentication (`lib/auth.ts`, `lib/auth-client.ts`)

- Server-side: `auth.api.getSession({ headers: await headers() })`
- Client-side: `signIn`, `signUp`, `signOut`, `useSession`, `getSession` from `@/lib/auth-client`
- Email verification is required on sign-up; emails are sent via Resend (`RESEND_API_KEY`).
- OAuth providers (GitHub, Google, Facebook, Apple, Microsoft) are opt-in — only enabled when the corresponding `*_CLIENT_ID`/`*_CLIENT_SECRET` env vars are present.
- Session cookie is cached 2 min; `proxy.ts` reads it via `getSessionCookie` (no full DB hit on every request).

Required env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`. See `.env.example` for the full list.

### Database (`lib/prisma.ts`)

Prisma 7 uses the `@prisma/adapter-pg` driver adapter with a `pg` connection pool — **do not remove the adapter**. The generated client outputs to `node_modules/.prisma/client` (non-standard path set in `prisma/schema.prisma`).

Models:
- `User` — `role` enum: `USER | CUSTOMER | MODERATOR | ADMIN | SUPER_ADMIN`
- `Sanction` — `type`: `WARNING | MUTE | TEMPORARY_BAN | PERMANENT_BAN`; `status`: `ACTIVE | EXPIRED | REVOKED`
- `Session`, `Account`, `Verification` — owned by Better Auth; do not modify manually.

### Server Actions (`lib/actions/`)

- `lib/actions/admin.ts` — all admin operations (user management, sanctions) are Server Actions protected by `requireAdmin()` / `requireSuperAdmin()` helpers that re-validate the session server-side on every call. Role hierarchy rules: ADMIN can sanction non-admins; only SUPER_ADMIN can sanction admins, change roles, or delete users.
- `lib/actions/auth.ts` — auth-related server actions.

### Internationalisation (`locales/`)

- `locales/en.ts` and `locales/fr.ts` — flat key/value objects (`as const`); `en.ts` is the TypeScript source of truth.
- Server components call `await getI18n()` (from `locales/server.ts`). Client components call `useI18n()` (from `locales/client.ts`). Never mix them.
- Interpolation: `t("footer.copyright", { year: new Date().getFullYear() })` for `"© {year} ShipStack."`.
- To add a key: add it to **both** `locales/en.ts` and `locales/fr.ts`.

### UI

- shadcn/ui (New York style) + Radix UI. Add components with: `npx shadcn@latest add <component>`
- `components/ui/` — shadcn primitives.
- `lib/utils.ts` — exports `cn()` (clsx + tailwind-merge).
- Dark mode via `next-themes` (`ThemeProvider` in `app/[locale]/layout.tsx`).

## Conventions

- Type safety over speed; no `any` unless justified.
- Functional components with typed props.
- `params` in Next.js 16 App Router is `Promise<{ ... }>` — always `await params`.
- Zod validation error messages are currently hardcoded in French (`lib/validations/`).
- Git commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`.
