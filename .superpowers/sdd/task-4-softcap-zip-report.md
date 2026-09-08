# Task 4: Soft cap + popup + zip — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 4 (MVP step 4)

## Summary

Soft nudge is local UX only. After **10** saved recipes the overlay hint and popup show “That’s N recipes saved on this device.” After a walk of **5+** pages the overlay appends “That run covered N pages. Still all on this machine.” Neither nudge blocks save or walk. Hard cap stays **50** in `saveRecipe` (silent truncate). Popup is still Start picking + recipe list (Run / Del). Load-unpacked zip is `click-scrape-unpacked.zip` at the repo root (`manifest.json` at zip root).

## Files changed

| Path | Change |
|------|--------|
| `src/shared/storage.js` | `shouldNudgeRecipes` / `shouldNudgePages`, copy helpers, `HARD_RECIPE_CAP = 50` |
| `src/content/content.js` | overlay hint after save (≥10 recipes) and after Walk pages (≥5 pages) |
| `src/popup/popup.html` | `#nudge` line |
| `src/popup/popup.js` | show/hide recipe nudge from `listRecipes().length` |
| `src/popup/popup.css` | calm `.nudge` (not error-red) |
| `scripts/pack-unpacked.sh` | **new** — `bash scripts/pack-unpacked.sh` |
| `click-scrape-unpacked.zip` | Load-unpacked archive |
| `tests/storage.test.mjs` | **new** — nudge thresholds + hard-50 |
| `tests/helpers/load-click-scrape.mjs` | load `storage.js` |

Did **not** edit: selector/pagination algorithms, `picker-overlay.js`. No commit / no git init.

## Soft cap (UX only)

- Recipe count = `listRecipes().length` after save. Threshold **≥ 10**. Save still completes.
- Page count = `result.pages` from `walkPages` (same local counter as `setLastRunPages`). Threshold **≥ 5**. Walk still completes; max walk remains 20.
- Copy is device-local. No “create an account”, “sign in”, “upgrade required”, or phone-home.

## Zip

```
bash scripts/pack-unpacked.sh
# → /home/c3po/projects/click-scrape/click-scrape-unpacked.zip
```

Includes `manifest.json`, `src/`, `icons/`, `demo.html`, `demo-page-2.html`, `README.md`. Excludes `node_modules`, `.superpowers`, `tests`, `package-lock.json`.

## Tests

```
cd /home/c3po/projects/click-scrape && npm test
# tests 53  suites 8  pass 53  fail 0
```

Storage: nudge at 10/5 (not 9/4); copy strings; `saveRecipe` keeps 50 after 55 inserts.

## How to verify the nudge

**Recipes (overlay + popup):** Load unpacked → `demo.html` → Start picking → Title + Price → **Save recipe** ten times (or seed 10 recipes in `chrome.storage.local`). Overlay hint: “Recipe saved. That’s 10 recipes saved on this device.” Open the popup: same line above the list. Save still works; Run / Del still work.

**Pages:** Walk a listing with **5+** pages (demo.html is only 2 pages, so the page nudge will not appear there). Overlay keeps the row/page summary and appends “That run covered N pages. Still all on this machine.” Walk is not blocked.

## Concerns

1. **`demo.html` is 2 pages**, so the 5-page overlay nudge cannot be checked on the demo fixture. Use a live paginated list or the unit tests.
2. **Recipe nudge needs 10 saves** in a real session unless storage is pre-seeded.
3. **Overlay hint is low-contrast** (existing `.cs-hint` opacity 0.75). Easy to miss next to the table.
4. **No interactive Chrome pass** in this agent; zip listing and unit tests only.
5. Popup nudge hides again if the user deletes below 10 (intentional).
