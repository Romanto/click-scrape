# Task 1: Nested-list selectors

**Wave:** 1 (MVP step 1)  
**Goal:** Nested/card picks yield consistent sibling columns; a saved recipe rematches after reload.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/shared/selectors.js`
- `/home/c3po/projects/click-scrape/src/shared/extract.js`

Do **not** edit overlay, popup, export, storage, `content.js`, `demo.html`, or tests. Do **not** commit (repo has no git; skip git).

## Frozen public API (keep names)

```js
NS.selectors = { cssPath, findListContext, relativeSelector, queryItems }
NS.extract = { extractRows }
```

- `findListContext(fieldEl)` → `{ root, items, itemSelector, rootSelector }`
- `itemSelector` MUST be a CSS selector usable under the list root (not tag-only). Prefer tag+shared classes, e.g. `article.product`. Avoid `:nth-of-type` in `rootSelector` / `itemSelector` when a class or id is enough.
- `relativeSelector(item, fieldEl)` MUST be item-relative: `:scope` or a selector that works with `item.querySelector(...)`. Prefer a `:scope ` prefix for descendant paths. **Never** return a document-absolute `cssPath` for a field. If `item` does not contain `fieldEl`, walk up from `fieldEl` to the repeating item ancestor (same logic as `findListContext`) and generate the path from that ancestor — do not emit a page-absolute path.
- `queryItems(root, itemSelector)` must honor CSS `itemSelector` (not only tag-name equality). Direct-children-only is OK when items are children of root; if `itemSelector` matches descendants, use `root.querySelectorAll` scoped reasonably so nested cards work.
- `extractRows(recipe, doc = document)` must keep working with the richer `itemSelector` and `:scope` relative paths. Handle `relativeSelector === ":scope"` and `:scope …` / unprefixed relative paths.

## Required behavior

1. Repeating item containers (same tag + similar class/structure siblings), then each field relative to the item.
2. Deep click (title inside a card) walks up to the repeating item ancestor before generating `relativeSelector`.
3. Nested/card layouts: picking a nested field yields consistent columns across siblings.
4. Same recipe after reload rematches: `rootSelector` + `itemSelector` + relative fields must not depend on ads/chrome shifting via brittle nth-of-type roots when classes exist.
5. No `fetch`/XHR. No new frameworks. Keep IIFE + `globalThis.ClickScrape`. `shared/*` stays free of overlay chrome.

## Do not

Pagination, overlay UX, soft cap, zip, content.js picker wiring (a later sequential task).

## Report

Write `/home/c3po/projects/click-scrape/.superpowers/sdd/task-1-selectors-report.md`  
Return status DONE | DONE_WITH_CONCERNS | BLOCKED, files changed, how to verify, concerns. No commit.
