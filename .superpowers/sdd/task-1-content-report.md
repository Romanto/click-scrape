# Task 1e: content.js picker wiring — Report

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-09-07  
**Wave:** 1 sequential (after shared selector APIs)

## Summary

`onClick` now calls `NS.selectors.findListContext(el)` on every pick. First field still locks `state.rootSelector` and `state.itemSelector` from that context. The **item for this click** is the repeating ancestor in the current context that is or contains `el` — not the first-click `sampleItem` / `ctx.items[0]`. `relativeSelector(item, el)` stays item-relative with no `cssPath` fallback. Overlay bind, save recipe, messaging, and export callers are unchanged; `currentRecipe()` already passes through the richer `itemSelector`.

## Files changed

- `/home/c3po/projects/click-scrape/src/content/content.js`

No commit. Did not edit selectors.js, extract.js, export.js, overlay, popup, or demo.html.

## How `onClick` resolves the item

```js
const ctx = NS.selectors.findListContext(el);
if (!state.rootSelector) {
  state.rootSelector = ctx.rootSelector;
  state.itemSelector = ctx.itemSelector;
}
const item = ctx.items.find((i) => i === el || i.contains(el)) || el;
if (!state.sampleItem) state.sampleItem = item;
const rel = NS.selectors.relativeSelector(item, el);
```

- `i === el` covers clicking the card/item node itself (`.contains` is not reflexive).
- Fallback is `el`, never `ctx.items[0]`, so a miss does not snap to the first card.
- `sampleItem` is kept for first-item highlight potential only; it is **not** used to resolve later fields.

## How to verify

Interactive (after Wave 1 overlay/popup land): Load unpacked → `demo.html` → Start picking → name Title, click a title in card 1 → name Price, click a price in a **different** card → preview has consistent Title+Price columns across siblings → save recipe → reload → run recipe rematches.

## Concerns

1. **Not interactively proven.** File lock excluded overlay, popup, and `demo.html`. Live-site / demo picker pass still needed after Wave 1 integration.
2. **First-list lock.** Later clicks still use the first field’s `rootSelector` / `itemSelector`. A pick in a different list on the same page will not retarget the recipe (by design per brief).
3. **Context miss fallback.** If `findListContext` returns items that do not contain `el`, the item is `el` itself (`relativeSelector` → `:scope`), which can flatten a nested field into an item-level column.
4. **`sampleItem` unused for highlight.** Overlay still rings only the clicked node, not the resolved card ancestor.
