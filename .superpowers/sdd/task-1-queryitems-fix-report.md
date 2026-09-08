# Task 1: queryItems CSS-only fallback fix — Report

**Status:** DONE  
**Date:** 2026-09-07  
**Wave:** 1 (review follow-up)

## Summary

Fixed an Important review finding in `queryItems`: when `itemSelector` is set and not `"*"`, the function now returns only CSS matches from `topLevelMatches` (empty array allowed). The `groupedChildren` heuristic is retained only for `"*"` or an empty selector.

Previously, a non-matching class-qualified selector (e.g. `article.product` after a DOM change or rematch miss) would fall back to `groupedChildren`, potentially scraping decoy sibling nodes (plain `article` elements without `.product`).

## Change

**Before** (`selectors.js` ~306–314):

```js
if (sel !== "*") {
  const scoped = topLevelMatches(root, sel);
  if (scoped.length) return scoped;
}
return groupedChildren(root);
```

**After:**

```js
if (sel !== "*") return topLevelMatches(root, sel);
return groupedChildren(root);
```

## Test added

`tests/selectors.test.mjs` — **"queryItems returns empty array when class-qualified selector matches nothing"**

- Builds a root with `<article class="decoy">` and plain `<article>` children (no `.product`).
- Asserts `queryItems(root, "article.product")` has length `0`.
- Uses `items.length === 0` instead of `deepEqual([], items)` because arrays returned from the linkedom/vm sandbox are cross-realm and fail strict deep equality despite being empty.

## Files changed

- `/home/c3po/projects/click-scrape/src/shared/selectors.js`
- `/home/c3po/projects/click-scrape/tests/selectors.test.mjs`

No commit (per instructions).

## Test result

```bash
cd /home/c3po/projects/click-scrape
npm test
```

**11/11 pass** (3 suites: export 3, extract 4, selectors 4).

## Behavior preserved

- `"*"` or empty selector → `groupedChildren(root)` unchanged.
- Explicit CSS selectors with matches → same `topLevelMatches` path as before.
- No changes to `findListContext`, `relativeSelector`, or `extractRows`.
