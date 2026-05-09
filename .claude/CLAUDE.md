# ShipStack – Claude Code Rules

## Objective
You are working on a Next.js project (TypeScript). Priorities: readability, security, testing.

## Commands
- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- Build: `pnpm build`

## Expected Workflow
1) Understand the need + suggest a brief plan.
2) Modify the minimum number of files.
3) Run lint/tests when relevant.
4) Summarize what changed + impacts.
5) Respect rules of clean architecture.
6) Always use the mcp 7context to make sure you are consulting the latest documentation.

## TypeScript/React Conventions
- Type safety > speed.
- No `any` (unless explicitly justified).
- Components: functional, typed props, no “magic” logic.
- Prefer small, pure functions.
- Respect the rules of clean code.

## Security
- Never log secrets.
- Validate inputs on the server side.
- Watch for injections in API routes.

## Git
- Small, coherent commits.
- Messages: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`.
