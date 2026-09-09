# Click Scrape

Point-and-click visual web scraper (Chrome extension MVP). Hover elements, name columns, preview rows, export CSV/JSON, save recipes locally.

## Load unpacked

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `click-scrape` folder (the one that contains `manifest.json`)
4. Serve the folder over HTTP so **Walk pages** can fetch page 2 (Chrome blocks `file://` fetches):
   `python3 -m http.server 8765` then open `http://127.0.0.1:8765/demo.html`
5. Click the extension icon → **Start picking**
6. Type a column name (e.g. `Title`), click a title on the page
7. Type `Price`, click a price
8. Check the preview table → **Walk pages** (merges `demo-page-2.html`) → **Export CSV** or **Save recipe**

Esc or **Stop** ends picking. Won’t run on `chrome://` pages.

A Load-unpacked zip is `click-scrape-unpacked.zip` (`bash scripts/pack-unpacked.sh`). Unzip and load that folder the same way.

## What’s included

- Manifest V3 extension
- Content-script picker with hover highlight and **scoped similar-peer** outlines
- List/sibling detection (heuristic)
- CSV + JSON export
- Recipe save/load via `chrome.storage.local`
- Local `demo.html` for a safe first try

Agent / architecture notes for contributors: [AGENTS.md](AGENTS.md).

## Limits (v0)

No cloud runs, scheduling, proxies, CAPTCHA, login walls, or AI describe-to-scrape. Selector quality is best-effort.

## Project layout

See `src/` — shared helpers, content picker, popup, background service worker.
