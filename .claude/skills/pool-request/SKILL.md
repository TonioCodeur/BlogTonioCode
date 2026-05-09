---
name: pull request
description: create a pull request for the project on GitHub
---

# Skill Title

Pull request for GitHub

## Instructions

1. Ensure you are not on the main branch.
2. If your changes haven't been committed yet, run the following (replace "Message" with your actual commit message, and "my-feature" with `$1`):
```bash
git add .
git commit -m "Message"
git push -u origin my-feature
```
3. In your terminal, replace "my-feature" with `$1`, "PR Title" with `$2`, and "Description" with `$3`, then execute:
```bash
git checkout -b my-feature
# ... make your changes ...
# then run gh pr create OR use the GitHub link
gh pr create --title "PR Title" --body "Description"
```
4. Make sure everything worked! If not, try again.
...