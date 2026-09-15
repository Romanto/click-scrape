# Nestix load-unpacked retest — PR #15 / `64ca844`

Date: 2026-09-15  
Extension: Nestix load-unpacked from `/workspace/nestix-retest/unpacked`  
Manifest version: `0.1.0`  
Setup: Developer mode enabled; old Nestix/Click Scrape entries removed; unpacked Nestix loaded without a visible load error.

## Scoreboard

| Site | Named preview | Data/selection | Walk / pagination | Completeness | Overall |
|---|---|---|---|---|---|
| A — books.toscrape.com | **PARTIAL** — `Title`, `Price` headers appeared, but extracted values were wrong in the retest | **FAIL/PARTIAL** — title/price values did not correspond reliably to the clicked book fields | **PASS** — Walk advanced across 20 pages and produced 400 rows | N/A | **PARTIAL/FAIL** |
| B — quotes.toscrape.com | **PASS** — exactly `Quote`, `Author` (no junk columns in the verified Nestix export) | **PASS** — sample quote and author values were correct | **PASS** — 10 pages, 100 quotes | **PASS** — expected ~100 rows | **PASS** |
| C — webscraper.io laptops | **PASS** — exactly `Name`, `Price` | **PASS** — sample `Asus VivoBook X441NA-GA190`, `$295.99`; exported names contain no `...` truncation | **N/A** — single grid test | **PARTIAL** — 116 rows vs page badge of 117 items (one missing) | **PARTIAL** |

## Site details

### Site A — books
- Columns were named before picking: `Title`, then `Price`.
- Walk worked mechanically: 20 pages / 400 rows.
- Residual bug: the resulting Title and Price values were incorrect despite pagination advancing. This is the primary Cursor follow-up.

### Site B — quotes
- Columns were named before picking: `Quote`, then `Author`.
- Preview/export headers were exactly `Quote,Author`.
- Walk reached all 10 pages and returned 100 rows.
- Sample: `“The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.”` | `Albert Einstein`.

### Site C — laptops
- Columns were named before picking: `Name`, then `Price`.
- Nestix UI reported 116 rows; CSV contains 116 data records plus the header.
- Sample rows: `Asus VivoBook X441NA-GA190,$295.99`; `Prestigio SmartBook 133S Dark Grey,$299`; `Prestigio SmartBook 133S Gold,$299`.
- Exported Name values were full strings; no Name values contained `...` (including the first Asus title). The card display itself is visually ellipsized, but extraction correctly used the full title.
- The site badge says 117 items, so grid matching is short by one row: mark partial.

## Residual issues for Cursor

1. **Books field extraction:** clicked Title/Price selection can produce unrelated/incorrect values even while Walk succeeds.
2. **Laptop grid completeness:** Nestix matched 116/117 laptop cards (one short); investigate selector peer matching.
3. **Laptop truncation:** fixed/verified for this run; exported titles were full despite visual ellipses.

Evidence files in this directory:
- `site-c-name-price-preview.webp`
- `site-c-name-price.csv`
