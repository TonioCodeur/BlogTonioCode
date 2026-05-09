# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm dev             # Start development server
pnpm build           # Generate Prisma client + build Next.js
pnpm lint            # Run ESLint

# Testing
pnpm test            # Run tests in watch mode
pnpm test:run        # Run tests once
pnpm test:ui         # Run tests with browser UI
pnpm test:coverage   # Run tests with coverage
pnpm vitest run __tests__/utils.test.ts  # Run single test file

# Database
pnpm db:generate     # Generate Prisma client
pnpm db:push         # Push schema to database (no migration)
pnpm db:migrate      # Create and apply migration
pnpm db:studio       # Open Prisma Studio GUI
```

Tests use Vitest + jsdom + `@testing-library/react`. Test files live in `__tests__/` and match `**/*.test.{ts,tsx}`.

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Prisma 7 + PostgreSQL (Neon) + Better Auth + next-international (i18n) + Zod

**Path alias:** `@/*` maps to project root

### App Structure

All user-facing routes live under `app/[locale]/`. The root `app/layout.tsx` is a minimal shell (html/body + fonts only); all providers live in `app/[locale]/layout.tsx`.

```
app/
├── layout.tsx                      # Minimal root: html/body + fonts, no providers
├── [locale]/
│   ├── layout.tsx                  # ThemeProvider + I18nProviderClient + Header + Toaster
│   ├── (public)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing page (server component)
│   │   └── (auth)/
│   │       ├── signin/page.tsx     # Client component
│   │       ├── signup/page.tsx     # Client component
│   │       └── verify-email/page.tsx
│   └── (protected)/
│       ├── layout.tsx              # Shared layout for all protected pages
│       ├── dashboard/page.tsx
│       ├── profile/page.tsx
│       ├── settings/page.tsx
│       └── admin/                  # ADMIN/SUPER_ADMIN only (server-side role check)
│           ├── page.tsx
│           ├── admin-users-table.tsx
│           ├── sanction-dialog.tsx
│           └── user-sanctions-dialog.tsx
└── api/auth/[...all]/route.ts      # Better Auth handler (not locale-prefixed)
```

### Proxy (Middleware)

Next.js 16 uses `proxy.ts` at the root (not `middleware.ts`). It combines two concerns:
1. **Auth guard** — redirects unauthenticated users away from protected routes (`/dashboard`, `/settings`, `/profile`, `/admin`) and authenticated users away from auth routes (`/signin`, `/signup`)
2. **i18n routing** — delegates to `createI18nMiddleware` with `urlMappingStrategy: "rewrite"`: locale is never visible in URLs (`/` serves English, `/fr` serves French with no redirect)

`stripLocale()` normalizes paths before auth checks (e.g. `/fr/dashboard` → `/dashboard`).

The auth check in `proxy.ts` only verifies cookie presence (fast, no DB hit). The admin page additionally does a full session + role check server-side and redirects to `/dashboard` if the user is not `ADMIN` or `SUPER_ADMIN`.

### Internationalisation (`locales/`)

- `locales/en.ts` and `locales/fr.ts` — flat key/value translation objects (`as const`); `en.ts` is the TypeScript source of truth
- `locales/server.ts` — exports `getI18n`, `getScopedI18n`, `getStaticParams`, `getCurrentLocale`
- `locales/client.ts` — exports `useI18n`, `useScopedI18n`, `I18nProviderClient`, `useChangeLocale`, `useCurrentLocale`

**Rule:** server components call `await getI18n()`. Client components call `useI18n()`. Never mix them.

Interpolation syntax: `t("footer.copyright", { year: new Date().getFullYear() })` for `"© {year} ShipStack."`.

To add a translation key: add to both `locales/en.ts` and `locales/fr.ts`.

### Key Modules

**Authentication (`lib/auth.ts`, `lib/auth-client.ts`):**
- Server: `auth.api.getSession({ headers: await headers() })`
- Client: `signIn`, `signUp`, `signOut`, `useSession` from `@/lib/auth-client`
- Email/password requires email verification (`requireEmailVerification: true`); verification email sent via Resend
- OAuth providers auto-enabled when env vars present: `GITHUB_`, `GOOGLE_`, `FACEBOOK_`, `APPLE_`, `MICROSOFT_` (`*_CLIENT_ID` + `*_CLIENT_SECRET`)
- Required env vars: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (optional, defaults to `noreply@shipstack.dev`)
- Session cookie is cached 2 min; `proxy.ts` reads it via `getSessionCookie` from `better-auth/cookies` (no DB hit in proxy)

**Database (`lib/prisma.ts`):**
- Prisma 7 requires `@prisma/adapter-pg` driver adapter — do not remove it
- Schema output: `../node_modules/.prisma/client` (non-standard path in `prisma/schema.prisma`)

**Validation (`lib/validations/auth.ts`):**
- Zod schemas + React Hook Form via `@hookform/resolvers/zod`
- Validation error messages are hardcoded in French

### Database Models

- `User` — `role` enum: `USER | CUSTOMER | MODERATOR | ADMIN | SUPER_ADMIN`
- `Sanction` — `type`: `WARNING | MUTE | TEMPORARY_BAN | PERMANENT_BAN`; `status`: `ACTIVE | EXPIRED | REVOKED`; supports `expiresAt`, revocation fields, and internal `notes`
- `Session`, `Account`, `Verification` — owned by Better Auth, do not modify manually

**Admin server actions** (`lib/actions/admin.ts`): all exported functions are `"use server"`, validate via Zod, call `requireAdmin()` or `requireSuperAdmin()` internally. Functions: `getUsers`, `getUserSanctions`, `createSanction`, `revokeSanction`, `deleteUser`, `changeUserRole`. SUPER_ADMIN is required for `deleteUser` and `changeUserRole`.

### UI

- shadcn/ui (New York style) + Radix UI. Add components: `npx shadcn@latest add <component>`
- `components/ui/` — shadcn primitives; `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- Dark mode via `next-themes` (`ThemeProvider` is in `app/[locale]/layout.tsx`)

## Conventions

- Type safety over speed; no `any` unless justified
- Functional components with typed props
- `params` in Next.js 16 App Router is `Promise<{ ... }>` — always `await params`
- Git messages: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`
