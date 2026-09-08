# Click Scrape \u2014 Cursor MVP build instructions

Paste this into Cursor agents as the working brief. Repo/scaffold: `click-scrape` (Chrome MV3, zero-build vanilla JS). Zip for Load unpacked already exists alongside the folder.

---

## Product

**What:** Freemium Chrome MV3 point-and-click visual scraper.

**Free MVP (this plan only):**
- Local-only picker (hover + click to define columns)
- Nested / card-list extraction that stays stable
- Pagination-friendly multi-page picks with stable row merge
- Clean, editable table preview
- CSV + JSON export
- Local recipes (`chrome.storage.local`)
- Soft free recipe/page cap (UX only \u2014 no phone-home)
- Data **never** leaves the machine

**Paid later (explicitly out of MVP):** schedule, cloud recipes, accounts. Target later: ~$29\u201339/mo.

**Wedge vs Instant Data Scraper:** nested lists + pagination-friendly picks + clean preview \u2014 not \u201canother free auto-detect scraper.\u201d

**Distribution:** Chrome Web Store, unlisted first. Product name + Store account still open \u2014 do not block the build.

---

## Non-goals (do not build)

- Competing on auto-detect breadth / AI describe-to-scrape
- Schedule, cloud runs, proxies, CAPTCHA, login walls
- Phone-home telemetry or soft-cap enforcement server-side
- Store listing polish beyond a Load-unpacked zip for unlisted upload
- Renaming / branding work that blocks engineering

---

## Architecture (keep the scaffold)

| Area | Owns | Notes |
|------|------|--------|
| `src/content/` | pick, highlight, pagination walk, overlay UI | `content.js`, `picker-overlay.js`, `highlighter.css` |
| `src/shared/` | pure helpers | `selectors.js`, `extract.js`, `export.js`, `storage.js` \u2014 keep testable, no DOM chrome |
| `src/popup/` | start picking + recipe list | thin; preview/export live primarily on overlay for MVP |
| `src/background/service-worker.js` | messaging only | no scrape logic |
| `demo.html` | local fixture | first acceptance surface |
| `manifest.json` | MV3 | permissions stay minimal: `activeTab`, `scripting`, `storage`, host as needed |

**Data path:** page \u2192 content extract \u2192 in-memory rows \u2192 export / local storage. Never network for scraped data.

**Roles:**
- **Web Design** \u2014 popup + overlay UX (preview polish, column edit affordances, soft-cap copy, visual clarity)
- **Developer** \u2014 selector / pagination / export hardening
- **Software Architect** \u2014 boundaries above; no new layers unless a step forces it

---

## Build order (execute in order)

### 1) Harden nested-list selectors
**Owner:** Developer (Web Design: highlight clarity only)

- Stabilize list/sibling detection for nested and card layouts
- Prove on `demo.html` **and** 2 live card-style sites
- Acceptance: picking a nested field yields consistent columns across siblings; reload of the same page recipe still matches

### 2) Pagination multi-page with stable row merge
**Owner:** Developer

- Walk \u201cnext\u201d / numbered pagination without duplicating or scrambling rows
- Merge pages into one preview table with stable column keys
- Acceptance: multi-page pick stays stable across reload; row count grows predictably; no cross-page column drift

### 3) Preview: rename / drop / reorder columns
**Owner:** Web Design (Developer: wire extract/export to edited column model)

- Editable, clean preview in the overlay (`#cs-preview`)
- Affordance to **rename**, **drop**, and **reorder** columns before export / save recipe
- Show row count; keep first ~10\u201320 rows visible without clutter
- Export CSV/JSON must respect the edited column set and order
- Acceptance: columns look editable/clean; exported files match preview headers and order

### 4) Soft free recipe/page cap + Load-unpacked zip
**Owner:** Web Design (copy/UX) + Developer (local counter)

- Soft cap only (local counter / gentle nudge) \u2014 **no** phone-home
- Package/refresh zip for Load unpacked / unlisted Store
- Acceptance: hitting the soft cap shows clear local UX; recipes still work under the cap; zip loads cleanly in Chrome

---

## UX brief (Web Design) \u2014 Cursor-ready detail

