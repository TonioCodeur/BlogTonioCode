---
paths: ./**/*.*
---

# Coding Instructions

## Objective
You are working on a Next.js (TypeScript) application. Priorities: readability, security, testing.

## Commands
- Development: `pnpm dev`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- Build: `pnpm build`

## Expected Workflow
1) Understand the requirements + suggest a work plan.
2) Modify the minimum number of files.
3) Run lint/tests when relevant.
4) Summarize what has changed + impacts.
5) Respect the rules of clean code and architecture.

## TypeScript/React Conventions
- Security > speed.
- No use of `any` (unless justified).
- Components: functional, typed props, no “magic” logic.
- Prefer small pure functions.

## Security
- Do not store secrets.
- Validate input on the server side.
- Watch for injections in API routes.

## Git
- Small, consistent commits.
- Messages: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`.

## Standard Error Format (Next.js)
- Input validation required
- Standard error format