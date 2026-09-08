# Task 2: Pagination + stable row merge — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 2 (MVP step 2)

## Summary

Multi-page walk is in `src/shared/pagination.js` (`findNextUrl`, `mergeRows`, `walkPages`). Next is detected from `a[rel="next"]`, Next/›/→/» labels, then numbered links (`2` when current looks like `1`). Each extra page is same-origin `GET` + `DOMParser`; CORS/opaque stops the walk and keeps rows already collected. Merge keys are concatenated recipe field values (`\0`); column keys stay `fields[].name` only. Cap is 20 pages. Last-run page count is stored as `clickScrapeLastRunPages` (scrape continues if the write fails). Overlay **Walk pages** is injected from `content.js` (`#cs-walk`); `picker-overlay.js` was not edited.

## Files changed

| Path | Change |
|------|--------|
| `src/shared/pagination.js` | **new** — findNext / merge / walk |
| `src/content/content.js` | Walk button, `state.rows` / `state.walked`, session export |
| `src/background/service-worker.js` | inject `pagination.js` before `content.js` |
| `src/shared/storage.js` | `setLastRunPages` / `getLastRunPages` only (recipe CRUD untouched) |
| `tests/helpers/load-click-scrape.mjs` | load `pagination.js` |
| `tests/pagination.test.mjs` | **new** — merge/dedupe, findNextUrl, mocked walk |

Did **not** edit: selectors.js, extract.js, export.js, picker-overlay.js/CSS, popup, demo HTML. No commit / no git init.

## How to verify merge of demo page 1+2

**Unit (no server):** from `/home/c3po/projects/click-scrape` run `npm test`. The test `walkPages merges demo page 1+2 into 10 unique stable-column rows` loads `demo.html` + `demo-page-2.html`, walks with a mocked fetch, and asserts **10 unique rows**, columns `Title` + `Price` only, and re-merge of page 1 does not duplicate.

**Interactive:** serve the folder over HTTP (`python3 -m http.server` in the repo root — `file://` fetch of page 2 is often blocked). Load unpacked → open `demo.html` → Start picking → column **Title** click a title → column **Price** click a price → **Walk pages**. Overlay hint goes “Pagination in progress…” then **10 row(s) from 2 page(s).** Preview/export use the merged session rows. Page 2 titles include Ceramic Planter … Stainless Water Bottle.

## Test results

```
cd /home/c3po/projects/click-scrape && npm test
# tests 20  suites 4  pass 20  fail 0
```

Wave 1 suites (selectors / extract / export) still green. Pagination: 9/9 (rel=next, Next text, numbered `2`, page-2 empty, no Previous, dedupe + stable keys, 5+5=10 walk, CORS keeps 5, maxPages cap).

## Concerns

1. **`file://` demo:** next-page `fetch` often fails CORS; walk stops at page 1 with the overlay hint. Use a local HTTP server for the interactive pass.
2. **JS-only pagination** (no `href` in HTML) is out of scope; walk cannot click SPA controls.
3. **Cross-origin / opaque next** stops the walk by design; already-collected rows are kept.
4. Soft-cap **nudge UX at 5 pages is Wave 4**; the counter still increments past 5 (cap 20).
5. Numbered “next” is best-effort (`.current` / `aria-current` + `current+1` link text).