Current overlay (`picker-overlay.js`) already has: column name input, field list, undo, export CSV/JSON, save recipe, stop, basic HTML table preview.

**MVP UX gaps to close in step 3\u20134:**

1. **Preview table**
   - Column headers clickable/editable (rename inline or small edit control)
   - Drop column (remove without killing the whole recipe)
   - Reorder (drag handle or up/down) \u2014 keep interaction simple in vanilla JS
   - Empty / error states: no columns yet, no rows matched, pagination in progress

2. **Field list (`#cs-fields`)**
   - Human-readable column name primary; selector secondary/collapsed
   - Undo remains; optional remove-one-field control aligned with drop-column

3. **Overlay chrome**
   - Keep compact so it doesn\u2019t block the page under pick
   - Clear picking vs idle states; Esc / Stop always obvious
   - Soft-cap message: calm, local, never \u201caccount required\u201d

4. **Popup (`popup.html`)**
   - Stay thin: Start picking + saved recipes (load / delete)
   - Do not duplicate full preview in popup for MVP unless overlay can\u2019t hold it

5. **Visual quality bar**
   - Readable contrast on arbitrary host pages (overlay must not inherit broken host CSS)
   - Highlight rings remain obvious on light and dark pages (`highlighter.css`)

**Do not** introduce a design-system package, React, or build step in MVP. Stay vanilla JS + CSS in the existing files.

---

## Acceptance checklist (done when)

- [ ] Nested + multi-page picks stay stable across reload
- [ ] Preview columns are rename / drop / reorder capable and look clean
- [ ] CSV + JSON export is 100% on-device and matches preview
- [ ] Recipes survive browser restart (`chrome.storage.local`)
- [ ] Soft recipe/page cap is UX-only (local)
- [ ] Load-unpacked zip works on a clean Chrome profile
- [ ] No scraped data leaves the machine

---

## How to run locally

1. Chrome \u2192 `chrome://extensions` \u2192 Developer mode \u2192 Load unpacked \u2192 select `click-scrape` (folder with `manifest.json`)
2. Open `demo.html` from the folder
3. Extension icon \u2192 **Start picking**
4. Name a column \u2192 click matching elements \u2192 preview \u2192 Export / Save recipe
5. Esc or **Stop** ends picking (won\u2019t run on `chrome://` pages)

---

## Open items (do not block)

- Final product name
- Chrome Web Store account / unlisted listing copy
- Exact soft-cap numbers (recipe count / pages) \u2014 pick sensible defaults if unset (e.g. soft nudge after N recipes or M pages)

---

## Suggested Cursor agent split

| Agent focus | Files | Steps |
|-------------|-------|-------|
| Selectors + pagination | `src/shared/selectors.js`, `extract.js`, `src/content/content.js` | 1\u20132 |
| Preview + overlay UX | `picker-overlay.js`, `highlighter.css`, overlay styles in content CSS | 3 |
| Popup + soft cap + zip | `popup/*`, `storage.js`, packaging | 4 |
| Export contract | `export.js` + callers | 3 (must honor edited columns) |

When implementing: prefer small PRs/commits per build-order step; prove each step on `demo.html` before live sites.

---

## Architecture contracts (Software Architect) \u2014 do not break

Paste this section with the brief when Cursor agents touch data shapes or messaging.

### Recipe schema (`chrome.storage.local` key `clickScrapeRecipes`)

```js
{
  id: string,              // crypto.randomUUID()
  name: string,
  createdAt: number,       // Date.now()
  pageUrl: string,         // location.href at save
  rootSelector: string,    // list root (cssPath)
  itemSelector: string,    // item tag / selector under root
  fields: Array<{
    name: string,          // column key in preview + export
    relativeSelector: string  // path from item \u2192 field (:scope ok)
  }>
  // Step 3 may add optional: columnOrder?: string[], hiddenColumns?: string[]
  // Prefer deriving export columns from an explicit ordered list of field names
  // so rename/drop/reorder does not require rewriting relativeSelector.
}
```

Hard cap already in `storage.saveRecipe`: keep at most **50** recipes in the array. Soft free-tier nudge (step 4) is separate UX on top of this.

### Row / column model

