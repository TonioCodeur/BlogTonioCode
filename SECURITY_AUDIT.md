# Security Audit Report — ShipStack

**Date:** 2026-03-24
**Scope:** Complete source code, configuration, authentication, database, dependencies audit
**Stack:** Next.js 16 + React 19 + TypeScript + Prisma 7 + PostgreSQL (Neon) + Better Auth + shadcn/ui

---

## Executive Summary

| Severity | Count | Details |
|----------|-------|---------|
| CRITICAL | 1 | Secrets exposed in `.env` that could be committed |
| HIGH | 3 | Missing security headers, incomplete OAuth config, no rate limiting |
| MEDIUM | 5 | Session cache, error exposure, undocumented CSRF, session metadata, callback URLs |
| LOW | 2 | Password complexity, schema documentation |
| COMPLIANT | 8 | No XSS, no SQL injection, strict typing, correct auth flow, etc. |

---

## 1. CRITICAL Vulnerabilities

### 1.1 Secrets Exposed in `.env` (CWE-798, OWASP A07:2021)

**File:** `.env` (project root, present in `.gitignore`)

The `.env` file contains production credentials **not committed to Git repository**:

| Secret | Exposed Value |
|--------|---------------|
| `DATABASE_URL` | Neon URL with password `npg_S1Qz7c...` |
| `PGPASSWORD` | `npg_S1Qz7c...` |
| `BETTER_AUTH_SECRET` | `uyJTuooDwavZLPTsq8c9xjGeOhVVrtuL` |
| `GITHUB_CLIENT_ID` | `Ov23liWnd3JgB0Ni3wKN` |
| `GITHUB_CLIENT_SECRET` | `73601942a197689d87d77...` |
| `STACK_SECRET_SERVER_KEY` | `ssk_...` |

**Impact:** Full database access, OAuth spoofing, session compromise.

**Immediate Remediation:**
1. **Revoke** all exposed secrets (Neon, GitHub OAuth, Better Auth)
2. Remove `.env` from Git history using `git filter-repo` or BFG Repo-Cleaner
3. Use `.env.local` for local development (already in `.gitignore`)
4. Migrate all secrets to Vercel environment variables (`vercel env add`)

---

## 2. HIGH Vulnerabilities

### 2.1 Missing Security Headers (OWASP A05:2021)

**File:** `next.config.ts`

Next.js configuration is empty—no security headers defined:

```typescript
const nextConfig: NextConfig = {
  /* config options here */
};
```

**Missing Headers:**
- `Content-Security-Policy` — XSS and injection protection
- `X-Frame-Options: DENY` — clickjacking protection
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS (HSTS)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables unnecessary APIs (camera, microphone, etc.)

**Remediation:**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
        },
      ],
    },
  ],
};
```

---

### 2.2 Incomplete OAuth Configuration (CWE-252)

**File:** `lib/auth.ts` (lines 19-40)

Four OAuth providers declared with non-null assertions (`!`) but missing environment variables:

```typescript
google: {
  clientId: process.env.GOOGLE_CLIENT_ID!,      // missing
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // missing
},
facebook: { ... }, // missing
apple: { ... },    // missing
microsoft: { ... } // missing
```

**Impact:** Runtime errors if user attempts sign-in via these providers. Potential information disclosure via error messages.

**Remediation:** Load only configured providers:

```typescript
const providers = [];
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(github({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }));
}
// ... same for each provider
```

---

### 2.3 Missing Rate Limiting (OWASP A07:2021, CWE-307)

**File:** `app/api/auth/[...all]/route.ts`

No rate limiting on authentication endpoints. An attacker can:
- Brute force `/api/auth/sign-in/email`
- Enumerate accounts via differential error responses
- DDoS the auth server

**Remediation:**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts / 15 min
  analytics: true,
});
```

---

## 3. MEDIUM Vulnerabilities

### 3.1 Excessive Session Cache Duration (CWE-613)

**File:** `lib/auth.ts` (lines 52-57)

```typescript
session: {
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minutes
  },
}
```

After account revocation or password change, session remains valid for 5 minutes. For sensitive operations (payment, role change), this is problematic.

**Remediation:** Reduce to 60–120 seconds, or implement real-time verification for critical actions.

---

### 3.2 Raw Error Message Exposure (CWE-209)

**Files:** `app/[locale]/(public)/(auth)/signin/page.tsx`, `signup/page.tsx`

```typescript
if (error) {
  toast.error(t("signIn.error.title"), {
    description: error.message || t("signIn.genericError"),
  });
}
```

Better Auth error messages displayed as-is to users, potentially revealing:
- Internal system structure
- If email already exists (account enumeration)
- Technical failure details

**Remediation:** Always display generic message on client; log details server-side.

---

### 3.3 Session Metadata Exposed on Client (CWE-200)

**File:** `app/[locale]/(protected)/dashboard/page.tsx`

