# Yonder Graph Project Rules

## Git Workflow
Whenever the user asks to **"commit and push"**:
1. Review all modified and untracked files via `git status` and `git diff`.
2. Formulate structured pointwise bullet points detailing the changes.
3. Stage the files (`git add`), commit with the structured message, and push to the corresponding branch on GitHub (`git push origin <branch>`).
4. Output the bullet points to the user in the response.

## Experimental Features Workflow
Whenever the user asks to **"make this as an experimental feature"**:
1. **Disabled by Default**: Register in `SettingsContext.jsx` with default `false`, persisted in `localStorage` under `yg-experimental-<feature>`.
2. **Add to Settings Popover**: Add a toggle row under `Experimental Features` in `Sidebar.jsx` with title, `BETA` pill, 1-sentence description, and toggle switch.
3. **Frontend Conditioning**: Use `useSettings()` to conditionally render views, tabs, buttons, or modals.
4. **Backend Conditioning**: Guard backend execution pathways accordingly when the feature is active or inactive.
