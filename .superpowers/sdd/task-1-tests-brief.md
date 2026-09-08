# Task 1d: Selector + extract + export unit checks

**Wave:** 1 (parallel)  
**Goal:** Pure tests for selector generation, extract, and JSON column projection.

## File lock (write)

- new `/home/c3po/projects/click-scrape/tests/**` only
- you MAY add a **test-only** `package.json` at repo root if a runner is required

Do **not** edit production `src/**` to make tests pass. Do **not** commit.

## Frozen APIs under test

Load the IIFE files into a DOM (jsdom / linkedom / happy-dom is OK as a **devDependency**). Do not add a bundler or React.

```js
ClickScrape.selectors.findListContext(fieldEl)
ClickScrape.selectors.relativeSelector(item, fieldEl)
ClickScrape.selectors.queryItems(root, itemSelector)
ClickScrape.extract.extractRows(recipe, doc)
ClickScrape.export.toCsv / toJson or exportJson projection
```

## Cases (must encode MVP contracts, not current bugs)

1. Nested card fixture HTML string: click/title node deep inside `article.product`; `relativeSelector` is item-relative (`:scope` or queryable from the item), **not** a path from `html`/`body`.
2. Extracting Title + Price across sibling cards yields one row per card, consistent columns.
3. Same recipe object run twice on the same fixture DOM rematches the same row count and keys.
4. `itemSelector` as a class-qualified selector (e.g. `article.product`) finds items.
5. Export: `toJson`/`exportJson` with `columns: ["Price","Title"]` emits only those keys in that order; dropped keys omitted.

If current `src` fails these tests, **leave them failing** and report RED. Do not weaken assertions. Selectors/Export agents are changing production files in parallel — your job is the contract, not a green suite against old code.

Keep tests runnable with one command documented in the report (e.g. `npm test`).

## Report

Write `/home/c3po/projects/click-scrape/.superpowers/sdd/task-1-tests-report.md`
