---
description: Generates unit tests for one or more source files
argument-hint: [testFileName] [sourceFile1] [sourceFile2...]
---

## Objective

Create a unit test file with Vitest named `$1.test.ts` (or `.test.tsx` if it's a React component) in `tests/unit/`.

## Source files to test

Analyze and test the following files: $ARGUMENTS (ignore the first argument, which is the test file name).

Source files start from `$2`.

## Instructions

1. **Read and analyze** each provided source file (`$2`, `$3`, etc.)
2. **Identify** all exported functions, classes, hooks, or components to test
3. **Create** the file `__tests__/unit/$1.test.ts` (or `.tsx` if React)

## Test file structure
```ts
import { describe, it, expect, vi } from 'vitest';
// imports for modules to be tested

describe('[ModuleName]', () => {
  describe('[functionName]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle edge cases', () => {
      // ...
    });
  });
});
```