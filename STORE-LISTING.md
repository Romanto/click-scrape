# Nestix — Chrome Web Store Listing

## Name
**Nestix**

## Short description (132 characters max)
Point-and-click web scraper. Extract nested lists, multi-page data, export CSV/JSON. All on-device—no cloud, no account required.

## Detailed description

**Nestix** is a visual web scraper that lets you extract structured data from any website without writing code.

### How it works

1. **Click the Nestix icon** to start picking elements on the page.
2. **Type a column name** (e.g., "Title") and click the element you want to extract.
3. **Add more columns** (e.g., "Price", "URL") by repeating the process.
4. **Preview your data** in a live table as you build your scraper.
5. **Export to CSV or JSON** with one click, or save your configuration as a reusable recipe.

### Key features

- **Visual element picker** — Hover and click to select; no CSS selectors or XPath needed.
- **Nested list detection** — Automatically discovers repeating patterns (product cards, search results, table rows).
- **Multi-page support** — Walk through pagination to scrape data across multiple pages.
- **Recipe library** — Save your scraper configurations and reuse them anytime.
- **On-device only** — All data stays on your machine. No uploads, no servers, no account required.

### Perfect for

- **Product research** — Extract pricing, reviews, and specs from e-commerce sites.
- **Lead generation** — Build contact lists from directories and search results.
- **Content monitoring** — Track listings, job postings, or news feeds.
- **Data analysis** — Collect structured data for spreadsheets or databases.

### Privacy & data

Nestix is **completely local**:

- Scraped data never leaves your browser.
- Recipes are saved in local Chrome storage only.
- No sign-up, no tracking, no backend servers.

See the full privacy policy at the link in this listing.

### Getting started

1. Install Nestix from the Chrome Web Store.
2. Visit any web page you want to scrape.
3. Click the Nestix icon in your toolbar.
4. Click "Start picking" and follow the on-screen prompts.
5. Export your results or save a recipe for later.

For demo pages and example recipes, visit the GitHub repository linked in this listing.

### Limitations

This is a free, local-only scraper:

- No cloud runs or scheduled scrapes.
- No proxy rotation, CAPTCHA solving, or login wall handling.
- Selector quality depends on page structure (works best with semantic HTML).

For advanced automation or large-scale projects, consider headless browsers like Playwright or Puppeteer.

### Support

Questions? Feedback? Feature requests?

- **GitHub issues:** https://github.com/romanto/click-scrape/issues
- **Email:** Available via Chrome Web Store listing

---

## Category
**Productivity / Developer Tools**

## Language
**English**

## Privacy policy URL (temporary)
Use GitHub Pages URL once enabled:
`https://romanto.github.io/click-scrape/PRIVACY.html`

Or fallback:
`https://raw.githubusercontent.com/romanto/click-scrape/main/PRIVACY.md`

## Screenshots / promotional images
(Upload separately via Chrome Web Store Developer Dashboard)

Recommended:
- Screenshot 1: Hover highlight during element picking
- Screenshot 2: Preview table with sample data
- Screenshot 3: Recipe library UI
- Screenshot 4: CSV export dialog
- Promotional tile: 1280x800 with Nestix logo and tagline

## Additional notes for Store submission

- Extension is **Manifest V3** compliant.
- Permissions requested: `activeTab`, `scripting`, `storage`, and host permissions for content script injection.
- No remote code execution; no externally hosted scripts.
- No obfuscated code; all source is readable JavaScript.
- No analytics or tracking libraries (e.g., Google Analytics) in the free version.
