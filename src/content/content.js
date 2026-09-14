(() => {
  const BOOT = "smooth-hover-v1";
  if (globalThis.__clickScrapeBoot === BOOT) {
    return;
  }
  try {
    globalThis.__clickScrapeTeardown?.();
  } catch {
    /* previous session may already be gone */
  }
  globalThis.__clickScrapeBoot = BOOT;
  globalThis.__clickScrapeLoaded = true;

  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  /** @typedef {{ name?: string, rootSelector: string, itemSelector: string, fields: {name:string,relativeSelector:string}[], sampleItem: Element|null, liveItems: Element[], rows: object[], columnOrder: string[], hiddenColumns: string[], rowsDirty: boolean }} ListGroup */

  const SIMILAR_DEBOUNCE_MS = 70;
  const PICK_FLASH_MS = 180;

  let state = {
    active: false,
    hoverEl: null,
    walked: false,
    walking: false,
    /** @type {ListGroup[]} */
    groups: [],
  };

  let walkController = null;
  let walkGeneration = 0;
  /** @type {AbortController | null} */
  let pickScrollController = null;
  let pickScrollGeneration = 0;
  /** @type {Element[]} */
  let similarHintNodes = [];
  /** @type {HTMLElement[]} */
  let similarBoxes = [];
  /** @type {Element[]} */
  let retrievedItemNodes = [];
  /** @type {Map<string, Set<Element>>} key = `${groupIndex}::${fieldName}` */
  let selectedByField = new Map();
  /** @type {string | null} */
  let editingRecipeId = null;
  /** @type {{ name?: string, createdAt?: number } | null} */
  let editingRecipeMeta = null;
  let recipePersistTimer = null;
  /** @type {HTMLElement | null} */
  let highlightLayer = null;
  /** @type {HTMLElement | null} */
  let hoverBox = null;
  let hoverBoxShown = false;
  let hoverRaf = 0;
  /** @type {{ x: number, y: number } | null} */
  let pendingHoverPoint = null;
  let similarTimer = 0;

  function fieldKey(groupIndex, name) {
    return `${groupIndex}::${name}`;
  }

  function isOverlay(el) {
    return !!(el && (el.id === "click-scrape-overlay" || el.closest?.("#click-scrape-overlay")));
  }

  function isOverlayEvent(e) {
    if (isOverlay(e?.target)) return true;
    const path = typeof e?.composedPath === "function" ? e.composedPath() : [];
    if (path.some((n) => n && n.id === "click-scrape-overlay")) return true;
    const target = e?.target;
    return target instanceof Element && !target.isConnected;
  }

  function clearSimilarHints() {
    if (similarTimer) {
      clearTimeout(similarTimer);
      similarTimer = 0;
    }
    similarHintNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-similar");
    });
    similarHintNodes = [];
    for (const box of similarBoxes) {
      box?.remove?.();
    }
    similarBoxes = [];
  }

  /** Fade peer boxes out but keep the pool for reuse on the next settle. */
  function fadeSimilarHints() {
    if (similarTimer) {
      clearTimeout(similarTimer);
      similarTimer = 0;
    }
    similarHintNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-similar");
    });
    similarHintNodes = [];
    for (const box of similarBoxes) {
      box?.classList?.add?.("cs-peer-hidden");
    }
  }

  function ensureSimilarBox(index) {
    const layer = ensureHighlightLayer();
    while (similarBoxes.length <= index) {
      const box = document.createElement("div");
      box.className = "click-scrape-similar-box cs-peer-hidden";
      box.hidden = true;
      layer.appendChild(box);
      similarBoxes.push(box);
    }
    return similarBoxes[index];
  }

  function flashPickConfirm(el) {
    if (!(el instanceof Element)) return;
    const layer = ensureHighlightLayer();
    const hl = NS.highlight;
    const style = hl?.boxStyleFromRect?.(el.getBoundingClientRect(), 3);
    if (!style || !hl?.applyBoxStyle) return;
    const flash = document.createElement("div");
    flash.className = "click-scrape-pick-flash cs-no-motion";
    hl.applyBoxStyle(flash, style, { animate: false });
    layer.appendChild(flash);
    const raf = globalThis.requestAnimationFrame;
    const startFade = () => {
      flash.classList.remove("cs-no-motion");
      flash.classList.add("cs-flash-out");
    };
    if (typeof raf === "function") raf.call(globalThis, () => raf.call(globalThis, startFade));
    else startFade();
    setTimeout(() => flash.remove(), PICK_FLASH_MS + 40);
  }

  function clearRetrievedItems() {
    retrievedItemNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-item");
    });
    retrievedItemNodes = [];
  }

  function ensureHighlightLayer() {
    if (highlightLayer?.isConnected && hoverBox?.isConnected) return highlightLayer;
    highlightLayer = document.getElementById("click-scrape-highlight-layer");
    if (!highlightLayer) {
      highlightLayer = document.createElement("div");
      highlightLayer.id = "click-scrape-highlight-layer";
      document.documentElement.appendChild(highlightLayer);
    }
    hoverBox = highlightLayer.querySelector(".click-scrape-hover-box");
    if (!hoverBox) {
      hoverBox = document.createElement("div");
      hoverBox.className = "click-scrape-hover-box";
      hoverBox.hidden = true;
      highlightLayer.appendChild(hoverBox);
    }
    return highlightLayer;
  }

  function removeHighlightLayer() {
    clearSimilarHints();
    hoverBoxShown = false;
    hoverBox = null;
    highlightLayer?.remove?.();
    highlightLayer = null;
    document.getElementById("click-scrape-highlight-layer")?.remove?.();
  }

  function placeHoverBox(el, animate) {
    if (!(el instanceof Element)) return;
    ensureHighlightLayer();
    const hl = NS.highlight;
    const style = hl?.boxStyleFromRect?.(el.getBoundingClientRect(), 2);
    if (!style || !hoverBox) return;
    const useMotion = animate && hoverBoxShown;
    hl.applyBoxStyle(hoverBox, style, { animate: useMotion });
    hoverBoxShown = true;
  }

  function hideHoverBox() {
    if (hoverBox) {
      hoverBox.hidden = true;
      hoverBox.classList?.add?.("cs-no-motion");
    }
    hoverBoxShown = false;
  }

  function syncHighlightGeometry(animate) {
    if (!state.hoverEl?.isConnected) return;
    placeHoverBox(state.hoverEl, animate);
    if (!similarHintNodes.length || !similarBoxes.length) return;
    const hl = NS.highlight;
    for (let i = 0; i < similarHintNodes.length; i += 1) {
      const node = similarHintNodes[i];
      const box = similarBoxes[i];
      if (!node?.isConnected || !box || box.hidden) continue;
      const style = hl?.boxStyleFromRect?.(node.getBoundingClientRect(), 1);
      if (style) hl.applyBoxStyle(box, style, { animate: false });
    }
  }

  function scheduleSimilarHints(el) {
    if (similarTimer) clearTimeout(similarTimer);
    similarTimer = setTimeout(() => {
      similarTimer = 0;
      if (!state.active || state.hoverEl !== el) return;
      applySimilarHints(NS.selectors.findSimilarPeers?.(el) || []);
    }, SIMILAR_DEBOUNCE_MS);
  }

  function onViewportChange() {
    if (!state.active || !state.hoverEl) return;
    syncHighlightGeometry(false);
  }

  function createGroup(ctx) {
    return {
      name: "",
      rootSelector: ctx?.rootSelector || "",
      itemSelector: ctx?.itemSelector || "*",
      fields: [],
      sampleItem: null,
      liveItems: (ctx?.items || []).filter((n) => n?.nodeType === 1),
      rows: [],
      columnOrder: [],
      hiddenColumns: [],
      rowsDirty: false,
    };
  }

  function allLiveItems() {
    const out = [];
    for (const g of state.groups) {
      for (const n of g.liveItems || []) {
        if (n?.isConnected) out.push(n);
      }
    }
    return out;
  }

  function outlineItemsForGroup(group) {
    if (!group) return [];
    const live = (group.liveItems || []).filter((n) => n?.isConnected);
    if (live.length) return live;
    if (!group.rootSelector) return [];
    try {
      const root = document.querySelector(group.rootSelector);
      if (!root) return [];
      return NS.selectors.queryItems?.(root, group.itemSelector) || [];
    } catch {
      return [];
    }
  }

  function markFieldSelected(groupIndex, name, el) {
    if (!(el instanceof Element) || !name || groupIndex == null) return;
    el.classList.add("click-scrape-selected");
    const key = fieldKey(groupIndex, name);
    if (!selectedByField.has(key)) selectedByField.set(key, new Set());
    selectedByField.get(key).add(el);
  }

  function clearFieldOutlines(groupIndex, name, relativeSelector) {
    const key = name != null && groupIndex != null ? fieldKey(groupIndex, name) : null;
    const tracked = key ? selectedByField.get(key) : null;
    if (tracked) {
      tracked.forEach((node) => node?.classList?.remove("click-scrape-selected"));
      selectedByField.delete(key);
    }
    if (!relativeSelector || groupIndex == null) return;
    const group = state.groups[groupIndex];
    for (const item of outlineItemsForGroup(group)) {
      let fieldEl = null;
      try {
        fieldEl = NS.extract.queryField?.(item, relativeSelector);
      } catch {
        fieldEl = null;
      }
      if (fieldEl) fieldEl.classList.remove("click-scrape-selected");
    }
  }

  function highlightRetrievedItems(items) {
    clearRetrievedItems();
    for (const el of items || []) {
      if (!(el instanceof Element)) continue;
      el.classList.add("click-scrape-item");
      retrievedItemNodes.push(el);
    }
  }

  function scheduleHoverFrame(cb) {
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf === "function") return raf.call(globalThis, cb);
    cb();
    return 0;
  }

  function cancelHoverFrame(id) {
    const caf = globalThis.cancelAnimationFrame;
    if (typeof caf === "function") {
      caf.call(globalThis, id);
      return;
    }
    if (id) clearTimeout(id);
  }

  function applySimilarHints(peers) {
    similarHintNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-similar");
    });
    similarHintNodes = [];

    const filtered = [];
    for (const el of peers || []) {
      if (!(el instanceof Element) || el === state.hoverEl) continue;
      if (el.classList.contains("click-scrape-item")) continue;
      filtered.push(el);
    }

    const hl = NS.highlight;
    ensureHighlightLayer();
    for (let i = 0; i < filtered.length; i += 1) {
      const el = filtered[i];
      similarHintNodes.push(el);
      const box = ensureSimilarBox(i);
      const style = hl?.boxStyleFromRect?.(el.getBoundingClientRect(), 1);
      const entering = box.hidden || box.classList.contains("cs-peer-hidden");
      if (style) hl?.applyBoxStyle?.(box, style, { animate: !entering });
      box.hidden = false;
      if (entering) {
        box.classList.add("cs-peer-hidden", "cs-no-motion");
        const raf = globalThis.requestAnimationFrame;
        const reveal = () => {
          if (!box.isConnected || similarHintNodes[i] !== el) return;
          box.classList.remove("cs-no-motion");
          box.classList.remove("cs-peer-hidden");
        };
        if (typeof raf === "function") raf.call(globalThis, reveal);
        else reveal();
      } else {
        box.classList.remove("cs-peer-hidden");
      }
    }

    for (let i = filtered.length; i < similarBoxes.length; i += 1) {
      similarBoxes[i]?.classList?.add?.("cs-peer-hidden");
    }
  }

  function clearHover() {
    if (hoverRaf) {
      cancelHoverFrame(hoverRaf);
      hoverRaf = 0;
    }
    pendingHoverPoint = null;
    state.hoverEl = null;
    hideHoverBox();
    clearSimilarHints();
  }

  function processHoverPoint(clientX, clientY) {
    const raw = document.elementFromPoint(clientX, clientY);
    if (!raw || isOverlay(raw)) {
      if (state.hoverEl) clearHover();
      return;
    }
    const stabilize = NS.highlight?.stabilizeHoverTarget;
    const el = stabilize ? stabilize(state.hoverEl, raw, clientX, clientY) : raw;
    if (!el || el === state.hoverEl) {
      if (el === state.hoverEl && el) placeHoverBox(el, true);
      return;
    }
    const prev = state.hoverEl;
    state.hoverEl = el;
    placeHoverBox(el, !!prev);
    fadeSimilarHints();
    scheduleSimilarHints(el);
  }

  function onMouseMove(e) {
    if (!state.active || isOverlayEvent(e)) return;
    pendingHoverPoint = { x: e.clientX, y: e.clientY };
    if (hoverRaf) return;
    let ranSync = false;
    hoverRaf = scheduleHoverFrame(() => {
      ranSync = true;
      hoverRaf = 0;
      const point = pendingHoverPoint;
      pendingHoverPoint = null;
      if (!point || !state.active) return;
      processHoverPoint(point.x, point.y);
    });
    // Sync rAF polyfills (tests) finish before the id is assigned — don't stick a stale handle.
    if (ranSync) hoverRaf = 0;
  }

  function findFieldForClick(el, item, group) {
    if (!(el instanceof Element) || !group?.fields?.length) return null;
    const marked = el.classList.contains("click-scrape-selected");
    if (!marked) return null;
    for (const field of group.fields) {
      let fieldEl = null;
      try {
        fieldEl = NS.extract.queryField?.(item, field.relativeSelector);
      } catch {
        fieldEl = null;
      }
      if (fieldEl === el || fieldEl?.contains?.(el) || (fieldEl && el.contains?.(fieldEl))) return field;
    }
    return null;
  }

  function itemContaining(items, el) {
    return (items || []).find((i) => i === el || i.contains?.(el)) || null;
  }

  function disjointItems(a, b) {
    if (!a?.length || !b?.length) return true;
    const seen = new Set(a);
    return !b.some((n) => seen.has(n));
  }

  function listNestedInItems(liveItems, items) {
    if (!liveItems?.length || !items?.length) return false;
    return items.every((ni) => liveItems.some((live) => live === ni || live.contains?.(ni)));
  }

  function findGroupIndexForElement(el) {
    for (let i = 0; i < state.groups.length; i += 1) {
      if (itemContaining(state.groups[i].liveItems, el)) return i;
    }
    return -1;
  }

  function findGroupIndexForFieldName(name, preferredIndex) {
    if (preferredIndex != null && !Number.isNaN(preferredIndex) && state.groups[preferredIndex]) {
      if (state.groups[preferredIndex].fields.some((f) => f.name === name)) return preferredIndex;
    }
    for (let i = 0; i < state.groups.length; i += 1) {
      if (state.groups[i].fields.some((f) => f.name === name)) return i;
    }
    return -1;
  }

  function clearSelectedMarks() {
    selectedByField.clear();
    document.querySelectorAll(".click-scrape-selected").forEach((node) => {
      node.classList.remove("click-scrape-selected");
    });
  }

  function resetAllGroups() {
    state.groups = [];
    selectedByField.clear();
  }

  /** Replace all groups with one nested list (title → About this item). */
  function adoptNestedGroup(ctx) {
    for (let i = 0; i < state.groups.length; i += 1) {
      for (const field of state.groups[i].fields) {
        clearFieldOutlines(i, field.name, field.relativeSelector);
      }
    }
    clearSelectedMarks();
    clearRetrievedItems();
    state.groups = [createGroup(ctx)];
  }

  /** Start a sibling list as its own table (row 1). */
  function startSiblingGroup(ctx) {
    state.groups.push(createGroup(ctx));
    return state.groups.length - 1;
  }

  function onClick(e) {
    if (!state.active || isOverlayEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (state.walking) return;
    const el = state.hoverEl || e.target;
    if (!(el instanceof Element) || isOverlay(el) || !el.isConnected) return;

    const ctx = NS.selectors.findListContext(el);
    const ctxItems = (ctx.items || []).filter((n) => n?.nodeType === 1);
    let groupIndex = findGroupIndexForElement(el);

    if (ctxItems.length >= 2) {
      if (groupIndex >= 0) {
        const group = state.groups[groupIndex];
        // Nested list inside a greedy item (title → .celwidget, then About → <li>).
        if (disjointItems(group.liveItems, ctxItems) && listNestedInItems(group.liveItems, ctxItems)) {
          adoptNestedGroup(ctx);
          groupIndex = 0;
        }
      } else if (!state.groups.length) {
        state.groups = [createGroup(ctx)];
        groupIndex = 0;
      } else if (disjointItems(allLiveItems(), ctxItems)) {
        if (listNestedInItems(allLiveItems(), ctxItems)) {
          adoptNestedGroup(ctx);
          groupIndex = 0;
        } else {
          groupIndex = startSiblingGroup(ctx);
        }
      }
    }

    if (groupIndex < 0) {
      if (!state.groups.length) {
        state.groups = [createGroup(ctx)];
        groupIndex = 0;
      } else {
        // Outside every current live item (e.g. price block then shipping line):
        // start a new table — do not glue onto the last group (that yields empty cells).
        groupIndex = startSiblingGroup(ctx);
      }
    }

    const group = state.groups[groupIndex];
    if (!group.rootSelector && ctx.rootSelector) {
      group.rootSelector = ctx.rootSelector;
      group.itemSelector = ctx.itemSelector || "*";
      group.liveItems = ctxItems.length ? ctxItems : group.liveItems;
    }

    const nameInput = document.getElementById("cs-field-name");
    const name = (nameInput?.value || "").trim() || `Field ${group.fields.length + 1}`;

    let item = itemContaining(group.liveItems, el);
    item = item || ctxItems.find((i) => i === el || i.contains(el)) || el;
    if (!group.sampleItem) group.sampleItem = item;

    const existing = findFieldForClick(el, item, group);
    if (existing) {
      onDrop(existing.name, groupIndex);
      return;
    }

    const rel = NS.selectors.relativeSelector(item, el);
    const picked = NS.columns.applyPick(name, {
      fields: group.fields,
      columnOrder: group.columnOrder,
      hiddenColumns: group.hiddenColumns,
      relativeSelector: rel,
    });
    group.fields = picked.fields;
    group.columnOrder = picked.columnOrder;
    group.hiddenColumns = picked.hiddenColumns;
    const fieldName =
      picked.fields.find((f) => f.relativeSelector === rel)?.name ||
      picked.fields[picked.fields.length - 1]?.name ||
      name;
    const stored = group.fields.find((f) => f.name === fieldName);
    if (stored) {
      if (!stored.anchorRelativeSelector) stored.anchorRelativeSelector = stored.relativeSelector;
      stored._anchorEl = el;
      stored._targetEl = el;
    }
    markFieldSelected(groupIndex, fieldName, el);
    flashPickConfirm(el);
    if (nameInput) nameInput.value = "";
    if (group.rowsDirty) {
      mergeFieldIntoDirtyGroup(group, fieldName);
      highlightRetrievedItems(
        state.groups.flatMap((g) => (g.fields.length ? outlineItemsForGroup(g) : []))
      );
      applyColumnView();
    } else {
      refreshUi();
      // Load lazy/infinite peers so preview + outlines grow beyond the first viewport.
      expandGroupByScrolling(group);
    }
  }

  function onKeyDown(e) {
    if (!state.active) return;
    if (e.key === "Escape") stopPicker();
  }

  function groupColumns(group) {
    if (!group) return [];
    const hidden = new Set(group.hiddenColumns);
    const inOrder = new Set(group.columnOrder);
    for (const f of group.fields) {
      if (!inOrder.has(f.name) && !hidden.has(f.name)) {
        group.columnOrder.push(f.name);
        inOrder.add(f.name);
      }
    }
    const names = new Set(group.fields.map((f) => f.name));
    return NS.columns.visibleColumns(group.columnOrder, group.hiddenColumns).filter((n) => names.has(n));
  }

  function getPreviewTables() {
    return state.groups
      .map((group, groupIndex) => {
        const name = String(group.name || "").trim();
        return {
          groupIndex,
          name,
          columns: groupColumns(group),
          rows: Array.isArray(group.rows) ? group.rows : [],
          rowsDirty: !!group.rowsDirty,
        };
      })
      .filter((t) => t.columns.length);
  }

  function resolveGroupItem(group) {
    if (!group) return null;
    if (group.sampleItem?.isConnected) return group.sampleItem;
    const live = (group.liveItems || []).find((n) => n?.isConnected);
    if (live) return live;
    return outlineItemsForGroup(group)[0] || null;
  }

  function fieldAdjustMeta(group, field) {
    const item = resolveGroupItem(group);
    if (!item || !field?.relativeSelector) {
      return { sample: "", canBroader: false, canNarrower: false };
    }
    // Resolve anchor for step info only — never treat the current broader node as the leaf.
    let anchor = null;
    if (field._anchorEl instanceof Element && field._anchorEl.isConnected && item.contains(field._anchorEl)) {
      anchor = field._anchorEl;
    }
    if (!anchor && field.anchorRelativeSelector) {
      try {
        anchor = NS.extract.queryField?.(item, field.anchorRelativeSelector);
      } catch {
        anchor = null;
      }
    }
    if (!(anchor instanceof Element) || !item.contains(anchor) || anchor === item) {
      anchor = null;
    } else {
      field._anchorEl = anchor;
    }
    let el = null;
    if (field._targetEl instanceof Element && field._targetEl.isConnected && item.contains(field._targetEl)) {
      el = field._targetEl;
    } else {
      try {
        el = NS.extract.queryField?.(item, field.relativeSelector);
      } catch {
        el = null;
      }
    }
    if (!(el instanceof Element)) {
      return { sample: "", canBroader: false, canNarrower: false };
    }
    const info = NS.selectors.fieldTargetStepInfo?.(item, el, { anchor }) || {};
    const sample = String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 56);
    return {
      sample,
      canBroader: !!info.canBroader,
      canNarrower: !!info.canNarrower,
    };
  }

  function visibleFieldList() {
    const out = [];
    state.groups.forEach((group, groupIndex) => {
      const byName = new Map(group.fields.map((f) => [f.name, f]));
      for (const n of groupColumns(group)) {
        const field = byName.get(n);
        if (!field) continue;
        const meta = fieldAdjustMeta(group, field);
        out.push({ ...field, groupIndex, ...meta });
      }
    });
    return out;
  }

  function primaryGroup() {
    return state.groups[0] || null;
  }

  function currentRecipe() {
    const group = primaryGroup();
    if (!group) return { rootSelector: "", itemSelector: "*", fields: [] };
    return {
      rootSelector: group.rootSelector,
      itemSelector: group.itemSelector,
      fields: group.fields,
    };
  }

  function applyColumnView() {
    NS.overlay.renderFields(visibleFieldList());
    const tables = getPreviewTables();
    if (!tables.length) {
      NS.overlay.renderPreview([], [], { pagination: state.walking });
      return;
    }
    NS.overlay.renderPreview([], [], { tables, pagination: state.walking });
  }

  function onRename(oldName, nextName, groupIndex) {
    if (state.walking) return;
    const gi = findGroupIndexForFieldName(oldName, groupIndex);
    if (gi < 0) return;
    const group = state.groups[gi];
    const updated = NS.columns.renameColumn(group, oldName, nextName);
    group.fields = updated.fields;
    group.rows = updated.rows;
    group.columnOrder = updated.columnOrder;
    group.hiddenColumns = updated.hiddenColumns;
    if (oldName !== nextName && selectedByField.has(fieldKey(gi, oldName))) {
      selectedByField.set(fieldKey(gi, nextName), selectedByField.get(fieldKey(gi, oldName)));
      selectedByField.delete(fieldKey(gi, oldName));
    }
    applyColumnView();
  }

  function onRenameTable(groupIndex, nextName) {
    if (state.walking) return;
    const gi = Number(groupIndex);
    if (!Number.isFinite(gi) || !state.groups[gi]) return;
    const group = state.groups[gi];
    const trimmed = String(nextName || "").trim();
    if (!trimmed) {
      group.name = "";
      applyColumnView();
      if (editingRecipeId) scheduleRecipePersist();
      return;
    }
    const used = state.groups
      .map((g, i) => (i === gi ? "" : String(g.name || "").trim()))
      .filter(Boolean);
    group.name = NS.columns.uniqueName(trimmed, used);
    applyColumnView();
    if (editingRecipeId) scheduleRecipePersist();
  }

  function onDrop(name, groupIndex) {
    if (state.walking) return;
    const gi = findGroupIndexForFieldName(name, groupIndex);
    if (gi < 0) return;
    const group = state.groups[gi];
    const field = group.fields.find((f) => f.name === name);
    const updated = NS.columns.dropColumn(group, name);
    group.fields = updated.fields;
    group.columnOrder = updated.columnOrder;
    group.hiddenColumns = updated.hiddenColumns;
    if (NS.rows?.stripColumn) group.rows = NS.rows.stripColumn(group.rows, name);
    if (field) clearFieldOutlines(gi, field.name, field.relativeSelector);
    if (!group.fields.length) {
      state.groups.splice(gi, 1);
      remapSelectedAfterGroupRemoved(gi);
    }
    if (!state.groups.length) {
      clearSelectedMarks();
      clearHover();
      refreshUi();
      return;
    }
    if (group.rowsDirty) applyColumnView();
    else refreshUi();
  }

  function onMove(name, dir, groupIndex) {
    if (state.walking) return;
    const gi = findGroupIndexForFieldName(name, groupIndex);
    if (gi < 0) return;
    const group = state.groups[gi];
    group.columnOrder = NS.columns.moveColumn(group.columnOrder, name, dir);
    applyColumnView();
  }

  function onAdjustField(name, dir, groupIndex) {
    if (state.walking) return;
    const gi = findGroupIndexForFieldName(name, groupIndex);
    if (gi < 0) return;
    const group = state.groups[gi];
    const field = group.fields.find((f) => f.name === name);
    if (!field) return;
    const item = resolveGroupItem(group);
    if (!item) return;
    let current = null;
    if (field._targetEl instanceof Element && field._targetEl.isConnected && item.contains(field._targetEl)) {
      current = field._targetEl;
    } else {
      try {
        current = NS.extract.queryField?.(item, field.relativeSelector);
      } catch {
        current = null;
      }
    }
    if (!(current instanceof Element)) return;

    // Anchor = original pick leaf so Broader → Narrower returns to the price leaf.
    if (!field.anchorRelativeSelector && current !== item) {
      field.anchorRelativeSelector = field.relativeSelector;
    }
    let anchor = null;
    if (field._anchorEl instanceof Element && field._anchorEl.isConnected && item.contains(field._anchorEl)) {
      anchor = field._anchorEl;
    }
    if (!anchor && field.anchorRelativeSelector) {
      try {
        anchor = NS.extract.queryField?.(item, field.anchorRelativeSelector);
      } catch {
        anchor = null;
      }
    }
    // Never clobber the stored pick leaf while broadening (would trap Narrower).
    if (!(anchor instanceof Element) || !item.contains(anchor) || anchor === item) {
      if (dir < 0) {
        anchor = null;
      } else {
        anchor = current !== item ? current : null;
      }
    } else {
      field._anchorEl = anchor;
    }

    if (
      !anchor &&
      field._anchorEl instanceof Element &&
      field._anchorEl.isConnected &&
      item.contains(field._anchorEl) &&
      field._anchorEl !== item
    ) {
      anchor = field._anchorEl;
    }

    const next = NS.selectors.stepFieldTarget?.(item, current, dir, { anchor });
    if (!(next instanceof Element) || next === current) return;

    const oldRel = field.relativeSelector;
    clearFieldOutlines(gi, name, oldRel);
    field.relativeSelector = NS.selectors.relativeSelector(item, next);
    field._targetEl = next;
    // If Narrower leaves the old anchor branch, retarget the anchor to the new leaf tip.
    if (dir > 0 && anchor && !(next === anchor || next.contains(anchor))) {
      const tipLadder = NS.selectors.fieldTargetLadder?.(item, next, { anchor: next }) || [];
      const tip = tipLadder[tipLadder.length - 1] || next;
      field.anchorRelativeSelector = NS.selectors.relativeSelector(item, tip);
      field._anchorEl = tip;
    }
    if (!group.sampleItem?.isConnected) group.sampleItem = item;
    markFieldSelected(gi, name, next);

    if (group.rowsDirty) {
      mergeFieldIntoDirtyGroup(group, name);
      highlightRetrievedItems(
        state.groups.flatMap((g) => (g.fields.length ? outlineItemsForGroup(g) : []))
      );
      applyColumnView();
    } else {
      refreshUi();
    }
    setHint(
      dir < 0
        ? `Broader — “${name}” now covers a larger area. Narrower to tighten.`
        : `Narrower — “${name}” now targets a smaller area. Broader to expand.`
    );
    scheduleRecipePersist();
  }

  function remapSelectedAfterGroupRemoved(removedIndex) {
    const nextMap = new Map();
    selectedByField.forEach((set, key) => {
      const [idxStr, ...rest] = key.split("::");
      let idx = Number(idxStr);
      if (Number.isNaN(idx)) return;
      if (idx === removedIndex) return;
      if (idx > removedIndex) idx -= 1;
      nextMap.set(fieldKey(idx, rest.join("::")), set);
    });
    selectedByField = nextMap;
  }

  function syncSessionChrome() {
    syncSaveButtonLabel();
    syncEditRecipeButton();
  }

  function syncEditRecipeButton() {
    const btn = document.querySelector("#cs-edit-recipe");
    if (!btn) return;
    // After Run: offer Edit so the user can add fields, then Update.
    const show = !!editingRecipeId && !state.active && !state.walking;
    btn.hidden = !show;
    btn.disabled = !show;
  }

  function beginRecipeEdit() {
    if (!editingRecipeId || state.walking) return;
    if (!state.active) {
      startPicker({ preserveGroups: true });
    }
    syncSessionChrome();
    const n = state.groups.length;
    setHint(
      `Editing recipe — ${n} table(s). Click the page to add fields or lists. Update recipe when done.`
    );
  }

  function bindColumnHandlers() {
    if (state.walking) {
      NS.overlay.setColumnHandlers({});
      NS.overlay.setRowHandlers?.({});
      NS.overlay.setSessionHandlers?.({});
      syncSessionChrome();
      return;
    }
    NS.overlay.setColumnHandlers({ onRename, onDrop, onMove, onAdjustField });
    NS.overlay.setRowHandlers?.({
      onEditCell,
      onAddRow,
      onDeleteRow,
      onResetRows,
    });
    NS.overlay.setSessionHandlers?.({
      onEditRecipe: beginRecipeEdit,
      onPreviewRowLimit: onPreviewRowLimit,
      onRenameTable,
    });
    syncSessionChrome();
  }

  function syncSaveButtonLabel() {
    const btn = document.querySelector("#cs-save");
    if (!btn) return;
    btn.textContent = editingRecipeId ? "Update recipe" : "Save recipe";
  }

  function clearEditingSession() {
    editingRecipeId = null;
    editingRecipeMeta = null;
    syncSessionChrome();
  }

  function attachRecipeSession(recipe) {
    editingRecipeId = recipe?.id || null;
    editingRecipeMeta = recipe?.id
      ? { name: recipe.name, createdAt: recipe.createdAt }
      : null;
  }

  function buildRecipeFromState() {
    const groups = state.groups.filter((g) => g.fields?.length && g.rootSelector);
    if (!groups.length) return null;
    const primary = groups[0];
    const updating = !!editingRecipeId;
    return {
      id: editingRecipeId || crypto.randomUUID(),
      name: updating && editingRecipeMeta?.name
        ? editingRecipeMeta.name
        : `Recipe ${new Date().toLocaleString()}`,
      createdAt:
        updating && editingRecipeMeta?.createdAt != null
          ? editingRecipeMeta.createdAt
          : Date.now(),
      pageUrl: location.href,
      rootSelector: primary.rootSelector,
      itemSelector: primary.itemSelector,
      fields: primary.fields,
      columnOrder: primary.columnOrder.slice(),
      hiddenColumns: primary.hiddenColumns.slice(),
      groups: groups.map((g) => {
        const entry = {
          rootSelector: g.rootSelector,
          itemSelector: g.itemSelector,
          fields: g.fields.map((f) => {
            const entry = { name: f.name, relativeSelector: f.relativeSelector };
            if (f.anchorRelativeSelector && f.anchorRelativeSelector !== f.relativeSelector) {
              entry.anchorRelativeSelector = f.anchorRelativeSelector;
            }
            return entry;
          }),
          columnOrder: g.columnOrder.slice(),
          hiddenColumns: g.hiddenColumns.slice(),
        };
        const n = String(g.name || "").trim();
        if (n) entry.name = n;
        return entry;
      }),
    };
  }

  async function persistRecipe(options = {}) {
    const quiet = !!options.quiet;
    const recipe = buildRecipeFromState();
    if (!recipe) return null;
    const updating = !!editingRecipeId;
    await NS.storage.saveRecipe(recipe);
    if (!editingRecipeId) editingRecipeId = recipe.id;
    editingRecipeMeta = { name: recipe.name, createdAt: recipe.createdAt };
    syncSaveButtonLabel();
    if (quiet) {
      setHint(options.hint || "Nesting saved to this recipe.");
      return recipe;
    }
    let count = 0;
    try {
      const recipes = await NS.storage.listRecipes();
      count = recipes.length;
    } catch {
      /* save already succeeded */
    }
    const groups = recipe.groups || [];
    const fieldTotal = groups.reduce((n, g) => n + (g.fields?.length || 0), 0);
    const verb = updating ? "updated" : "saved";
    if (NS.storage.shouldNudgeRecipes?.(count)) {
      setHint(`Recipe ${verb} (${groups.length} table(s), ${fieldTotal} field(s)). ${NS.storage.recipeNudgeCopy(count)}`);
    } else {
      setHint(
        updating
          ? `Recipe updated (${groups.length} table(s), ${fieldTotal} field(s)).`
          : `Recipe saved (${groups.length} table(s), ${fieldTotal} field(s)). Open the extension popup to re-run.`
      );
    }
    return recipe;
  }

  function scheduleRecipePersist() {
    if (!editingRecipeId) return;
    if (recipePersistTimer) clearTimeout(recipePersistTimer);
    recipePersistTimer = setTimeout(() => {
      recipePersistTimer = null;
      persistRecipe({
        quiet: true,
        hint: "Nesting saved to this recipe. Run will rematch the same level.",
      }).catch(() => {});
    }, 400);
  }

  async function loadUserPrefs() {
    try {
      const prefs = await NS.storage.getPrefs?.();
      if (prefs?.previewRowLimit) {
        NS.overlay.setPreviewRowLimit?.(prefs.previewRowLimit);
      }
    } catch {
      /* prefs are optional */
    }
  }

  async function onPreviewRowLimit(limit) {
    NS.overlay.setPreviewRowLimit?.(limit);
    applyColumnView();
    try {
      await NS.storage.setPrefs?.({ previewRowLimit: limit });
      setHint(`Preview shows up to ${limit} rows (saved on this device).`);
    } catch {
      setHint(`Preview shows up to ${limit} rows.`);
    }
  }

  function deactivatePicking() {
    abortPickScroll();
    if (!state.active) return;
    state.active = false;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  function anyRowsDirty() {
    return state.groups.some((g) => g.rowsDirty);
  }

  function onEditCell(groupIndex, rowIndex, column, value) {
    if (state.walking) return;
    const group = state.groups[groupIndex];
    if (!group || !column) return;
    const prev = group.rows?.[rowIndex]?.[column];
    const nextVal = String(value ?? "");
    if (prev === nextVal && group.rowsDirty) return;
    group.rows = NS.rows.updateCell(group.rows, rowIndex, column, nextVal);
    group.rowsDirty = true;
    // Keep caret / focus — do not rebuild the whole table on every cell blur.
    NS.overlay.markTableDirty?.(groupIndex, true);
  }

  function onAddRow(groupIndex) {
    if (state.walking) return;
    const group = state.groups[groupIndex];
    if (!group) return;
    group.rows = NS.rows.addRow(group.rows, groupColumns(group));
    group.rowsDirty = true;
    applyColumnView();
  }

  function onDeleteRow(groupIndex, rowIndex) {
    if (state.walking) return;
    const group = state.groups[groupIndex];
    if (!group) return;
    group.rows = NS.rows.removeRow(group.rows, rowIndex);
    group.rowsDirty = true;
    applyColumnView();
  }

  function onResetRows(groupIndex) {
    if (state.walking) return;
    const group = state.groups[groupIndex];
    if (!group) return;
    group.rowsDirty = false;
    const outlined = refreshGroupRows(group);
    highlightRetrievedItems(
      state.groups.flatMap((g, i) => {
        if (!g.fields.length) return [];
        if (i === groupIndex) return outlined;
        return outlineItemsForGroup(g);
      })
    );
    applyColumnView();
    setHint("Table reset from the page.");
    expandGroupByScrolling(group);
  }

  function abortPickScroll() {
    pickScrollGeneration += 1;
    try {
      pickScrollController?.abort();
    } catch {
      /* ignore */
    }
    pickScrollController = null;
  }

  /**
   * While picking: scroll the list and merge rows so the preview fills beyond the viewport.
   * Fire-and-forget; aborted on Stop / Walk / a newer pick-scroll.
   */
  async function expandGroupByScrolling(group) {
    if (!state.active || state.walking || !group || group.rowsDirty) return;
    if (!group.fields?.length || !group.rootSelector) return;
    if (typeof NS.lazyLoad?.scrapeRecipeWhileScrolling !== "function") return;

    const gen = ++pickScrollGeneration;
    try {
      pickScrollController?.abort();
    } catch {
      /* ignore */
    }
    pickScrollController =
      typeof AbortController === "function" ? new AbortController() : null;

    const recipe = {
      rootSelector: group.rootSelector,
      itemSelector: group.itemSelector || "*",
      fields: group.fields,
    };
    const columns = groupColumns(group);
    const beforeCount = Array.isArray(group.rows) ? group.rows.length : 0;
    setHint("Scrolling to load more items…");

    try {
      const scraped = await NS.lazyLoad.scrapeRecipeWhileScrolling(recipe, document, {
        signal: pickScrollController?.signal,
        columns,
        onProgress: ({ rows }) => {
          if (gen !== pickScrollGeneration || group.rowsDirty || !state.active) return;
          group.rows = rows;
          applyColumnView();
          setHint(`Scrolling to load more items… ${rows.length} row(s)`);
        },
      });
      if (gen !== pickScrollGeneration || !state.active || group.rowsDirty) return;

      if (scraped?.rows) group.rows = scraped.rows;
      const items = NS.extract.retrieveItems?.(recipe) || [];
      if (items.length) {
        group.liveItems = items.filter((n) => n?.nodeType === 1);
      }
      highlightRetrievedItems(
        state.groups.flatMap((g) => (g.fields.length ? outlineItemsForGroup(g) : []))
      );
      applyColumnView();
      const n = group.rows?.length || 0;
      if (n > beforeCount) {
        setHint(`Loaded ${n} row(s). Click to add columns, or Export / Walk.`);
      } else {
        setHint(`${n} row(s). Click to add columns, or Export / Walk.`);
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (gen !== pickScrollGeneration) return;
      setHint("Could not load more items by scrolling. Export or Walk with what you have.");
    } finally {
      if (gen === pickScrollGeneration) pickScrollController = null;
    }
  }

  function mergeFieldIntoDirtyGroup(group, fieldName) {
    if (!group || !fieldName) return;
    const live = (group.liveItems || []).filter((n) => n?.isConnected);
    const items = live.length ? live : outlineItemsForGroup(group);
    if (items.length) group.liveItems = items.filter((n) => n?.nodeType === 1);
    const scraped =
      NS.extract.retrieveRowsFromItems?.(group.liveItems, group.fields) || [];
    group.rows = NS.rows.mergeColumn(group.rows, fieldName, scraped);
  }

  function setHint(text) {
    const hint = document.querySelector("#click-scrape-overlay > .cs-hint");
    if (hint) hint.textContent = text;
  }

  function withPageNudge(baseHint, pages) {
    if (!NS.storage?.shouldNudgePages?.(pages)) return baseHint;
    const extra = NS.storage.pageNudgeCopy?.(pages);
    if (!extra) return baseHint;
    return `${baseHint} ${extra}`.trim();
  }

  function refreshGroupRows(group) {
    if (group.rowsDirty) {
      return outlineItemsForGroup(group);
    }
    const live = (group.liveItems || []).filter((n) => n?.isConnected);
    if (live.length) {
      group.rows = NS.extract.retrieveRowsFromItems?.(live, group.fields) || [];
      return live;
    }
    if (!group.fields.length || !group.rootSelector) {
      group.rows = [];
      return [];
    }
    const recipe = {
      rootSelector: group.rootSelector,
      itemSelector: group.itemSelector,
      fields: group.fields,
    };
    const result = NS.extract.retrieve?.(recipe) || {
      items: NS.extract.retrieveItems?.(recipe) || [],
      rows: NS.extract.extractRows(recipe),
    };
    group.rows = result.rows || [];
    return result.items || [];
  }

  function refreshUi() {
    const hasAny = state.groups.some((g) => g.fields.length && g.rootSelector);
    if (!hasAny) {
      state.walked = false;
      clearRetrievedItems();
      NS.overlay.renderFields([]);
      NS.overlay.renderPreview([], []);
      return;
    }
    state.walked = false;
    const outlined = [];
    for (const group of state.groups) {
      if (!group.fields.length) continue;
      outlined.push(...refreshGroupRows(group));
    }
    highlightRetrievedItems(outlined);
    applyColumnView();
  }

  async function persistPageCount(n) {
    try {
      await NS.storage?.setLastRunPages?.(n);
    } catch {
      /* scrape still works if storage write fails */
    }
  }

  async function onWalkPages() {
    if (state.walking) return;
    abortPickScroll();
    if (anyRowsDirty()) {
      setHint("Reset edited tables from the page before walking, or Export first.");
      return;
    }
    const group = primaryGroup();
    const recipe = currentRecipe();
    if (!group || !recipe.fields.length || !recipe.rootSelector) {
      setHint("Add columns first, then walk pages.");
      return;
    }
    const walkBtn = document.getElementById("cs-walk");
    const generation = ++walkGeneration;
    walkController = typeof AbortController === "function" ? new AbortController() : null;
    state.walking = true;
    bindColumnHandlers();
    if (walkBtn) walkBtn.disabled = true;
    setHint("Pagination in progress…");

    const columns = groupColumns(group);
    const stale = () => generation !== walkGeneration;
    try {
      const result = await NS.pagination.walkPages(recipe, document, {
        currentUrl: location.href,
        persistPageCount,
        signal: walkController?.signal,
        columns,
        beforeExtract: async (doc) => {
          if (doc !== document) return null;
          setHint("Scrolling to load items…");
          const scraped = await NS.lazyLoad?.scrapeRecipeWhileScrolling?.(recipe, doc, {
            signal: walkController?.signal,
            columns,
            onProgress: ({ rows }) => {
              if (stale()) return;
              group.rows = rows;
              applyColumnView();
              setHint(`Scrolling to load items… ${rows.length} row(s) so far`);
            },
          });
          return scraped || null;
        },
        onProgress: ({ rows, hint, done }) => {
          if (stale()) return;
          group.rows = rows;
          applyColumnView();
          if (hint) setHint(hint);
          if (done) state.walked = true;
        },
      });
      if (stale()) return;
      group.rows = result.rows;
      state.walked = true;
      applyColumnView();
      const walkHint = result.hint || `${group.rows.length} row(s) from ${result.pages} page(s).`;
      setHint(withPageNudge(walkHint, result.pages));
    } catch {
      if (stale()) return;
      state.walked = Array.isArray(group.rows) && group.rows.length > 0;
      setHint("Pagination stopped. Keeping rows already collected.");
      applyColumnView();
    } finally {
      if (!stale()) {
        state.walking = false;
        walkController = null;
        bindColumnHandlers();
        if (walkBtn) walkBtn.disabled = false;
      }
    }
  }

  function injectWalkButton() {
    const overlay = document.getElementById("click-scrape-overlay");
    if (!overlay || overlay.querySelector("#cs-walk")) return;
    const btnRow = overlay.querySelector("#cs-export-csv")?.parentElement;
    if (!btnRow) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "cs-walk";
    btn.className = "secondary";
    btn.textContent = "Walk pages";
    btn.title = "Walk pagination";
    const stop = overlay.querySelector("#cs-stop");
    btnRow.insertBefore(btn, stop || null);
    btn.addEventListener("click", onWalkPages);
  }

  function bindOverlay() {
    const overlay = NS.overlay.ensureOverlay();
    injectWalkButton();
    bindColumnHandlers();
    if (overlay.dataset.csBound === "1") return;
    overlay.dataset.csBound = "1";
    overlay.querySelector("#cs-undo")?.addEventListener("click", () => {
      for (let i = state.groups.length - 1; i >= 0; i -= 1) {
        const group = state.groups[i];
        const removed = group.fields.pop();
        if (!removed) continue;
        const name = removed.name;
        const still = group.fields.some((f) => f.name === name);
        if (!still) {
          group.columnOrder = group.columnOrder.filter((n) => n !== name);
          group.hiddenColumns = group.hiddenColumns.filter((n) => n !== name);
          clearFieldOutlines(i, name, removed.relativeSelector);
        }
        if (!group.fields.length) state.groups.splice(i, 1);
        break;
      }
      if (!state.groups.length) {
        clearSelectedMarks();
        clearHover();
      }
      refreshUi();
    });
    overlay.querySelector("#cs-export-csv")?.addEventListener("click", () => {
      const tables = getPreviewTables();
      if (NS.export.exportCsvTables) NS.export.exportCsvTables(tables, "click-scrape");
      else {
        const g = primaryGroup();
        if (g) NS.export.exportCsv(g.rows || [], groupColumns(g), "click-scrape");
      }
    });
    overlay.querySelector("#cs-export-json")?.addEventListener("click", () => {
      const tables = getPreviewTables();
      if (NS.export.exportJsonTables) NS.export.exportJsonTables(tables, "click-scrape");
      else {
        const g = primaryGroup();
        if (g) NS.export.exportJson(g.rows || [], groupColumns(g), "click-scrape");
      }
    });
    overlay.querySelector("#cs-save")?.addEventListener("click", () => {
      persistRecipe({ quiet: false }).catch(() => {
        setHint("Could not save recipe.");
      });
    });
    overlay.querySelector("#cs-stop")?.addEventListener("click", stopPicker);
  }

  function startPicker(options = {}) {
    if (state.active) return;
    state.active = true;
    if (!options.preserveGroups) {
      state.groups = [];
      selectedByField.clear();
      clearEditingSession();
    }
    state.walked = false;
    bindOverlay();
    syncSessionChrome();
    loadUserPrefs().then(() => applyColumnView()).catch(() => {});
    document.documentElement.classList.add("click-scrape-picking");
    ensureHighlightLayer();
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange, true);
    refreshUi();
    if (!editingRecipeId) {
      setHint("Hover and click to add columns. Esc cancels.");
    }
  }

  function stopPicker() {
    walkGeneration += 1;
    abortPickScroll();
    try {
      walkController?.abort();
    } catch {
      /* ignore */
    }
    walkController = null;
    state.active = false;
    state.walking = false;
    if (recipePersistTimer) {
      clearTimeout(recipePersistTimer);
      recipePersistTimer = null;
    }
    if (editingRecipeId) {
      const recipe = buildRecipeFromState();
      if (recipe) NS.storage.saveRecipe(recipe).catch(() => {});
    }
    clearEditingSession();
    clearHover();
    clearRetrievedItems();
    selectedByField.clear();
    document.querySelectorAll(".click-scrape-selected").forEach((el) => el.classList.remove("click-scrape-selected"));
    document.querySelectorAll(".click-scrape-similar").forEach((el) => el.classList.remove("click-scrape-similar"));
    document.querySelectorAll(".click-scrape-item").forEach((el) => el.classList.remove("click-scrape-item"));
    similarHintNodes = [];
    document.documentElement.classList.remove("click-scrape-picking");
    removeHighlightLayer();
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange, true);
    NS.overlay.removeOverlay();
  }

  globalThis.__clickScrapeTeardown = () => {
    try {
      stopPicker();
    } catch {
      /* ignore */
    }
    try {
      document.getElementById("click-scrape-overlay")?.remove();
    } catch {
      /* ignore */
    }
    if (globalThis.__clickScrapeHandleMessage === handleRuntimeMessage) {
      globalThis.__clickScrapeHandleMessage = null;
    }
    globalThis.__clickScrapeBoot = null;
    globalThis.__clickScrapeLoaded = false;
    globalThis.__clickScrapeTeardown = null;
  };

  async function runRecipe(recipe) {
    deactivatePicking();
    attachRecipeSession(recipe);

    const specs =
      Array.isArray(recipe?.groups) && recipe.groups.length
        ? recipe.groups
        : [
            {
              rootSelector: recipe?.rootSelector || "",
              itemSelector: recipe?.itemSelector || "*",
              fields: recipe?.fields || [],
              columnOrder: recipe?.columnOrder,
              hiddenColumns: recipe?.hiddenColumns,
            },
          ];

    const built = [];
    const allItems = [];
    setHint("Scrolling to load items…");
    for (const spec of specs) {
      const group = createGroup({
        rootSelector: spec.rootSelector || "",
        itemSelector: spec.itemSelector || "*",
        items: [],
      });
      group.fields = (spec.fields || []).map((f) => {
        const entry = {
          name: f.name,
          relativeSelector: f.relativeSelector,
        };
        if (f.anchorRelativeSelector) entry.anchorRelativeSelector = f.anchorRelativeSelector;
        else entry.anchorRelativeSelector = f.relativeSelector;
        return entry;
      });
      group.name = String(spec.name || "").trim();
      group.columnOrder = Array.isArray(spec.columnOrder)
        ? spec.columnOrder.slice()
        : group.fields.map((f) => f.name);
      group.hiddenColumns = Array.isArray(spec.hiddenColumns) ? spec.hiddenColumns.slice() : [];
      const subRecipe = {
        rootSelector: group.rootSelector,
        itemSelector: group.itemSelector,
        fields: group.fields,
      };
      try {
        const scraped = await NS.lazyLoad?.scrapeRecipeWhileScrolling?.(subRecipe, document);
        if (scraped?.rows) {
          group.rows = scraped.rows;
          // Refresh live item handles from the final DOM state when possible.
          const result = NS.extract.retrieve?.(subRecipe) || { items: [] };
          group.liveItems = (result.items || []).filter((n) => n?.nodeType === 1);
          // Prefer merged scroll rows (handles virtualization) over a final DOM snapshot.
          if (!group.rows.length && result.rows) group.rows = result.rows;
        } else {
          await NS.lazyLoad?.revealRecipeItems?.(subRecipe, document);
          const result = NS.extract.retrieve?.(subRecipe) || {
            items: [],
            rows: NS.extract.extractRows(subRecipe),
          };
          group.rows = result.rows || [];
          group.liveItems = (result.items || []).filter((n) => n?.nodeType === 1);
        }
      } catch (err) {
        if (err && err.name !== "AbortError") throw err;
        const result = NS.extract.retrieve?.(subRecipe) || {
          items: [],
          rows: NS.extract.extractRows(subRecipe),
        };
        group.rows = result.rows || [];
        group.liveItems = (result.items || []).filter((n) => n?.nodeType === 1);
      }
      allItems.push(...group.liveItems);
      built.push(group);
    }

    state.groups = built;
    state.walked = false;
    highlightRetrievedItems(allItems);
    NS.overlay.ensureOverlay();
    bindOverlay();
    await loadUserPrefs();
    applyColumnView();
    syncSessionChrome();
    const totalRows = built.reduce((n, g) => n + (g.rows?.length || 0), 0);
    const totalFields = built.reduce((n, g) => n + (g.fields?.length || 0), 0);
    setHint(
      `Ran saved recipe — ${built.length} table(s), ${totalFields} field(s), ${totalRows} row(s). Edit recipe to add fields, or Export / Walk.`
    );
  }

  async function editRecipe(recipe) {
    await runRecipe(recipe);
    beginRecipeEdit();
  }

  function handleRuntimeMessage(msg, _sender, sendResponse) {
    if (msg?.type === "CLICK_SCRAPE_START") {
      startPicker();
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_STOP") {
      stopPicker();
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_RUN_RECIPE") {
      runRecipe(msg.recipe);
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_EDIT_RECIPE") {
      editRecipe(msg.recipe);
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_TOGGLE") {
      if (state.active) stopPicker();
      else startPicker();
      sendResponse({ ok: true, active: state.active });
    }
    return true;
  }

  // One durable listener; re-injects swap the handler instead of stacking listeners.
  if (!globalThis.__clickScrapeMsgBound) {
    globalThis.__clickScrapeMsgBound = true;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      const fn = globalThis.__clickScrapeHandleMessage;
      if (typeof fn === "function") return fn(msg, sender, sendResponse);
    });
  }
  globalThis.__clickScrapeHandleMessage = handleRuntimeMessage;
})();
