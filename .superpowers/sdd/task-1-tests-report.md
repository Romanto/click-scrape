# Task 1d: Selector + extract + export unit checks — Report

**Status:** DONE_WITH_CONCERNS (suite RED on selector contract)

**Date:** 2026-09-07

## Summary

Added a test-only Node runner that loads production IIFEs (`selectors.js`, `extract.js`, `export.js`) into linkedom via `vm.runInNewContext`. Tests encode MVP contracts from the brief; they are **not** weakened to match legacy bugs.

## How to run

```bash
cd /home/c3po/projects/click-scrape
npm install   # first time only — installs linkedom devDependency
npm test
```

Runner: Node built-in `node:test` (no bundler). Command: `node --test tests/**/*.test.mjs`.

## Files added

| Path | Purpose |
|------|---------|
| `package.json` | Test-only scripts + linkedom devDependency |
| `tests/helpers/load-click-scrape.mjs` | DOM bootstrap, IIFE loader, contract helpers |
| `tests/fixtures/nested-cards.html` | Nested card grid (3 products, tags inside cards) |
| `tests/selectors.test.mjs` | `findListContext`, `relativeSelector`, `queryItems` |
| `tests/extract.test.mjs` | `extractRows` row/column/determinism contracts |
| `tests/export.test.mjs` | `toJson` / `exportJson` column projection + CSV sanity |

No production `src/**` files were edited.

## Test results (last run)

```
# tests 10
# pass 9
# fail 1
```

| Suite | Test | Result | Notes |
|-------|------|--------|-------|
| selectors | `findListContext` class-qualified `itemSelector` | **FAIL** | Returns `article` (tag-only); contract requires e.g. `article.product` |
| selectors | `relativeSelector` item-relative on all siblings | PASS | Paths resolve via `item.querySelector`, no `html`/`body` prefix |
| selectors | `queryItems(root, "article.product")` | PASS | See concern below — passes incidentally on fixture |
| extract | recipe fields item-relative | PASS | |
| extract | one row per card, Title + Price | PASS | 3 rows, correct values |
| extract | same recipe twice → same rows/keys | PASS | Deterministic rematch |
| extract | explicit `itemSelector: "article.product"` | PASS | Works with current tag fallback when all children match |
| export | `toJson(rows, ["Price","Title"])` projection | PASS | Keys in order; `Meta` omitted |
| export | `exportJson(rows, columns, baseName)` projection | PASS | Blob capture verifies download payload |
| export | `toCsv` column order unchanged | PASS | |

Exit code: **1** (RED until selectors agent ships class-qualified `itemSelector`).

## Contract coverage vs brief

1. **Nested card / item-relative selector** — `relativeSelector` test enforces no document-absolute paths and sibling resolution. Covered.
2. **Title + Price across sibling cards** — extract yields 3 rows with consistent columns. Covered.
3. **Same recipe twice** — row count, keys, and values identical. Covered.
4. **`itemSelector` as class-qualified CSS** — `findListContext` FAIL (RED); `queryItems`/`extractRows` explicit-selector cases added.
5. **Export column projection** — `toJson` / `exportJson` with `["Price","Title"]` emits only those keys in order. Covered (export agent already landed `toJson`).

## Concerns

1. **`queryItems` false positive:** Current implementation compares `itemSelector` to tag name only (`article.product` === tag check fails, then falls back to “largest child group”). Test passes because all `.products` children are `article.product`. A decoy `article` without `.product` would break extraction but not fail this test yet. Selectors agent should implement real CSS matching (`querySelectorAll` scoped under root).
2. **`findListContext` RED:** `itemSelector` is `article` not `article.product` — blocks stable recipes when page has other `article` elements.
3. **linkedom quirks:** `deepStrictEqual` on text nodes failed on boxed strings; tests coerce with template literals. `classList.item()` unavailable — tests use `.contains()`.
4. **Parallel drift:** Export module already implements `toJson` / new `exportJson` signature; selectors module still pre-contract. Re-run `npm test` after selectors land to confirm green.

## Next steps for other agents

- **Selectors (Task 1):** Emit class-qualified `itemSelector`; honor CSS in `queryItems`; keep `relativeSelector` item-relative (already mostly OK for nested picks).
- **Export (Task 1c):** No test changes needed — export tests green.
- After selectors fix: expect **10/10 pass**.
