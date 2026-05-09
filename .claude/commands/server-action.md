---
description: Generates a Next.js Server Action + tests
argument-hint: [fileName] [feature] [sideOption]
---

Creates a Next.js Server Action named `$1` in `app/actions/$1.ts`.

`$2` is the feature/functionality to implement.

`$3` (optional) specifies external calls or additional requirements (e.g., database calls, external API integrations, email sending).

## Requirements

- Use `"use server"` directive at the top of the file
- TypeScript with strict typing (no `any`)
- Validate inputs with Zod schemas
- Return typed responses using a consistent pattern: `{ success: true, data: T } | { success: false, error: string }`
- Handle errors gracefully with try/catch
- Add authentication check if the action requires it (use `auth.api.getSession`)
- Add a minimal Vitest test in `__tests__/actions/$1.test.ts`

## Security

- Always validate and sanitize inputs server-side
- Check user permissions when applicable
- Never expose sensitive data in error messages
