# Task 3: Overlay preview column edit — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 3 (MVP step 3)

## Summary

`#cs-preview` now shows rename / drop / up-down header controls, first **20** rows, a `N row(s) — showing M` caption, and empty copy (no columns / no rows / pagination / `options.empty`). Field list is name-primary with a faded selector line and a per-field × that reuses `onDrop`. Overlay does **not** mutate recipe/rows; `setColumnHandlers` fires `onRename` / `onDrop` / `onMove` only. Host isolation (`all: initial`) kept; highlight rings gained a white hairline + glow for light/dark pages.

## Files changed

| Path | Change |
|------|--------|
| `src/content/picker-overlay.js` | column handlers, 20-row preview, empty states, field list UX |
| `src/content/highlighter.css` | header/field/empty styles; hover/selected contrast |
| `tests/overlay.test.mjs` | **new** — slice 20, empty copy, handlers, API surface |

Did **not** edit: content.js, selectors, extract, pagination, popup. No commit / no git init.

## Overlay API

```js
NS.overlay = {
  ensureOverlay,
  renderFields,
  renderPreview,      // (rows, columns, options?)
  removeOverlay,
  escapeHtml,
  setColumnHandlers,  // { onRename(old, next), onDrop(name), onMove(name, dir) } dir: -1 | +1
  getVisibleColumns,  // last columns passed to renderPreview
}
```

Existing IDs unchanged (`#cs-preview`, `#cs-fields`, export/undo/stop). `ensureOverlay` does not rewrite an already-mounted panel (Walk pages button from content.js is preserved).

## How to verify

**Unit:** `cd /home/c3po/projects/click-scrape && npm test` — 37 pass / 0 fail (overlay 9/9).

**Visual (controls exist; rename/drop/reorder no-op until content.js wires handlers):** Load unpacked → `demo.html` → Start picking. Before any click: preview shows “Click elements to add columns.” Add Title + Price: field names bold, selectors faded; preview headers show name + ↑↓×; caption `N row(s) — showing M` (cap 20). Click name → inline input; × / arrows fire nothing until `setColumnHandlers`. Pagination copy is for `renderPreview(rows, cols, { pagination: true })` — content.js still uses the top hint during walks.

## Concerns

1. **Handlers unwired.** content.js does not call `setColumnHandlers`; UI is visible but no-op. Next agent must update the column model and re-`renderPreview`.
2. **`renderPreview([], [])` empty copy.** Former blank preview now shows “Click elements to add columns.” — intended; content.js already uses that call when there are no fields.
3. **`options.pagination` hides the table** even if rows are passed. content.js does not pass this flag yet (walk still paints rows). Next agent should pass it only when the table should be replaced, or omit it when rows exist.
4. **No HTML5 drag-and-drop** (vanilla ↑↓ only, per brief).
5. **Interactive pass not done here** (file lock excluded content.js / demo picker wiring).
