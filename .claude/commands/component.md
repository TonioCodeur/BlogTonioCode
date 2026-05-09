---
description: Generates a Next.js component + tests
argument-hint: [ComponentName] [ComponentDescription] [feature] [folder]
---

Creates a functional Next.js component named `$1` in `$4` (default: `components/`). `$2` is the description of the component. `$3` is the feature you need to implement.
Uses TypeScript, shadcn UI, default export, typed props, and adds a minimal Vitest test in `__tests__/components/$1.test.tsx`.
Ensures basic accessibility (labels, ARIA).

