# Task 1c: Export JSON column contract

**Wave:** 1 (parallel)  
**Goal:** JSON honors the same ordered `columns: string[]` as CSV; dropped columns omitted; still on-device Blob download.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/shared/export.js` only

Do **not** edit overlay, selectors, content.js, popup. Do **not** commit. Callers in `content.js` still pass old signatures until Wave 3 — keep backward compatibility:

## Required API

Keep `toCsv`, `downloadText`, `exportCsv`. Change JSON:

```js
function toJson(rows, columns) // if columns omitted, keep current dump of row objects
function exportJson(rows, columns, baseName = "click-scrape")
```

- If `columns` is a non-empty array: emit an array of objects with **only** those keys, in that order (JSON.stringify preserves insertion order).
- If `columns` is omitted/empty: previous behavior (stringify `rows` as-is) so existing `exportJson(rows, "click-scrape")` still works (today the second arg is `baseName`). **This is the compatibility trap.**

Today: `exportJson(rows, baseName = "click-scrape")`.

New contract (pick this, document in report):

```js
exportJson(rows, columns, baseName = "click-scrape")
```

- If the second argument is a **string**, treat it as `baseName` (legacy).
- If the second argument is an **array**, treat it as `columns`; optional third arg `baseName`.
- `toJson(rows, columns)` always projects when `columns` is an array.

CSV unchanged: `exportCsv(rows, columns, baseName)`.

No `fetch`. Blob + `<a download>` only. Keep IIFE + `NS.export`.

## Report

Write `/home/c3po/projects/click-scrape/.superpowers/sdd/task-1-export-report.md`
