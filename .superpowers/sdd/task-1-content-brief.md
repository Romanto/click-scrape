# Task 1e: content.js picker wiring

**Wave:** 1 sequential (after shared selector APIs)  
**Goal:** Picker uses the new list-root / per-click item-ancestor walk.

## File lock (write)

- `/home/c3po/projects/click-scrape/src/content/content.js` only

Do not edit selectors.js, extract.js, export.js, overlay, popup, demo.html. Do not commit.

## Required `onClick` behavior

1. Call `NS.selectors.findListContext(el)` on every pick.
2. First field still locks `state.rootSelector` and `state.itemSelector` from that context.
3. Resolve the **item for this click** from the current context: the repeating ancestor that contains `el` (`ctx.items.find(i => i === el || i.contains(el))`). Do **not** force every later field onto first-click `sampleItem` when the click is in a different card.
4. `relativeSelector(item, el)` — shared helpers already refuse absolute cssPath; do not add a cssPath fallback here.
5. Keep overlay bind, save recipe, messaging, export callers unchanged except if `currentRecipe()` must pass through the richer `itemSelector`.
6. You MAY keep `sampleItem` if useful for highlight, but item resolution must be per-click.

Vanilla JS. No fetch. No new files.

## Report

`/home/c3po/projects/click-scrape/.superpowers/sdd/task-1-content-report.md`
