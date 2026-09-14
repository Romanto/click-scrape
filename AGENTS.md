# Agent notes — Nestix / Click Scrape

Read this before changing picker, selectors, overlay, pagination, export, or packaging — and before **exploring** the extension against the business plan.

| Doc | Use for |
|-----|---------|
| [README.md](README.md) | Product overview, feature status table, load + explore playbook |
| [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md) | Business wedge, MVP build order, competitors, non-goals, paid later |
| **This file** | File ownership, engineering contracts, feature → code map |

Store UI name: **Nestix**. Repo / namespaces: `ClickScrape`, `click-scrape-*`.

PR #5 adds scoped similar-peer hover. Smooth picking hover UX uses floating `translate3d` boxes + pick flash.

---

## For exploring bots (Grok / QA / architecture)

**Mission:** Verify the free product against [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md) — nested lists + pagination + clean preview — without inventing schedule/cloud/AI scope.

### Business → product claims

| Claim | Must be true |
|-------|----------------|
| Local-only scraper | Rows/recipes stay on device; no upload of scrape data |
| Nested / card lists | Item-relative fields rematch siblings after reload |
| Pagination-friendly | Walk same-origin next HTML; stable merge; abort on Stop |
| Clean editable preview | Rename / drop / reorder; optional row edits; export matches preview |
| Soft free caps | Nudge only (10 recipes / 5 pages); never “create an account” |
| Paid later | Schedule, cloud recipes, accounts — **out of scope** |

### Feature → code map

| Targeted feature | Start here | Tests / fixtures |
|------------------|------------|------------------|
| List / field selectors + peers | `src/shared/selectors.js` | `tests/selectors.test.mjs`, `noisy-bullets.html` |
| Extract rows | `src/shared/extract.js` | `tests/extract.test.mjs` |
| Column rename/drop/reorder | `src/shared/columns.js` | `tests/columns.test.mjs` |
| Preview row edit | `src/shared/rows.js` | `tests/rows.test.mjs` |
| Walk / merge pages | `src/shared/pagination.js` | `tests/pagination.test.mjs`, `demo-page-2.html` |
| Lazy / virtual scroll | `src/shared/lazy-load.js` | `tests/lazy*.test.mjs`, `demo-lazy.html` |
| Hover morph / stick / flash | `src/shared/highlight.js` + `content.js` | `tests/highlight.test.mjs` |
| Export CSV/JSON | `src/shared/export.js` | `tests/export.test.mjs` |
| Recipes + soft nudge + prefs | `src/shared/storage.js` | `tests/storage*.test.mjs` |
| Picker session / groups / Walk UI | `src/content/content.js` | outline / edit / pick-scroll tests |
| Overlay chrome | `src/content/picker-overlay.js` | (handlers only; no recipe mutation) |
| Highlight / overlay CSS | `src/content/highlighter.css` | visual on demo |
| Inject + relay | `src/background/service-worker.js` | no scrape logic |
| Start / Edit / Run / Del | `src/popup/*` | `tests/editable*.test.mjs` |

### Explore checklist

```bash
npm test
python3 -m http.server 8765   # Load unpacked → http://127.0.0.1:8765/demo.html
```

1. **Picker** — Start picking → name Title → click nested title → similar dashed peers on siblings → pick flash → green selected.
2. **Second column** — Price on same cards → one preview table with filled rows.
3. **Walk** — Walk pages → ~10 unique rows from demo page 1+2 (HTTP required).
4. **Preview edit** — Rename / drop / reorder column; export headers match; optional cell edit + Reset from page.
5. **Multi-table** — Click a disjoint list (or outside live items) → new Table N from row 1.
6. **Broader/Narrower** — On price, Broader then Narrower returns to the same price leaf (anchor).
7. **Recipes** — Save → popup Run rematches; Edit → Update same `id`; soft nudge copy never asks for an account.
8. **Privacy** — Grep: no network of scraped rows; SW has no storage/export of scrape payloads.
9. **Out of scope** — Do not treat missing schedule/cloud/AI as MVP bugs.

When reporting: cite **plan claim → observed behavior → file/path → pass/fail**.

---

## Stack

Chrome MV3, **zero-build vanilla JS**. Scripts inject at runtime via the service worker. No React, bundlers, or design-system packages.

## Layout and ownership

