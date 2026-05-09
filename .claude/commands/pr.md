---
description: Creates a GitHub Pull Request from the current branch
argument-hint: [title] [description]
---

Create a GitHub Pull Request with the title `$1` and the description `$2`.

## Steps

1. Run `git status` to check for uncommitted changes. If there are uncommitted changes, commit them with a coherent message following the project conventions (`feat:`, `fix:`, `refactor:`, etc.).
2. Determine the current branch name. If on `main`, create a new branch with a slug derived from the PR title and switch to it before committing.
3. Push the current branch to origin with `git push -u origin HEAD`.
4. Create the Pull Request using `gh pr create` targeting the `main` branch:
   - Title: `$1`
   - Body format:
     ```
     ## Summary
     $2

     ## Test plan
     - [ ] Verify changes locally
     - [ ] Run `pnpm lint` and `pnpm test:run`

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```
5. Return the PR URL to the user.

## Rules

- Never force-push.
- Never push directly to `main`.
- If `$1` is missing, ask the user for a PR title before proceeding.
- If `$2` is missing, analyze the diff against `main` and generate a concise summary as the description.
- Use a HEREDOC to pass the body to `gh pr create` to ensure correct formatting.