- Each row is `Record<fieldName, string>`.
- `export.exportCsv(rows, columns)` / preview take **ordered** `columns: string[]` \u2014 that order is the contract for step 3 (rename = change `fields[].name` + keys; drop/reorder = change `columns` / field list, not the DOM walk).
- `export.exportJson(rows)` currently dumps row objects; after step 3 it must emit objects with only visible columns in preview order (or an array-of-arrays + header \u2014 pick one and keep CSV/JSON consistent).

### Messaging (keep thin)

| Type | Direction | Purpose |
|------|-----------|---------|
| `CLICK_SCRAPE_INJECT` | popup \u2192 SW | inject scripts + CSS, then start |
| `CLICK_SCRAPE_START` | SW \u2192 content | start picker |
| `CLICK_SCRAPE_STOP` | \u2192 content | stop picker |
| `CLICK_SCRAPE_RUN_ON_TAB` | popup \u2192 SW | inject + run saved recipe |
| `CLICK_SCRAPE_RUN_RECIPE` | SW \u2192 content | `{ recipe }` extract + preview |
| `CLICK_SCRAPE_TOGGLE` | \u2192 content | toggle (optional) |

**Do not** put scrape logic, storage writes, or export in the service worker. SW = inject + relay only.

### Invariants for every PR

1. No `fetch` / XHR / remote logging of scraped rows or recipes.
2. No new frameworks, bundlers, or design-system packages \u2014 vanilla JS + existing files.
3. `shared/*` stays DOM-chrome-free where possible (`export` may use `document` for download links; keep that isolated).
4. Permissions stay minimal: `activeTab`, `scripting`, `storage` (+ host as already declared). Do not add identity / cookies / webRequest for MVP.
5. Prove each build-order step on `demo.html` before live sites.
6. Prefer small commits per step (1 \u2192 2 \u2192 3 \u2192 4); do not start step N+1 until step N acceptance passes.

### Suggested defaults if unset

- Soft nudge: after **10** saved recipes or **5** pages in one multi-page run (local counters only).
- Preview: show first **20** rows; full set still exports.

---

## Developer notes (selector / pagination / export) \u2014 implement steps 1\u20132 first

Owner: Developer. Do not start step 3 until 1\u20132 acceptance passes on `demo.html`.

### Step 1 \u2014 nested-list selectors (`src/shared/selectors.js`, `extract.js`, `content.js`)

- Prefer **item-relative** paths (`:scope \u2026`) from a detected list root; avoid absolute `cssPath` that breaks when ads/chrome shift.
- Nested/card layouts: detect repeating item containers (same tag + similar class/structure siblings), then resolve each field relative to the item \u2014 not the page.
- When the user clicks a deep node (e.g. title inside a card), walk up to the repeating item ancestor before generating `relativeSelector`.
- Acceptance fixtures: `demo.html` plus **2 live card-style sites** (e.g. a product grid and a results/cards list). Same recipe after reload must rematch the same columns.
- Add/extend pure unit-style checks in `shared/` where possible (selector generation + extract given a fixture DOM string or jsdom-free helpers); prove interactively on `demo.html` either way.

### Step 2 \u2014 pagination + row merge (`content.js` + shared extract)

- Support common \u201cnext\u201d patterns: `<a rel="next">`, link/button text \u2248 Next / \u203a / \u2192, and simple numbered page links \u2014 best-effort, no site-specific plugins in MVP.
- Walk pages sequentially; **dedupe** rows with a stable key (concat of visible column values or item identity) so Next-back doesn\u2019t duplicate.
- Merge into one in-memory row list with **stable column keys** from step 1 field names \u2014 no cross-page header drift.
- Soft page counter (for step 4 nudge) increments locally per multi-page run; scraping must still work offline with no network beyond loading the host pages the user already opened/navigated.
- Acceptance: row count grows predictably across N pages; reload + re-run recipe does not scramble columns.

### Export contract (step 3 wiring \u2014 touch early if needed)

- `exportCsv(rows, columns)` / JSON must take an **ordered** `columns: string[]` matching preview.
- After rename/drop/reorder: CSV headers and JSON keys follow preview order; dropped columns omitted; no DOM re-walk required for reorder/drop.
- Keep export 100% on-device (`Blob` + download link). No `fetch` of row data.

