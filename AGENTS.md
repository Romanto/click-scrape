# Agent notes — Click Scrape

Read this before changing picker, selectors, overlay, pagination, export, or packaging.
Product brief: [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md). PR #5 adds scoped similar-peer hover.

## Stack

Chrome MV3, **zero-build vanilla JS**. Scripts inject at runtime via the service worker. No React, bundlers, or design-system packages.

## Layout and ownership

| Path | Role | Notes |
|------|------|--------|
| `src/shared/selectors.js` | List/item/field selectors + **similar peers** | Pure-ish DOM helpers on `ClickScrape.selectors` |
| `src/shared/extract.js` | `extractRows(recipe, doc)` | Item-relative fields |
| `src/shared/columns.js` | Rename / drop / reorder / `applyPick` | No DOM re-walk for edit |
| `src/shared/rows.js` | Preview row edit helpers | `updateCell` / `addRow` / `removeRow` / dirty merge |
| `src/shared/pagination.js` | `findNextUrl`, `mergeRows`, `walkPages` | Same-origin GET of next HTML only |
| `src/shared/export.js` | CSV/JSON Blob download | `exportJson(rows, columns\|baseName, baseName?)` |
| `src/shared/storage.js` | Recipes + soft-nudge helpers | Hard cap 50; soft nudge 10 recipes / 5 pages |
| `src/content/content.js` | Picker state, overlay bind, walk, handlers | Owns recipe session; injects Walk button |
| `src/content/picker-overlay.js` | Overlay chrome + preview controls | Does **not** mutate recipe; fires handlers |
| `src/content/highlighter.css` | Hover / selected / **similar** / overlay CSS | Host-isolated overlay (`all: initial`) |
| `src/background/service-worker.js` | Inject + message relay only | No scrape / storage / export logic |
| `src/popup/*` | Start picking + recipe list | Thin; Edit / Run / Del; no full preview |
| `demo.html`, `demo-page-2.html` | Nested cards + pagination fixtures | Serve over HTTP for Walk |
| `tests/**` | Contract tests (`npm test`) | linkedom; do not weaken for old bugs |

## Global namespace

```js
globalThis.ClickScrape = {
  selectors, extract, export, storage, pagination, columns, rows, overlay
}
```

Service worker `CONTENT_FILES` order matters — shared modules (including `rows.js`) before `picker-overlay.js` before `content.js`.

## Similar-peer hover (PR #5 / post-MVP)

**Goal:** While hovering a field, outline **sibling peers in the same list region** so the user sees what a pick would scrape. Must **not** highlight every node that shares a site-wide class (e.g. Amazon `.a-list-item`).

### API (`src/shared/selectors.js`)

```js
ClickScrape.selectors.findSimilarPeers(element) → Element[]
ClickScrape.selectors.getSimilarScopeRoot(element) → Element|null
```

- `getSimilarScopeRoot` — narrow scope (feature-bullets ids, nearest `ul`/`ol` with ≥2 `li`, then main/product column, else `documentElement`).
- `findSimilarPeers` — prefer a **non-unique** CSS peer selector inside that scope (smallest match count in `[2, MAX_SIMILAR_PEERS]`); fallback to direct sibling `<li>` rows under the innermost list. Returns peers **excluding** the hovered node / its match root.
- `findListContext` also uses scoped peer + sibling-`li` candidates so list detection stays consistent with hover.
- Strip `click-scrape-*` and `esp-*` from class-based selectors (`stableClasses`).

### Wiring (`src/content/content.js` + `highlighter.css`)

- `onMouseMove` → `findSimilarPeers(el)` → add `.click-scrape-similar` (dashed outline).
- Clear similar hints with hover clear and on stop.
- Do **not** put scrape logic in CSS; do **not** let similar classes leak into saved selectors (already filtered).

### Tests

- Fixture: `tests/fixtures/noisy-bullets.html`
- Cases in `tests/selectors.test.mjs`: scoped peers, `ul`/`ol` fallback, `findListContext` ignores page-wide noise.

### Do not

- Match peers with document-absolute `:nth-of-type` paths (those are unique — useless for “similar”).
- Use unqualified site-wide class queries without `getSimilarScopeRoot`.
- Cap peer highlights without a scope (perf + noise).

## Other contracts agents must keep

1. **Item-relative fields:** `relativeSelector` is `:scope` / `:scope …` (or queryable from the item). Never save a document `cssPath` for a field.
2. **`itemSelector`:** CSS under the list root when classes exist (e.g. `article.product`), not tag-only.
3. **`queryItems`:** non-`*` selector → CSS matches only (empty OK). No tag-group fallback on miss.
4. **Columns:** preview/export use `getColumns()` / `columnOrder` + `hiddenColumns`. Drop does not delete `relativeSelector`. Rename remaps field name + row keys together.
5. **Pagination:** same-origin next HTML only; dedupe by concatenated visible column values; abort on Stop; no row upload. Walk is blocked while any preview table is `rowsDirty`.
6. **Soft cap:** UX nudge only (never “create an account”); does not block save/walk.
7. **No** `fetch` of scraped rows/recipes; permissions stay minimal.
8. **List groups (multi-table preview):** each repeating list is a **group** with its own `liveItems` / fields / rows. A **nested** disjoint list under a greedy first pick **replaces** all groups. A **sibling** disjoint list **starts a new group** (own table from row 1). A click **outside every current live item** (e.g. price block → shipping line) also starts a new group — never glue onto the last group (that yields empty cells). Same-list clicks still add columns to that group. Export concatenates groups with a blank CSV separator (JSON array of tables). Saved recipes store a `groups[]` array (legacy top-level `fields` / `rootSelector` remain the first group for Walk).
9. **Dense list peers only:** `findListContext` must not treat page-wide `.celwidget` (or other sparse peers) as rows when the picked field rematches only one of them — fall back to a singleton host (e.g. `#corePrice_desktop`) so Price + Discount% yield one filled row, not a table of blanks.
10. **Preview row edit:** users may edit cells, add rows, and delete rows in the overlay. That sets `rowsDirty` so `refreshGroupRows` will not overwrite edits. **Reset from page** clears dirty and re-scrapes. Recipes never store row payloads — Run always re-scrapes. Export uses the edited `group.rows`.
11. **Unique ids in selectors:** `cssPath` / singleton `itemSelector` must not stop on an `id` that appears more than once in the document (Amazon reuses `#tp-inline-twister-dim-values-container`). Prefer a unique ancestor (e.g. `#inline-twister-expander-content-size_name`) so Run rematches Size, not Color.
12. **Edit saved recipe:** Popup **Edit** (or Run → **Edit recipe**) rematches `groups[]` and enables picking — same click-to-add behavior as Start picking (lists auto-detect). Drop columns with × (last column removes that table). **Update recipe** overwrites the same `recipe.id` (keeps name/`createdAt`); still no row snapshots.

## How to verify

```bash
npm test
python3 -m http.server 8765   # then Load unpacked → http://127.0.0.1:8765/demo.html
```

Hover a nested title: sibling cards should show dashed similar outlines. Walk pages needs HTTP (not `file://`).

Packaging: `bash scripts/pack-unpacked.sh` → `click-scrape-unpacked.zip` (extension files only; excludes `tests/`, `node_modules/`, `.superpowers/`).
