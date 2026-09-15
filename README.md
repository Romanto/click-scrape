# Nestix (Click Scrape)

Point-and-click visual web scraper — Chrome MV3 extension. Store name in the manifest is **Nestix**; repo / agent docs still say **Click Scrape**.

Hover elements → name columns → preview rows → export CSV/JSON → save recipes locally. Data never leaves the machine.

| Doc | Audience |
|-----|----------|
| **This README** | Humans + bots: product wedge, feature map, how to load & explore |
| [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md) | Business brief, competitive wedge, MVP build order, non-goals |
| [AGENTS.md](AGENTS.md) | Engineering contracts, file ownership, feature → code map, verify |

---

## Business plan (short)

**Wedge vs Instant Data Scraper:** nested / card lists + pagination-friendly picks + clean editable preview — not “another free auto-detect scraper.”

| Tier | What |
|------|------|
| **Free (shipped MVP + post-MVP polish)** | Local picker, multi-table groups, Walk pages, editable preview, export, local recipes, soft UX caps |
| **Paid later (do not build yet)** | Schedule, cloud recipes, accounts — target ~$29–39/mo |

**Non-goals:** AI describe-to-scrape, proxies, CAPTCHA, login walls, phone-home telemetry, soft-cap server enforcement.

Full brief: [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md).

---

## Targeted features ↔ status

Use this table when exploring: *is it in the plan, is it in the code, where do I look?*

| Feature | Plan | Status | Primary code | Demo / prove |
|---------|------|--------|--------------|--------------|
| Point-and-click picker (hover + click columns) | MVP | Shipped | `src/content/content.js`, `picker-overlay.js` | `demo.html` |
| Nested / card-list extraction (item-relative fields) | MVP | Shipped | `src/shared/selectors.js`, `extract.js` | Nested titles on `demo.html` |
| Scoped similar-peer hover | Post-MVP | Shipped | `selectors.findSimilarPeers`, `highlight.js`, `highlighter.css` | Hover title → dashed peer boxes |
| Smooth hover morph + pick flash | UX polish | Shipped | `highlight.js`, `content.js`, `highlighter.css` | Morph between fields; green flash on pick |
| Multi-page Walk + stable row merge | MVP | Shipped | `pagination.js`, Walk in `content.js` | HTTP `demo.html` → Walk → `demo-page-2.html` |
| Lazy / infinite scroll collect | Post-MVP | Shipped | `lazy-load.js` | `demo-lazy.html`; Amazon-style grids |
| Preview rename / drop / reorder | MVP | Shipped | `columns.js`, overlay | Overlay column controls |
| Preview row edit (cells / add / delete) | Post-MVP | Shipped | `rows.js`, overlay | Edit cell → `rowsDirty`; Reset from page |
| Multi-table list groups | Post-MVP | Shipped | `content.js` groups[] | Sibling / outside-item click → new table |
| Broader / Narrower field nesting | Post-MVP | Shipped | `stepFieldTarget`, anchors in `content.js` | Price: Broader then Narrower returns to price |
| Edit / Update saved recipe | Post-MVP | Shipped | popup + `content.js` | Popup Edit → pick → Update |
| CSV + JSON export (on-device) | MVP | Shipped | `export.js` | Export matches preview columns |
| Local recipes + soft nudge | MVP | Shipped | `storage.js` | Soft nudge @ 10 recipes / 5 pages; hard cap 50 |
| Schedule / cloud / accounts | Paid later | **Out of scope** | — | Do not implement |

Engineering invariants (item-relative fields, no row upload, etc.): [AGENTS.md](AGENTS.md).

---

## Load unpacked

1. Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → this folder (has `manifest.json`)
2. Serve fixtures over HTTP (Walk needs it; `file://` blocks fetches):
   ```bash
   python3 -m http.server 8765
   ```
   Open `http://127.0.0.1:8765/demo.html`
3. Extension icon → **Start picking**
4. Name a column → click a field → preview → optional **Walk pages** → **Export** / **Save recipe**

Esc or **Stop** ends picking. Won’t run on `chrome://` pages.

Zip: `bash scripts/pack-unpacked.sh` → `click-scrape-unpacked.zip`.

---

## Explore like a bot / QA agent

**Goal:** map product claims → UI → code → tests without expanding paid scope.

1. **Orient** — Read this feature table + [CURSOR-MVP-PLAN.md](CURSOR-MVP-PLAN.md) Product / Non-goals. Then [AGENTS.md](AGENTS.md) “Feature → code map.”
2. **Contract tests** — `npm test` (linkedom; do not weaken failing cases for old bugs).
3. **Happy path on demo** — Load unpacked → `demo.html` → Title + Price → similar peers on hover → Walk → Export CSV/JSON → Save recipe → popup Run / Edit.
4. **Stress surfaces** — nested cards (`demo.html`), pagination (`demo-page-2.html`), lazy list (`demo-lazy.html`), Broader/Narrower on price, multi-table (second disjoint list).
5. **Privacy check** — no `fetch` of scraped rows/recipes; SW is inject + relay only (`src/background/service-worker.js`).
6. **Report gaps** — for each targeted feature: works / broken / missing vs plan; cite file + acceptance path.

Fixtures worth knowing: `tests/fixtures/noisy-bullets.html`, `deep-noisy-price.html`, `demo-lazy.html`, `laptop-grid.html`, `quotes-simple.html`.

### Bake-off lessons (2026-09-15)

Live comparison vs Instant Data Scraper 1.7.1 found gaps now closed:

- **Card-grid completeness:** Laptop grids (webscraper.io style) now rematch essentially all cards (~117 on live site). Previously missed ~3 items due to list-detection edge cases. Verified: `tests/bakeoff-regression.test.mjs` + `tests/fixtures/laptop-grid.html`.
- **Truncation:** When display text has ellipsis (`Asus VivoBook...`), extractor now prefers fuller `title` attribute / `aria-label` when available. Verified: title attribute extraction test.
- **Named columns first:** Gentle warning flash when first pick in a group has no column name — encourages "Title" → click instead of junk "Field 1" accumulation. No hard block (tests still pass).
- **Walk pagination:** Multi-page quotes fixture confirms Walk dedupe + merge still works cleanly. Verified: `tests/fixtures/quotes-simple.html` + `quotes-page-2.html`.

**Takeaway:** Name columns before picking (e.g. "Title" then click); Walk pages only after clean picks. Nestix now matches or exceeds IDS on card grids and named-column workflows.

---

## Project layout

```
src/shared/     selectors, extract, columns, rows, pagination, lazy-load, highlight, export, storage
src/content/    picker state, overlay chrome, highlighter CSS
src/popup/      Start picking + recipe list (thin)
src/background/ service worker — inject + message relay only
tests/          contract tests (`npm test`)
demo*.html      local acceptance surfaces
```

Stack: Chrome MV3, **zero-build vanilla JS**. No React, bundlers, or design-system packages.

## Limits (v0)

No cloud runs, scheduling, proxies, CAPTCHA, login walls, or AI describe-to-scrape. Selector quality is best-effort. Soft caps are UX nudges only — they never block save/walk.
