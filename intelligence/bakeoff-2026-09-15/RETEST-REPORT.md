# Bake-off retest report

**Date:** 2026-09-15  
**Tip tested:** local `main` after books Title|Price + laptop `__itemId` dedupe fixes  
**Method:** Node + linkedom against live HTML / fixtures (`npm test` + scripted Walk/extract). Load-unpacked Chrome pass still recommended for UI smoke.

## Results

| Site | Scenario | Result | Notes |
|------|----------|--------|-------|
| books.toscrape.com | Title (via `h3`) + Price → Walk 2 pages | **PASS** | Full titles (no `...`), `£` prices; page1+2 → 40 aligned rows |
| quotes fixtures | Quote+Author Walk 2 pages | **PASS** | 10 unique rows, no dupes (`bakeoff-regression`) |
| webscraper.io laptops | Name+Price extract + scroll-merge | **PASS** | **117 / 117** (was 116 after visible-only dedupe) |

## Automated

```text
npm test → 149 pass
```

## Fixes shipped in this tip

1. **`extractText`** — prefer descendant `a[title]` / `[title]` when own text is empty or ellipsis-truncated (books `h3` pick).
2. **`relativeSelector`** — prefer single `a[title]` leaf under clicked wrapper; avoid ambiguous bare `:scope a` when image+title links coexist.
3. **`mergeRows` / `rowFromItem`** — `__itemId` from product `href` included in dedupe key so distinct products with identical Name|Price stay (laptops 117); export columns still omit `__itemId`.

## Follow-up

- Manual Load-unpacked click-through on the three sites for overlay/Walk UX.
- CWS Unlisted upload after `bash scripts/pack-unpacked.sh` from tip `main`.