### Out of scope for Developer in MVP

Schedule, cloud, accounts, bundlers, new permissions, phone-home soft-cap enforcement.

---

## Research appendix (competitive / acceptance context)

Use this so Cursor agents understand *why* the MVP cut exists. Do not expand scope from this section.

### Competitor landscape (as of 2026-09)

| Tool | Role | Notes |
|------|------|--------|
| Instant Data Scraper | Primary free rival | ~1M Chrome installs, ~4.9 / 7k+ ratings; free local CSV/Excel; data stays in-browser. **No longer maintained** by original developer (Web Robots). Guides call out fragile pagination and no scheduling. |
| Web Scraper (webscraper.io) | Free local + paid cloud | Powerful sitemap model; steep learning curve for beginners. Cloud from ~$50/mo (Project, annual billing). |
| Simplescraper | Paid entry | Cloud/schedule plans from ~$39/mo. |
| Octoparse | Desktop + cloud | Paid from ~$69/mo. |
| ParseHub | Visual desktop | Free very limited; Standard ~$189/mo includes scheduling \u2014 too expensive as a comparison target for our paid tier. |

### What users bounce on (Store guides + Reddit pass)

Failures that matter for free MVP (in priority order):

1. Multi-page / pagination breaks
2. Nested / card lists inconsistent across siblings
3. Messy auto-detect columns / dirty preview

**Not** the free-MVP pain: \u201cI need a scheduler.\u201d Schedule shows up when users outgrow free and look at cloud tools \u2014 that is the **paid** wedge ($29\u201339/mo for schedule + cloud recipes later).

### Implications for implementers

- Optimize for **picker reliability + clean editable preview**, not broader auto-detect AI.
- Do not implement schedule/cloud \u201cjust in case\u201d \u2014 it dilutes the free wedge and is priced later under Simplescraper / Web Scraper Cloud.
- Soft recipe/page cap exists to leave headroom for paid recipes/cloud later; keep it local UX only.
- Live-site acceptance (steps 1\u20132) should prefer card grids and paginated result lists \u2014 the failure modes Instant Data Scraper users cite.

### Sources (for re-check, not for product claims in UI)

- Chrome Web Store: Instant Data Scraper listing (~1M users, 4.9 rating)
- PromptCloud / Byteful 2026 guides: Instant Data Scraper unmaintained; pagination fragile
- PulseSignal ParseHub pricing (verified ~Aug 2026): Standard $189/mo
- webscraper.io/pricing: Cloud Project ~$50/mo annual
- ColdIQ Simplescraper: paid from ~$39/mo
- Internal Side Project + Reddit pass (Redit): schedule \u2260 free bounce reason


---

## Web Design notes (overlay / popup / soft-cap UX) \u2014 steps 3\u20134

Owner: Web Design. Start after Developer steps 1\u20132 pass on `demo.html`. Honor Architecture contracts (row/column model, soft-cap defaults, no new frameworks).

### Step 3 \u2014 preview column edit (`picker-overlay.js` + highlight/overlay CSS)

- Drive rename / drop / reorder off ordered `columns: string[]` (+ optional `columnOrder` / `hiddenColumns` on recipe) \u2014 do **not** re-walk the DOM to reorder or drop.
- Rename updates `fields[].name` and row keys together; preview headers stay the editable source of truth.
- Show first **20** rows in `#cs-preview`; full set still exports.
- Empty states: no columns yet / no rows / pagination in progress \u2014 short, non-blocking copy in the overlay.
- Keep overlay compact and host-CSS-isolated; highlight rings readable on light and dark pages.

### Step 4 \u2014 soft cap + popup + zip

- Soft nudge after **10** saved recipes or **5** pages in one multi-page run (local counters only). Copy stays calm and local \u2014 never \u201ccreate an account\u201d / phone-home.
- Hard array cap of **50** recipes (already in storage) is separate; soft nudge is UX on top.
- Popup stays thin: Start picking + recipe list (load / delete). Full preview stays on the overlay.
- Refresh Load-unpacked zip when step 4 ships; no Store listing polish required for MVP.

### Out of scope for Web Design in MVP

Design-system packages, React/build tooling, Store branding/name work that blocks engineering, paid/schedule UI.