| Path | Role | Notes |
|------|------|--------|
| `src/shared/selectors.js` | List/item/field selectors + **similar peers** | Pure-ish DOM helpers on `ClickScrape.selectors` |
| `src/shared/extract.js` | `extractRows(recipe, doc)` | Item-relative fields |
| `src/shared/columns.js` | Rename / drop / reorder / `applyPick` | No DOM re-walk for edit |
| `src/shared/rows.js` | Preview row edit helpers | `updateCell` / `addRow` / `removeRow` / dirty merge |
| `src/shared/pagination.js` | `findNextUrl`, `mergeRows`, `walkPages` | Same-origin GET of next HTML only; optional `beforeExtract` for live-doc settle |
| `src/shared/lazy-load.js` | `scrollToRevealItems`, `revealRecipeItems` | Scroll list scrollport until item count stabilizes (Run / Walk page 1) |
| `src/shared/highlight.js` | Hover stabilize + box geometry | `translate3d` morph, stick pad, overlap resist |
| `src/shared/export.js` | CSV/JSON Blob download | `exportJson(rows, columns\|baseName, baseName?)` |
| `src/shared/storage.js` | Recipes + soft-nudge helpers | Hard cap 50; soft nudge 10 recipes / 5 pages |
| `src/content/content.js` | Picker state, overlay bind, walk, handlers | Owns recipe session; injects Walk button |
| `src/content/picker-overlay.js` | Overlay chrome + preview controls | Does **not** mutate recipe; fires handlers |
| `src/content/highlighter.css` | Hover / selected / **similar** / overlay CSS | Host-isolated overlay (`all: initial`) |
| `src/background/service-worker.js` | Inject + message relay only | No scrape / storage / export logic |
| `src/popup/*` | Start picking + recipe list | Thin; Edit / Run / Del; no full preview |
| `demo.html`, `demo-page-2.html` | Nested cards + pagination fixtures | Serve over HTTP for Walk |
| `demo-lazy.html` | Infinite / scroll-load fixture | Pick-time + Run lazy scroll |
| `tests/**` | Contract tests (`npm test`) | linkedom; do not weaken for old bugs |

## Global namespace

```js
globalThis.ClickScrape = {
  selectors, extract, export, storage, pagination, columns, rows, lazyLoad, highlight, overlay
}
```

Service worker `CONTENT_FILES` order matters — shared modules (including `rows.js`, `highlight.js`) before `picker-overlay.js` before `content.js`.

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

- Hover visuals use a **floating** `#click-scrape-highlight-layer` box (smooth geometry), not outline classes on the host node.
- Geometry uses `transform: translate3d` + width/height (~150ms ease); snap with `cs-no-motion` on first show and scroll/resize.
- `onMouseMove` (rAF) → `highlight.stabilizeHoverTarget` (stick pad ~6px; resist parent + overlapping-sibling thrash) → morph primary box → **debounced** `findSimilarPeers` into a **reused similar-box pool** (opacity fade enter/leave).
- Successful pick flashes a brief `.click-scrape-pick-flash`, then leaves green selected outlines as today.
- Clear hover/similar boxes with hover clear and on stop; resync geometry on scroll/resize.
- Do **not** put scrape logic in CSS; do **not** let similar/highlight classes leak into saved selectors (already filtered).

### Do not

- Match peers with document-absolute `:nth-of-type` paths (those are unique — useless for “similar”).
- Use unqualified site-wide class queries without `getSimilarScopeRoot`.
- Cap peer highlights without a scope (perf + noise).

## Other contracts agents must keep

