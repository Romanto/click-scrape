# Chrome Web Store Listing — Nestix

This document contains the listing content for submitting Nestix to the Chrome Web Store.

---

## Extension Name
**Nestix — Point & Click Web Scraper**

---

## Short Description
*(132 characters maximum)*

Point-and-click scraper for nested lists and multi-page tables. Preview, edit columns, export CSV/JSON — all on your device.

---

## Detailed Description

Nestix is a visual point-and-click web scraper that makes it easy to extract structured data from websites — no coding required.

**Key Features:**
- **Visual Point-and-Click** — Hover over elements, click to define fields, and watch Nestix detect nested card lists and sibling patterns automatically
- **Pagination Support** — Walk through multiple pages and merge results into a single dataset
- **Clean Editable Preview** — Review extracted data in an editable table before exporting
- **CSV/JSON Export** — Export your data locally to CSV or JSON files
- **Local Recipes** — Save extraction patterns ("recipes") for reuse on the same site — all stored locally on your device
- **On-Device Processing** — All data stays on your device; no uploads, no account required

**Best For:**
- Product grids and catalog pages
- Paginated search results and tables
- Nested lists (e.g., job listings, articles, property listings)
- Any repeating card or row structure

**How It Works:**
1. Click the Nestix icon on the page you want to scrape
2. Type a column name (e.g., "Title"), then click an element on the page
3. Add more columns (e.g., "Price", "Link") by clicking additional elements
4. Preview the extracted rows in the table
5. Walk pages if your data spans multiple pages
6. Edit column headers or values as needed
7. Export to CSV or JSON, or save the recipe for next time

**Privacy & Security:**
- All scraped data and recipes stay on your device
- No data uploads, no tracking, no account required
- Works entirely offline after page load
- See our privacy policy for full details

**Limitations:**
- Requires manual field selection (no AI "describe what you want" mode)
- Best-effort selector quality; complex sites may require retries
- No cloud scheduling, proxies, CAPTCHA solving, or login automation

---

## Single Purpose Description
*(150 characters maximum)*

Extract structured data from web pages the user selects, using point-and-click field picking, on-device preview, and local CSV/JSON export.

---

## Category
**Productivity**

---

## Language
**English**

---

## Privacy Practices

### What data does this extension access?
- **Page content** — when the user is actively picking fields or running a recipe

### How is data used?
- **Local storage only** — recipes are stored in `chrome.storage.local`
- **No remote uploads** — all scraped data remains on the user's device
- **No data sales** — we do not sell user data to third parties
- **No advertising** — we do not use user data for advertising purposes

### Does the extension use remote code?
**No** — all code is bundled with the extension; no remote code loading

### Privacy Policy URL
**Temporary (GitHub Pages):**  
https://romanto.github.io/click-scrape/PRIVACY.html

**Permanent (when live):**  
https://nestix.app/privacy

---

## Permissions Justification

### `activeTab`
**Justification:** Required to access the DOM of the web page the user is currently viewing when they activate the picker or run a recipe. This is the core functionality of the extension — we need to read page content to extract data.

### `scripting`
**Justification:** Required to inject the content script (picker UI and extraction logic) into the active tab. Without this, we cannot provide the visual point-and-click interface.

### `storage`
**Justification:** Required to save user-created recipes locally in `chrome.storage.local` so they can be reused. Recipes contain selector patterns and column names defined by the user.

### `host_permissions` (optional host patterns)
**Justification:** Allows users to grant the extension access to specific domains where they want to run saved recipes. This is optional and requested only for domains the user explicitly wants to scrape.

---

## Screenshots

*(Brief descriptions for content creation — actual pixel-perfect images to be created separately)*

### 1. Hero Screenshot (1280×800)
**Caption:** Point and click to extract nested lists  
**Content:** Show the Nestix picker interface hovering over a card list (e.g., product grid), with a few columns defined and the hover highlight visible. Popup UI on the right showing column names.

### 2. Pagination Screenshot (1280×800)
**Caption:** Walk pages and merge results  
**Content:** Preview table with rows from multiple pages, "Walk pages" button highlighted, showing merged data from page 1 and page 2.

### 3. Preview & Export Screenshot (1280×800)
**Caption:** Edit and export to CSV or JSON  
**Content:** Editable preview table with clean data, "Export CSV" and "Export JSON" buttons visible. Show a couple of editable cells with cursor.

### 4. Small Promo Tile (440×280)
**Caption:** Nestix — Point & Click Scraper  
**Content:** Simple, clean branding tile with the extension name and tagline: "Extract data visually. No code required."

**Note:** Screenshots should NOT show scheduling, cloud features, or pricing information.

---

## Visibility
**Unlisted** (initially)

Rationale: Start unlisted for initial review and testing. Switch to Public after Chrome Web Store approval and any early feedback is incorporated.

---

## Developer Contact
*(To be filled in by developer when submitting)*

- Developer email: [Your email]
- Support URL: https://nestix.app (when live)
- Homepage URL: https://nestix.app (when live)

---

## Notes for Submission

1. **Privacy URL:** Use the temporary GitHub Pages URL (`https://romanto.github.io/click-scrape/privacy.html`) until `nestix.app/privacy` is live. Update in the Store listing once the permanent domain is active.

2. **Screenshots:** Create pixel-perfect 1280×800 and 440×280 images based on the descriptions above. Use the actual extension interface with realistic data.

3. **Test Build:** Submit the production build (not unpacked dev build). Ensure `manifest.json` has the correct version number and all required fields.

4. **Review Process:** Chrome Web Store reviews typically take 1-3 business days. Be prepared to respond to reviewer questions or requests for changes.

5. **Updates:** After approval, any updates to the extension or listing content will require re-review.
