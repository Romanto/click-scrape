# Task 4: Soft cap + popup + zip

**Wave:** 4 (MVP step 4)  
**Goal:** Soft nudge after **10** saved recipes or **5** pages in one multi-page run (local only). Popup stays Start picking + recipe list (load/delete). Refresh Load-unpacked zip.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/popup/popup.html`
- `/home/c3po/projects/click-scrape/src/popup/popup.js`
- `/home/c3po/projects/click-scrape/src/popup/popup.css`
- `/home/c3po/projects/click-scrape/src/shared/storage.js` (counters / recipe count helpers)
- `/home/c3po/projects/click-scrape/src/content/content.js` (overlay hint after save / after walk if needed)
- `/home/c3po/projects/click-scrape/scripts/pack-unpacked.sh` (or similar) + produce a zip next to the repo or in `dist/`

Do not change selector/pagination algorithms. Do not commit.

## Soft cap (UX only)

Defaults: nudge after **10** saved recipes **or** **5** pages in one multi-page run.

- Local counters only. `getLastRunPages` already exists. Recipe count = `listRecipes().length` after save.
- Copy: calm, local — **never** “create an account”, “sign in”, “upgrade required”, or phone-home.
- Example: “That’s 10 recipes saved on this device.” / “That run covered 5 pages. Still all on this machine.”
- Hard cap remains 50 in `saveRecipe` (silent truncate) — do not confuse with the soft nudge. Soft nudge does **not** block save/walk.
- Show nudge in overlay hint after save if recipe count >= 10, and after Walk pages if pages >= 5. Optional matching line in popup if recipe list length >= 10.

## Popup

Stay thin: Start picking + saved recipes (Run / Del). Do not duplicate full preview.

## Zip

Package the Load-unpacked folder (manifest.json at zip root): include `manifest.json`, `src/`, `icons/`, `demo.html`, `demo-page-2.html`, README. Exclude `node_modules`, `.superpowers`, tests, package-lock if you want a small zip — tests are not needed for Load unpacked.

Script should be runnable: `bash scripts/pack-unpacked.sh` → e.g. `click-scrape-unpacked.zip` in repo root.

## Tests

Optional: storage helper tests if you add `shouldNudgeRecipes(n)` / `shouldNudgePages(n)` pure functions in storage.js.

## Report

`/home/c3po/projects/click-scrape/.superpowers/sdd/task-4-softcap-zip-report.md`
