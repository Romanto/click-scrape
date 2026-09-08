# Task 1: Nested-list selectors — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 1

## Summary

`findListContext` now emits class-qualified `itemSelector` (e.g. `article.product`) and a class-stable `rootSelector` (nth-of-type only when tag+class is not unique). `relativeSelector` is always item-relative (`:scope` or `:scope …`); if the passed item does not contain the field, it walks up to the repeating card ancestor instead of emitting a document `cssPath`. `queryItems` honors CSS selectors (direct children first, then scoped `querySelectorAll`, skipping nested matches). `extractRows` resolves `:scope`, `:scope …`, and unprefixed relative paths.

Deep clicks (title/price/tags inside a card) prefer the card list over inner repeating scalars (e.g. tag `<li>`s), so nested fields become consistent sibling columns.

## Files changed

- `/home/c3po/projects/click-scrape/src/shared/selectors.js`
- `/home/c3po/projects/click-scrape/src/shared/extract.js`

No commit. Did not edit overlay, popup, export, storage, `content.js`, `demo.html`, or tests.

## Frozen API (unchanged names)

```js
NS.selectors = { cssPath, findListContext, relativeSelector, queryItems }
NS.extract = { extractRows }
```

## How to verify

```bash
cd /home/c3po/projects/click-scrape
npm test
```

Expect 10/10 pass. Contracts covered: class-qualified `itemSelector`, item-relative fields, CSS `queryItems("article.product")`, Title+Price rows, recipe rematch.

Interactive (after other Wave 1 files land): Load unpacked → `demo.html` → pick Title then Price inside a card → preview has 5 consistent rows → save recipe → reload page → run recipe rematches.

## Self-review (beyond the suite)

Extra linkedom checks (not committed): tag click still selects `article.product`; first-tag column is `ruled|LED|7-port`; decoy `<article class="ad">` is ignored by `queryItems`; descendant cards under a wrapper still extract; `:scope` and unprefixed `span.title` extract; plain `<ul><li>` still uses `:scope` items.

## Concerns

1. **Live sites not interactively proven.** File lock excluded `content.js` / overlay / `demo.html`. Unit + fixture checks pass; the MVP plan’s “2 live card-style sites” still needs a picker pass after Wave 1 integration.
2. **List-ancestor scoring is heuristic.** Card-like ancestors (semantic tags / product|card classes / inner structure) beat inner tag lists on the demo fixture. Unusual pages with two huge similar layout columns could still win over a smaller card grid.
3. **Tag-only `itemSelector` remains when items have no classes** (e.g. plain `<li>`). Required class-qualified form applies when shared classes exist.
4. **`:nth-of-type` still used in relative paths** when a field has no unique class/id inside the item (e.g. first tag `li`). Root/item selectors avoid it when a class or id is enough.
