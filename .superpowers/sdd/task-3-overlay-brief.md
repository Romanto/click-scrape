# Task 3: Overlay preview column edit

**Wave:** 3 (MVP step 3)  
**Goal:** Rename / drop / reorder in `#cs-preview`; first 20 rows + count; empty states; compact host-isolated overlay; field list name-primary.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/content/picker-overlay.js`
- `/home/c3po/projects/click-scrape/src/content/highlighter.css`

Do not edit content.js, selectors, extract, pagination, popup. Do not commit.

## Frozen overlay API (extend, keep existing names)

```js
NS.overlay = {
  ensureOverlay,
  renderFields,
  renderPreview,
  removeOverlay,
  escapeHtml,
  setColumnHandlers, // NEW
  getVisibleColumns, // NEW optional
}
```

### `setColumnHandlers(handlers)`

```js
handlers = {
  onRename(oldName, newName),
  onDrop(name),
  onMove(name, dir), // dir: -1 up / +1 down  (keep vanilla; no HTML5 DnD required)
}
```

Call these from header controls. Overlay does **not** mutate recipe/rows; content.js owns the model (next task). If handlers are missing, controls can still render but no-op or skip wiring.

### `renderPreview(rows, columns, options?)`

- `options.empty` optional string; otherwise derive:
  - no columns: “Click elements to add columns.”
  - columns but 0 rows: “No rows matched.”
  - `options.pagination` true: “Pagination in progress…”
- Show first **20** rows; caption: `N row(s) — showing M`
- Headers: editable (inline input on click or small edit control) + drop (×) + up/down
- Do **not** re-walk the DOM to reorder

### `renderFields(fields)`

Human-readable `name` primary; `relativeSelector` secondary/collapsed (`<code>` smaller/opacity or `<details>`). Optional per-field remove if you add `handlers.onDrop(name)` reuse.

### Overlay chrome

Keep compact (existing 360px panel OK). Host CSS isolation already uses `all: initial` — keep it. Highlight rings: ensure readable on light and dark pages (current blue/green outlines are OK; bump contrast if needed). Esc/Stop remain in content.js.

No React, no design system.

## Tests

If useful, add `tests/overlay.test.mjs` using linkedom: renderPreview slice 20, empty copy. Optional. Do not fail the suite if overlay needs `document.getElementById` on a real DOM — a small linkedom test is enough.

## Report

`/home/c3po/projects/click-scrape/.superpowers/sdd/task-3-overlay-report.md`
