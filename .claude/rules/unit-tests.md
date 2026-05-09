---
paths: ./**/*.*
---

# Unitary Test Optimization Rule for Next.js App

## Purpose

Optimise, harmoniser et fiabiliser les tests unitaires dans ce projet Next.js (React 19, TypeScript, Prisma, shadcn/ui…).

---

## 1. **Emplacement & Structure**
- Tous les tests unitaires doivent résider dans des fichiers `*.test.ts(x)` eux-mêmes situés dans un répertoire `__tests__/`, dans le même dossier que le code testé, ou à la racine d'un module logique.
- Préférer des suites de tests courtes, indépendantes et focalisées sur une seule unité de logique (fonction, composant…).

## 2. **Technos & Exécution**
- Utiliser [Vitest](https://vitest.dev/) pour tous les tests unitaires (conforme à la convention `pnpm test`).
- Bannir l'usage de `jest`, `mocha` ou d'autres runners pour le code front ou back.
- Lancer `pnpm test:run` pour des runs ponctuels, et `pnpm test:coverage` pour l'audit de couverture.

## 3. **Style & Bonnes Pratiques**
- Écrire les tests en TypeScript strict (`strict: true` dans `tsconfig.json`).
- Nommer les cas de tests (`it`, `test`) en anglais, descriptif et explicite :  
  `it("returns null if user not found")`
- Mockez tous les accès externe : DB (Prisma), API tierces, context React (via Dependency Injection ou mocking).
- Pour les hooks React, utiliser `@testing-library/react-hooks` ou équivalent Vitest.
- Éviter les tests qui accèdent au DOM réel ou au serveur : tout doit passer par du mocking.

## 4. **Coverage & Maintenance**
- L'objectif de couverture minimale est 80% sur statements, branches et functions.
- Prioriser la couverture des logiques critiques : validation, auth, i18n, DB.
- Ajouter un test pour chaque bug corrigé : le commit fix => commit test.
- Garder les tests à jour lors de toute refacto ou changement de modèle Prisma.

## 5. **Ci/CD**
- Tous les tests unitaires doivent passer (`pnpm test:run`) avant tout merge vers `main`.
- Le pipeline CI doit échouer sur toute régression de couverture >2%.

---

## Exemples

```ts
// Pour une fonction isolée
import { add } from "../add";

it("adds two numbers", () => {
  expect(add(2, 3)).toBe(5);
});
```

```tsx
// Pour un composant React
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

it("renders with children", () => {
  render(<Button>Click!</Button>);
  expect(screen.getByText("Click!")).toBeInTheDocument();
});
```
```ts
// Pour une feature (ex : création d'utilisateur avec validation)
import { createUser } from "@/features/users/createUser";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma");

it("creates a user and returns the new user object", async () => {
  const mockUser = { id: "u1", email: "foo@bar.com", name: "Foo" };
  // Mock la DB: la méthode create doit renvoyer notre user simulé
  (prisma.user.create as vi.Mock).mockResolvedValue(mockUser);

  const result = await createUser({ email: mockUser.email, name: mockUser.name });

  expect(prisma.user.create).toHaveBeenCalledWith({
    data: { email: "foo@bar.com", name: "Foo" },
  });
  expect(result).toEqual(mockUser);
});
```

---

## Résumé
- Tests = Vitest + TypeScript only
- Mockez tout ce qui sort de l'unité testée (DB, context, API…)
- Un test = une logique/un cas d’usage
- Respect stricte des conventions de nommage et de structure pour faciliter la review et le debug.