1. **Item-relative fields:** `relativeSelector` is `:scope` / `:scope …` (or queryable from the item). Never save a document `cssPath` for a field.
2. **`itemSelector`:** CSS under the list root when classes exist (e.g. `article.product`), not tag-only.
3. **`queryItems`:** non-`*` selector → CSS matches only (empty OK). No tag-group fallback on miss.
4. **Columns:** preview/export use `getColumns()` / `columnOrder` + `hiddenColumns` (`visibleColumns`). Drop **true-deletes** the field from `fields` and removes its name from `columnOrder` and `hiddenColumns` (not hide-only). Rename remaps field name + row keys together.
5. **Pagination:** same-origin next HTML only; dedupe by concatenated visible column values; abort on Stop; no row upload. Walk is blocked while any preview table is `rowsDirty`. Before extracting the live page (Walk page 1 / Run), `lazyLoad.revealRecipeItems` scrolls the list scrollport until item count stabilizes (hard round cap; restores scroll position; no-op on `DOMParser` pages).
6. **Soft cap:** UX nudge only (never “create an account”); does not block save/walk.
7. **No** `fetch` of scraped rows/recipes; permissions stay minimal.
8. **List groups (multi-table preview):** each repeating list is a **group** with its own `liveItems` / fields / rows. Optional `groups[].name` (click-to-rename the preview toolbar label); empty → UI shows `Table N`. Names persist on Save/Update and rematch on Edit/Run. JSON multi-export includes `name` when set; CSV stays blank-line separators only (no table-name rows). A **nested** disjoint list under a greedy first pick **replaces** all groups. A **sibling** disjoint list **starts a new group** (own table from row 1). A click **outside every current live item** (e.g. price block → shipping line) also starts a new group — never glue onto the last group (that yields empty cells). Same-list clicks still add columns to that group. Export concatenates groups with a blank CSV separator (JSON array of tables). Saved recipes store a `groups[]` array (legacy top-level `fields` / `rootSelector` remain the first group for Walk).
9. **Dense list peers only:** `findListContext` must not treat page-wide `.celwidget` (or other sparse peers) as rows when the picked field rematches only one of them — fall back to a singleton host (e.g. `#corePrice_desktop`) so Price + Discount% yield one filled row, not a table of blanks.
10. **Preview row edit:** users may edit cells, add rows, and delete rows in the overlay. That sets `rowsDirty` so `refreshGroupRows` will not overwrite edits. **Reset from page** clears dirty and re-scrapes. Recipes never store row payloads — Run always re-scrapes. Export uses the edited `group.rows`.
11. **Unique ids in selectors:** `cssPath` / singleton `itemSelector` must not stop on an `id` that appears more than once in the document (Amazon reuses `#tp-inline-twister-dim-values-container`). Prefer a unique ancestor (e.g. `#inline-twister-expander-content-size_name`) so Run rematches Size, not Color.
12. **Edit saved recipe:** Popup **Edit** (or Run → **Edit recipe**) rematches `groups[]` and enables picking — same click-to-add behavior as Start picking (lists auto-detect). Drop columns with × (last column removes that table). **Update recipe** overwrites the same `recipe.id` (keeps name/`createdAt`); still no row snapshots.
13. **Field nesting adjust:** Broader / Narrower on each field walks the DOM ladder (wrapper ↔ inner text) and rewrites `relativeSelector` via `stepFieldTarget` — no raw CSS/XPath editing. Live outlines + preview update; still item-relative only. While editing a saved recipe, nesting auto-persists. Each field keeps an `anchorRelativeSelector` (the picked leaf) plus in-session `_anchorEl` / `_targetEl` so Broader → Narrower returns along the same branch (e.g. `$19.99`), not a longer sibling like the title or a dual-price wrapper (`$19.99$19.99`). With an anchor, `fieldTargetLadder` uses the **full** item→leaf path via `pathFromTo` (never the shallow ~8 depth cap — that traps Narrower on deep Amazon cards). Do **not** overwrite `anchorRelativeSelector` with the current broader node (`:scope` / card) during Broader or UI refresh. Tests: `tests/selectors.test.mjs` (demo price + `deep-noisy-price.html`).
14. **User prefs (device-local):** `previewRowLimit` (Show rows) is stored in `chrome.storage.local` via `getPrefs` / `setPrefs`.
15. **Lazy scroll load:** infinite/virtual lists are collected via `lazyLoad.scrapeRecipeWhileScrolling` on **Run**, **Walk** (live page 1), and **pick-time** (after adding a column / Reset from page while the picker is active): scroll + merge rows each round until stable (hard round cap; restores scroll). Prefer merge-while-scrolling over scroll-then-extract-once so virtualized nodes are not lost. Pick-time scroll updates preview rows + `liveItems` outlines; aborted on Stop / Walk / a newer pick-scroll. `revealRecipeItems` remains for count-only settle. Parsed Walk pages stay no-op.

## How to verify

```bash
npm test
python3 -m http.server 8765   # then Load unpacked → http://127.0.0.1:8765/demo.html
```

Hover a nested title: sibling cards should show dashed similar outlines. Walk pages needs HTTP (not `file://`).

Packaging: `bash scripts/pack-unpacked.sh` → `click-scrape-unpacked.zip` (extension files only; excludes `tests/`, `node_modules/`, `.superpowers/`).
