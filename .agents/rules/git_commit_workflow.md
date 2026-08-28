# Git Commit and Push Rule

Whenever the user requests to **"commit and push"** (or variations like "commit the changes and push to github"):
1. Proactively inspect all modified and untracked files with `git status` and `git diff`.
2. Prepare a comprehensive, clear, pointwise bulleted list of all changes made across the codebase.
3. Stage all modified and new project files with `git add`.
4. Commit the changes using a descriptive, structured commit message that includes the bulleted notes.
5. Push the commit to the active working branch on GitHub (`origin <branch-name>`).
6. Present the pointwise summary and commit details clearly to the user.
