# Privacy Policy — Nestix

**Last updated:** September 8, 2026

This privacy policy applies to the **Nestix** Chrome extension (the "Extension"; repository/scaffold may still say Click Scrape). It covers the local point-and-click scraper: select elements, preview rows, export CSV/JSON, and save recipes on-device.

## Short version

Scraped page data and your recipes stay on your device. We do not operate a backend that receives your scraped rows. We do not sell your data.

## What the Extension does

Nestix lets you select elements on web pages you choose to visit, preview extracted rows, and export them as CSV or JSON. You may save "recipes" (saved selector configurations) for reuse.

## Data the Extension accesses

To work, the Extension may access:

- **The active tab's page content** — only when you start picking or run a saved recipe, so it can highlight elements and extract the fields you selected.
- **Local storage on your browser** (`chrome.storage.local`) — to save recipes and soft usage counters on your machine.
- **Downloads you trigger** — when you export CSV/JSON, the file is created and saved locally by your browser.

Permissions used: `activeTab`, `scripting`, `storage`, and host access so the picker can run on pages you open.

## What we do *not* collect

For the free / local product:

- We do **not** upload scraped rows, preview tables, or recipe contents to our servers.
- We do **not** require an account or login.
- We do **not** sell, rent, or share scraped data with third parties.
- We do **not** use scraped content for advertising.
- We do **not** phone home to enforce free-tier limits (any soft cap is local UX only).

If a future optional feature needs network transfer of recipes or results, that will be clearly disclosed and covered by an updated policy before it ships.

## Data storage and retention

- Recipes and related settings live in your browser's local storage until you delete them or uninstall the Extension.
- Exported CSV/JSON files are ordinary files on your device; we do not control them after export.
- Uninstalling the Extension removes its local extension storage (per Chrome's normal behavior).

## Third parties

The Extension is distributed through the Chrome Web Store. Google's policies and infrastructure apply to Store distribution and any Store analytics Google provides to developers. That is separate from scraped page content, which stays on your device.

## Children's privacy

The Extension is not directed at children under 13. We do not knowingly collect personal information from children.

## Your choices

- Stop picking / close the overlay at any time.
- Delete saved recipes from the Extension UI.
- Uninstall the Extension from `chrome://extensions` to remove local extension data.
- Do not use the Extension on pages you are not allowed to scrape; you are responsible for complying with site terms and applicable law.

## Changes to this policy

We may update this policy as the product changes. The "Last updated" date above will change when we do. Material changes that affect how data leaves your device will be reflected here before those features ship.

## Contact

Questions about this policy: contact the developer via the email listed on the Chrome Web Store listing, or via https://nestix.app once the site is live.

**Hosted policy URL (Store field):** `https://nestix.app/privacy` once the domain is live. Until then, publish this document on GitHub Pages or another stable HTTPS URL and use that temporary address in the Store form.

---

*Until hosted, this file lives in the project as `PRIVACY.md`.*
