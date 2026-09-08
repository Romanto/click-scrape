# Task 1c Report: Export JSON column contract

**Status:** Complete  
**File changed:** `src/shared/export.js` only  
**Wave:** 1c

## Summary

JSON export now honors the same ordered `columns: string[]` contract as CSV. Dropped columns are omitted from each exported object. Download remains on-device via Blob + `<a download>` (no `fetch`).

## API

### `toJson(rows, columns?)`

- **`columns` is an array** (including empty): returns a pretty-printed JSON string of an array of objects containing **only** the listed keys, in column order (insertion order preserved by `JSON.stringify`).
- **`columns` omitted or not an array**: returns pretty-printed JSON of `rows` unchanged (legacy dump).

### `exportJson(rows, columnsOrBaseName?, baseName?)`

Chosen overload resolution (backward compatible):

| Call pattern | Interpretation |
|---|---|
| `exportJson(rows)` | Full row dump; filename `click-scrape.json` |
| `exportJson(rows, "my-name")` | **Legacy:** second arg is `baseName`; full row dump |
| `exportJson(rows, ["Price", "Title"])` | Column projection; filename `click-scrape.json` |
| `exportJson(rows, ["Price", "Title"], "my-name")` | Column projection; filename `my-name.json` |

Detection rule: if the second argument is an **array**, it is `columns`; if it is a **string**, it is `baseName` (Wave 3 callers will pass `(rows, columns, baseName)`).

### Unchanged

- `toCsv(rows, columns)` — header + rows in column order
- `exportCsv(rows, columns, baseName?)`
- `downloadText(filename, content, mime)`

All functions remain on `ClickScrape.export` inside the existing IIFE.

## Example

```js
const rows = [
  { Title: "A", Price: "1", SKU: "x" },
  { Title: "B", Price: "2", SKU: "y" },
];
ClickScrape.export.toJson(rows, ["Price", "Title"]);
// '[\n  {\n    "Price": "1",\n    "Title": "A"\n  },\n  ...'
// SKU omitted; Price before Title
```

## Compatibility notes

- `content.js` still calls `exportJson(rows, "click-scrape")` — continues to work (string → baseName, no projection) until Wave 3 passes `(rows, columns, baseName)`.
- **Compatibility trap:** a string second arg is always `baseName`, never a single column name. Column projection requires an array.

## Edge cases

- **Empty `columns` array:** projects each row to `{}` (array was explicitly provided).
- **Missing keys on a row:** property present with value `undefined` (JSON.stringify omits `undefined` values in objects).
- **Non-array second arg that is not a string** (e.g. `null`): treated as omitted; uses default `baseName`.

## Concerns / follow-ups

1. Wave 3 must update `content.js` to pass visible column order: `exportJson(rows, columns, baseName)`.
2. Empty-column export (`[]`) yields `{}` per row — confirm product expectation vs. falling back to full dump.
3. Test agent (1d) should assert key order `["Price","Title"]` and omitted keys via `toJson` / parsed `exportJson` output.

## Verification

Manual (browser console after loading extension):

```js
JSON.parse(ClickScrape.export.toJson([{ Title: "A", Price: "1", Extra: "z" }], ["Price", "Title"]));
// [{ Price: "1", Title: "A" }] — Extra absent; Price first
```

Automated checks delegated to Task 1d (`tests/`).
