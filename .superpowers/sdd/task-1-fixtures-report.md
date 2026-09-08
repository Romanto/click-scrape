# Task 1b: Demo fixtures — Report

**Status:** Complete  
**Date:** 2026-09-07

## Summary

Shipped local HTML fixtures for nested card picking (Wave 1 step 1) and static pagination (Wave 2 prep). No changes to `src/**`. No commit.

## Files changed

| File | Action |
|------|--------|
| `demo.html` | Updated — nested card markup, instructions, page-1 products, pagination nav |
| `demo-page-2.html` | Created — page-2 products, back nav |

## Nested cards (`demo.html`)

### Structure

- **List root:** `.products`
- **Repeating items:** `article.product` (5 cards)
- **Nested wrappers per card:**
  - `.card-body` → `.card-header` → `.title-wrap` / `.price-wrap`
  - `.meta-wrap` for category
  - `.tags` — inner `<ul>` with `<li>` tag chips (prevents flat child-only selectors)

### Pick targets

| Column | Deepest clickable node | Path from card |
|--------|------------------------|----------------|
| Title | `.title` (inside `.title-wrap`) | `.card-body > .card-header > .title-wrap > .title` |
| Price | `.price` (inside `.price-wrap`) | `.card-body > .card-header > .price-wrap > .price` |

Clicking title/price is **not** a direct child of `.products` or `article.product`.

### Page 1 products (5)

| Title | Price |
|-------|-------|
| Acme Notebook | $12.00 |
| Bright Lamp | $34.50 |
| USB-C Hub | $29.99 |
| Travel Mug | $18.00 |
| Desk Mat | $22.00 |

### Instructions block

Ordered list at top: Load unpacked → Start picking → name Title / Price → click those fields.

## Pagination fixture

### Page 1 (`demo.html`)

- Nav: current `1`, link `2`, `<a rel="next" href="demo-page-2.html">Next</a>`

### Page 2 (`demo-page-2.html`)

- Nav: `‹ Previous` → `demo.html`, numbered `1`, current `2`
- Same card markup pattern as page 1
- **No title+price overlap** with page 1

### Page 2 products (5)

| Title | Price |
|-------|-------|
| Ceramic Planter | $16.75 |
| Noise-Cancel Headphones | $89.00 |
| Mechanical Keyboard | $74.99 |
| Linen Throw Blanket | $41.50 |
| Stainless Water Bottle | $27.25 |

### Notes

- Static HTML only — no pagination JS
- One recipe should work on both pages (identical selectors)

## How to open

From repo root:

```bash
# Option A — file URL in Chrome
google-chrome file:///home/c3po/projects/click-scrape/demo.html

# Option B — simple static server
cd /home/c3po/projects/click-scrape && python3 -m http.server 8080
# then http://localhost:8080/demo.html
```

Extension: Load unpacked → open `demo.html` → Start picking → pick Title/Price on nested nodes → follow Next to page 2 for pagination tests.

## Acceptance checklist

- [x] List root `.products` with `article.product` items
- [x] Nested wrappers around title, price, meta
- [x] Inner `<ul class="tags">` per card
- [x] ≥5 distinct cards per page
- [x] Pick instructions at top of page 1
- [x] `rel="next"` link to `demo-page-2.html`
- [x] Page 2 different products, same markup
- [x] Back/previous nav on page 2
- [x] No `src/**` edits
- [x] No commit

## Concerns / follow-ups

1. **Tag list noise:** `.tags li` may appear as sibling candidates during picking; primary targets remain `.title` and `.price`. Selector hardening (Task 1a) should prefer the user-picked depth.
2. **File vs HTTP:** `file://` works for static fixtures; if the extension restricts local file access, use the HTTP server option above.
3. **Optional third page:** Not required by brief; add `demo-page-3.html` only if multi-hop pagination needs a third acceptance case.
