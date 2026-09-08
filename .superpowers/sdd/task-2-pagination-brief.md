# Task 2: Pagination + stable row merge

**Wave:** 2 (MVP step 2)  
**Goal:** Walk next/numbered pages; dedupe; merge into one preview with stable column keys; local page counter hook for step 4.

## File lock (write)

- new `/home/c3po/projects/click-scrape/src/shared/pagination.js` (preferred)
- `/home/c3po/projects/click-scrape/src/content/content.js` (walk + merge + overlay hint)
- `/home/c3po/projects/click-scrape/src/background/service-worker.js` (add `pagination.js` to CONTENT_FILES **before** content.js)
- `/home/c3po/projects/click-scrape/src/shared/storage.js` **only** if you add a tiny local counter API (do not change recipe CRUD)

Do not edit selectors.js, extract.js, export.js, overlay JS/CSS, popup, demo HTML (fixtures already exist). Do not commit.

## Behavior

1. Detect common next controls in a document (best-effort, no site plugins):
   - `a[rel="next"]`
   - link/button whose text is Next / next / › / → / » (trim, case-insensitive)
   - simple numbered page links (e.g. `a` with text `2` when current page looks like 1)
2. Walk sequentially. For each additional page: load HTML, `extractRows(recipe, doc)`, merge.
3. **Load strategy:** same-origin `fetch` of the next href, then `DOMParser` — this loads host pages the user could have opened. Do **not** POST/send scraped rows anywhere. If fetch fails (CORS/opaque), stop walking and keep rows already collected; set overlay hint.
4. **Dedupe:** stable key = concatenated visible column values (join with `\0` or `|`). Next-back must not duplicate.
5. **Stable columns:** keys from recipe `fields[].name` only — no header drift across pages.
6. **Soft page counter:** increment a local counter per page in the run (page 1 = 1). Persist last-run page count in `chrome.storage.local` (e.g. key `clickScrapeLastRunPages` or via storage helper). Scraping must still work if storage write fails. Do **not** implement nudge UX (Wave 4).
7. Cap the walk at a sane max (e.g. 20 pages) so a broken next loop cannot run forever. Soft-cap *nudge* at 5 is Wave 4; walking past 5 in MVP is OK, but still increment the counter.
8. Trigger: overlay needs a way to start a multi-page run. Add a **Next pages** / **Walk pagination** button in the overlay HTML **only if you must** — prefer wiring from content.js: after picks (or on Run recipe), expose `NS.overlay` existing buttons. Simplest: add `#cs-pages` button in picker-overlay.js... **file lock says do not edit overlay.** So add the button from content.js (`document.createElement`) next to export buttons, or walk automatically when user clicks a new `#cs-walk` you inject from content.js. Injecting one button from content.js is allowed without editing picker-overlay.js.
9. While walking, update preview with merged rows; hint: “Pagination in progress…” then final row count.
10. Export/save still use the **merged** in-memory rows for that session (keep `state.rows` if you add it). Single-page pick without walking still extracts current document only.

Vanilla JS IIFE. Attach `NS.pagination = { findNextUrl, mergeRows, walkPages, ... }` as needed.

Fixtures: `demo.html` + `demo-page-2.html` (Next / numbered 2). Prove merge 5+5 unique rows.

## Tests

Add `tests/pagination.test.mjs`: merge/dedupe + findNextUrl on fixture HTML strings. Walk/fetch can be mocked (pass two Document objects). Do not require a live server.

## Report

`/home/c3po/projects/click-scrape/.superpowers/sdd/task-2-pagination-report.md`
