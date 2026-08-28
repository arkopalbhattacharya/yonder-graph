# Experimental Features Workflow Rule

Whenever the user requests to **"make this as an experimental feature"** (or "add this as experimental", "flag this under experimental features"):

1. **Disabled by Default**:
   - Register the feature flag in `frontend/src/context/SettingsContext.jsx` with default value `false`.
   - Persist the state in `localStorage` under `yg-experimental-<feature_name>`.

2. **Add to Settings Popover**:
   - In `frontend/src/components/Sidebar.jsx`, under the `Experimental Features` section in the user profile/settings popover, add a clean toggle card with:
     - Feature title and `BETA` badge pill (`bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400`).
     - A concise 1-sentence technical explanation of what the feature does.
     - An animated toggle switch bound to `toggle<Feature>()`.

3. **Frontend Conditioning**:
   - Conditionally show or hide the corresponding views, navigation items, buttons, or modal triggers based on `enable<Feature>` from `useSettings()`.
   - If disabled, redirect navigation gracefully to the default active view (`resolve`).

4. **Backend Conditioning (if applicable)**:
   - Guard backend execution pathways using header/query parameter flags or environment variables when an experimental feature is invoked.