```typescript
type DashboardSession = {
  user?: DashboardUser;
  session?: {
    createdAt?: string | Date;
    ipAddress?: string;  // IP address in browser
  };
};
```

IP address and session metadata loaded client-side. XSS attacker could exploit this.

**Remediation:** Do not expose `ipAddress` or session timestamps in client components.

---

### 3.4 Implicit CORS Policy (CWE-942)

No explicit CORS configuration. Next.js applies default policy (same-origin), but this should be documented and verified, especially if external clients access APIs.

---

### 3.5 Missing Callback URL Validation (CWE-601)

**Files:** `signin/page.tsx`, `signup/page.tsx`

Callback URLs currently hardcoded (`"/dashboard"`), but if made dynamic (query parameter), this opens an Open Redirect vector.

**Remediation:** Always validate callback URLs against a whitelist.

---

## 4. LOW Vulnerabilities

### 4.1 Insufficient Password Policy (CWE-521)

**File:** `lib/auth.ts`

```typescript
minPasswordLength: 8,
maxPasswordLength: 128,
```

No complexity requirement (uppercase, digits, special characters). An 8-character lowercase password is accepted.

**Remediation:** Add Zod validation on client:

```typescript
password: z.string()
  .min(8)
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[0-9]/, "At least one digit")
  .regex(/[^A-Za-z0-9]/, "At least one special character")
```

---

### 4.2 Schema Password Field Documentation

**File:** `prisma/schema.prisma`

The `password` field in `Account` model should be documented as storing a hash, never plaintext.

---

## 5. COMPLIANT Points (No Vulnerabilities Detected)

| Control | Status | Details |
|---------|--------|---------|
| XSS Protection | COMPLIANT | No `dangerouslySetInnerHTML`, React safe rendering |
| SQL Injection | COMPLIANT | Prisma ORM with parameterized queries, no raw SQL |
| Strict Typing | COMPLIANT | `strict: true` in `tsconfig.json` |
| HTTPOnly Cookies | COMPLIANT | Better Auth manages session cookies as HTTPOnly |
| Auth Proxy Protection | COMPLIANT | `proxy.ts` correctly protects `/dashboard`, `/settings`, `/profile` routes |
| Input Validation | COMPLIANT | Zod + React Hook Form on all forms |
| Dependencies Updated | COMPLIANT | Next.js 16.1.1, React 19.2.3, Prisma 7.2.0, Zod 4.3.4 |
| Email Uniqueness | COMPLIANT | `@@unique([email])` constraint in Prisma schema |

---

## 6. Additional Recommendations

### 6.1 Audit Trail / Security Logging

No security event logging system in place:
- Failed logins
- Password changes
- Privilege escalation
- Unauthorized access attempts

**Recommendation:** Implement logging system (Vercel Logs, Sentry, or audit table).

---

### 6.2 Request Size Limits

No explicit limit on request body size. An attacker could send massive payloads.

**Recommendation:** Configure `bodyParser.sizeLimit` on sensitive API routes.

---

### 6.3 Account Enumeration Protection

Auth endpoints may return different messages based on email existence, enabling enumeration.

**Recommendation:** Always return same generic message ("Invalid email or password") regardless of error case.

---

### 6.4 Subresource Integrity (SRI)

If external scripts or styles are loaded, add `integrity` attributes to prevent supply chain attacks.

---

## 7. Priority Action Plan

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Revoke and rotate all exposed secrets | 1h |
| P0 | Remove `.env` from Git history | 30min |
| P1 | Add security headers to `next.config.ts` | 30min |
| P1 | Implement rate limiting on `/api/auth` | 2h |
| P1 | Fix OAuth config (load conditionally) | 1h |
| P2 | Reduce session cache to 60–120s | 15min |
| P2 | Sanitize auth error messages | 1h |
| P2 | Remove client-side `ipAddress` exposure | 15min |
| P3 | Enforce password complexity policy | 30min |
| P3 | Add audit trail for security events | 4h |

---

## 8. Analyzed Files

| File | Analysis |
|------|----------|
| `.env` | Exposed secrets |
| `proxy.ts` | Auth guards |
| `lib/auth.ts` | Better Auth server config |
| `lib/auth-client.ts` | Client auth config |
| `lib/prisma.ts` | Database client |
| `lib/validations/auth.ts` | Zod validation schemas |
| `app/api/auth/[...all]/route.ts` | Auth API handler |
| `app/[locale]/(public)/(auth)/signin/page.tsx` | Sign-in form |
| `app/[locale]/(public)/(auth)/signup/page.tsx` | Sign-up form |
| `app/[locale]/(protected)/dashboard/page.tsx` | Protected page |
| `components/header.tsx` | Session access |
| `prisma/schema.prisma` | Database schema |
| `next.config.ts` | Next.js config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Dependencies |
| `.gitignore` | Git exclusion rules |
| `eslint.config.mjs` | ESLint config |

---

*Report generated automatically by Claude Code — audit for educational and defensive purposes.*
