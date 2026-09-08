# Task 3b: Column model wiring — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 3 sequential

## Summary

`content.js` now owns the column model. Overlay `setColumnHandlers` is wired in `bindOverlay()` (re-set when the overlay is reused). Preview, CSV, and JSON all use `getColumns()` — visible names in `columnOrder`, hidden names omitted. Rename remaps `fields[].name` and row keys together. Drop/reorder do not call `extractRows`. Recipes store optional `columnOrder` / `hiddenColumns`; `runRecipe` restores them. Walk merge honors `options.columns` so dropped columns stay dropped after pagination.

## Files changed

| Path | Change |
|------|--------|
| `src/content/content.js` | columnOrder / hiddenColumns, handlers, getColumns, save/run recipe |
| `src/shared/columns.js` | **new** — `visibleColumns`, `renameColumn`, `dropColumn`, `moveColumn` |
| `src/shared/pagination.js` | `walkPages` accepts `options.columns` (visible-only merge) |
| `src/background/service-worker.js` | inject `columns.js` in CONTENT_FILES |
| `tests/helpers/load-click-scrape.mjs` | load `columns.js` |
| `tests/columns.test.mjs` | **new** — rename/drop/move + CSV/JSON projection |
| `tests/pagination.test.mjs` | `options.columns` omits dropped fields after merge |

Did **not** edit: picker-overlay.js, CSS, popup. No commit / no git init.

## Column model

- `state.fields` remains the extract source of truth (`name` + `relativeSelector`).
- `state.columnOrder` is visible names in preview order.
- `state.hiddenColumns` is dropped names (selectors kept on `fields`).
- `getColumns()` → `visibleColumns(columnOrder, hidden)` intersected with current field names. That array is the contract for `renderPreview`, `exportCsv`, `exportJson`.

### Rename (`onRename`)

`NS.columns.renameColumn`: skip empty/unchanged names; on collision append ` 2` (then ` 3`…). Updates matching `fields[].name`, remaps keys on `state.rows`, rewrites `columnOrder` / `hiddenColumns`. Then `renderFields` + `renderPreview` — **no extract**.

### Drop (`onDrop`)

Adds the name to `hiddenColumns` and removes it from `columnOrder`. Does **not** delete `relativeSelector`. Preview/export omit it. Undo still pops the last *field*; drop is independent.

### Reorder (`onMove`)

Permutes `columnOrder` by ±1. No `extractRows`. Overlay ↑↓ fire `onMove(name, dir)`.

### New pick / refresh / walk / recipe

- New pick appends to `fields` and `columnOrder`; `refreshUi` still extracts.
- After rename/drop/move: `applyColumnView()` → `renderFields(visible)` + `renderPreview(getSessionRows(), getColumns(), { pagination: state.walking })`.
- Save recipe includes `columnOrder` and `hiddenColumns`.
- `runRecipe` restores those arrays (defaults: all field names / `[]`).
- `walkPages(recipe, doc, { columns: getColumns() })` so merge/project omits dropped keys.

## Tests

```
cd /home/c3po/projects/click-scrape && npm test
# tests 45  suites 6  pass 45  fail 0
```

Columns: 7/7. Pagination: 18/18 including `walkPages options.columns omits dropped fields after merge`. Export projection still green (`["Price","Title"]`, Meta omitted).

## How to verify interactively

Load unpacked → `demo.html` → Start picking → Title + Price. Preview headers: rename inline, × drops Price (field + selector remain in `fields`, gone from preview). ↑↓ swap Title/Price. **Export CSV/JSON** headers/keys match the visible table order; dropped column absent. Save recipe, re-run from popup: same order/visibility. Walk pages after dropping Price: merged rows are Title-only.

## Concerns

1. **`options.pagination` hides the table** even when rows exist (overlay behavior). Walk `onProgress` still paints rows *without* that flag so the growing table stays visible. Rename/drop/move during a walk would pass `{ pagination: true }` and briefly replace the table with “Pagination in progress…”.
2. **Dropping every column** leaves `getColumns()` empty; overlay empty copy is “Click elements to add columns.” even though `fields` still exist. Export with `[]` yields `{}` per row (existing export contract). Walk with `columns: []` makes `mergeRows` return `[]`.
3. **Walk merge keys are visible-only.** Rows that differed only in a dropped column can collapse as duplicates.
4. **`getSessionRows` is the in-memory cache** (`state.rows`) so drop/reorder/rename do not re-walk the DOM. Non-walked export no longer live-re-extracts; it uses the last pick extract (rename remaps stay consistent).
5. **Field list shows visible columns only.** A dropped field is hidden from `#cs-fields`; Undo may pop a field that is no longer listed.
6. **No end-to-end content.js test** (`chrome.runtime` IIFE). Interactive picker pass not run in this agent.
