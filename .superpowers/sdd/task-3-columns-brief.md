# Task 3b: Column model wiring

**Wave:** 3 sequential  
**Goal:** `content.js` drives extract/export from ordered visible columns; recipe may store `columnOrder` / `hiddenColumns`. Rename updates `fields[].name` + row keys together. Drop/reorder do not re-walk the DOM.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/content/content.js` only

Do not edit picker-overlay.js / CSS. Do not commit.

## Overlay API already landed

```js
NS.overlay.setColumnHandlers({ onRename, onDrop, onMove })
NS.overlay.renderPreview(rows, columns, { empty?, pagination? })
NS.overlay.getVisibleColumns()
```

Call `setColumnHandlers` once in `bindOverlay()` (reset when overlay is recreated).

## Column model

- Keep `state.fields` as the extract source of truth (name + relativeSelector).
- Add `state.columnOrder: string[]` (visible names in preview order) and `state.hiddenColumns: string[]`.
- `getColumns()` returns visible names in `columnOrder` (exclude hidden). This is the contract for preview, CSV, JSON (`exportJson(rows, columns, baseName)` already used).
- **Rename:** change matching `fields[].name`, remap keys on `state.rows`, update columnOrder/hidden. Skip empty names. If collision, append ` 2`.
- **Drop:** add name to hiddenColumns (do not delete relativeSelector). Preview/export omit it. Optional: undo still pops last *field*; drop is independent.
- **Move:** permute `columnOrder` by ±1. Do not call `extractRows`.
- After rename/drop/move: `renderFields` + `renderPreview(getSessionRows(), getColumns(), { pagination: state.walking })` — **no extract** for drop/move. Rename of keys does not require extract.
- Adding a new pick field appends to `fields` and `columnOrder`.
- `refreshUi` after a new pick still extracts (new column).
- Save recipe: include optional `columnOrder` and `hiddenColumns`.
- `runRecipe`: restore those arrays if present; `getColumns()` must match saved visibility/order.

Walk pages should use `getColumns()` so dropped columns stay dropped after merge (`projectRow` already uses recipe field names — **problem**: walkPages uses `recipe.fields.map(f => f.name)` which includes hidden fields).

Pass visible columns into walk: either temporarily set recipe.fields to visible-only for walk, or pass `options.columns = getColumns()` if pagination.walkPages supports it.

Check `walkPages` — it does `const columns = (recipe?.fields || []).map((f) => f.name)`. You MAY add `options.columns` in **pagination.js** if needed — that's a small allowed exception to the file lock so merge honors visible columns. Do not otherwise refactor pagination.

## Tests

Add `tests/columns.test.mjs` if you can test pure helpers. If logic stays inside content.js IIFE, skip or extract tiny `NS.columns` helpers in content.js only. Prefer keeping logic in content.js and not adding a new shared file unless rename/drop/reorder is cleaner as 20 lines in `src/shared/columns.js` **and** you add that file to service-worker CONTENT_FILES. Allowed: new `src/shared/columns.js` for `renameColumn`, `dropColumn`, `moveColumn`, `visibleColumns` — then you must update service-worker.js CONTENT_FILES. That's OK.

## Report

`/home/c3po/projects/click-scrape/.superpowers/sdd/task-3-columns-report.md`
