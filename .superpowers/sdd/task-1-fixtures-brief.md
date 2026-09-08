# Task 1b: Demo fixtures

**Wave:** 1 (parallel)  
**Goal:** Local HTML fixtures for nested cards (step 1) and pagination (step 2).

## File lock (write)

- `/home/c3po/projects/click-scrape/demo.html`
- new files next to it: `demo-page-2.html` (and extra files if needed)

Do **not** edit `src/**`. Do **not** commit.

## Nested cards (`demo.html`)

Keep a loadable product-grid demo. Add **nested** structure so a click on a deep node (e.g. title inside a card) is not a direct child of the list root:

- A list root (e.g. `.products`)
- Repeating card items with a shared class (e.g. `article.product`)
- Inside each card: nested wrappers around `.title`, `.price`, and optionally `.meta`
- At least 5 cards with distinct titles/prices
- Short instructions at the top: Load unpacked → Start picking → name Title / Price → click those fields

Also include at least one **nested list inside a card** or a second inner repeating block so selectors cannot cheat with a single flat child query — e.g. a small `<ul class="tags">` of tags inside each card, plus the main title/price. Title/price remain the primary pick targets.

## Pagination fixture (for Wave 2, ship now)

Two static pages that look like a results list:

- `demo.html` (or `demo-page-1.html` linked from `demo.html`) shows page 1 with a **Next** control: `<a rel="next" href="demo-page-2.html">Next</a>`
- `demo-page-2.html` shows a **different** set of products (no overlap of title+price with page 1) and a numbered page link back to page 1
- Same card markup pattern as the nested cards so one recipe can run on both pages
- Optional: a “‹ Previous” / numbered “1 2” nav

Do not implement pagination JS. HTML only.

## Report

Write `/home/c3po/projects/click-scrape/.superpowers/sdd/task-1-fixtures-report.md`
