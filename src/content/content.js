(() => {
  if (globalThis.__clickScrapeLoaded) {
    return;
  }
  globalThis.__clickScrapeLoaded = true;

  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  /** @typedef {{ rootSelector: string, itemSelector: string, fields: {name:string,relativeSelector:string}[], sampleItem: Element|null, liveItems: Element[], rows: object[], columnOrder: string[], hiddenColumns: string[], rowsDirty: boolean }} ListGroup */

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
  /** @type {Element[]} */
  let similarHintNodes = [];
  /** @type {Element[]} */
  let retrievedItemNodes = [];
  /** @type {Map<string, Set<Element>>} key = `${groupIndex}::${fieldName}` */
  let selectedByField = new Map();

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
    similarHintNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-similar");
    });
    similarHintNodes = [];
  }

  function clearRetrievedItems() {
    retrievedItemNodes.forEach((node) => {
      node?.classList?.remove("click-scrape-item");
    });
    retrievedItemNodes = [];
  }

  function createGroup(ctx) {
    return {
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

  function applySimilarHints(peers) {
    clearSimilarHints();
    for (const el of peers || []) {
      if (!(el instanceof Element) || el === state.hoverEl) continue;
      if (el.classList.contains("click-scrape-item")) continue;
      el.classList.add("click-scrape-similar");
      similarHintNodes.push(el);
    }
  }

  function clearHover() {
    state.hoverEl?.classList.remove("click-scrape-hover");
    state.hoverEl = null;
    clearSimilarHints();
  }

  function onMouseMove(e) {
    if (!state.active || isOverlayEvent(e)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === state.hoverEl || isOverlay(el)) return;
    clearHover();
    state.hoverEl = el;
    el.classList.add("click-scrape-hover");
    const peers = NS.selectors.findSimilarPeers?.(el) || [];
    applySimilarHints(peers);
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
    markFieldSelected(groupIndex, fieldName, el);
    if (nameInput) nameInput.value = "";
    if (group.rowsDirty) {
      mergeFieldIntoDirtyGroup(group, fieldName);
      highlightRetrievedItems(
        state.groups.flatMap((g) => (g.fields.length ? outlineItemsForGroup(g) : []))
      );
      applyColumnView();
    } else {
      refreshUi();
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
      .map((group, groupIndex) => ({
        groupIndex,
        columns: groupColumns(group),
        rows: Array.isArray(group.rows) ? group.rows : [],
        rowsDirty: !!group.rowsDirty,
      }))
      .filter((t) => t.columns.length);
  }

  function visibleFieldList() {
    const out = [];
    state.groups.forEach((group, groupIndex) => {
      const byName = new Map(group.fields.map((f) => [f.name, f]));
      for (const n of groupColumns(group)) {
        const field = byName.get(n);
        if (field) out.push({ ...field, groupIndex });
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
      // Remap selected keys after splice
      const nextMap = new Map();
      selectedByField.forEach((set, key) => {
        const [idxStr, ...rest] = key.split("::");
        let idx = Number(idxStr);
        if (Number.isNaN(idx)) return;
        if (idx === gi) return;
        if (idx > gi) idx -= 1;
        nextMap.set(fieldKey(idx, rest.join("::")), set);
      });
      selectedByField = nextMap;
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

  function bindColumnHandlers() {
    if (state.walking) {
      NS.overlay.setColumnHandlers({});
      NS.overlay.setRowHandlers?.({});
      return;
    }
    NS.overlay.setColumnHandlers({ onRename, onDrop, onMove });
    NS.overlay.setRowHandlers?.({ onEditCell, onAddRow, onDeleteRow, onResetRows });
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
    overlay.querySelector("#cs-save")?.addEventListener("click", async () => {
      const groups = state.groups.filter((g) => g.fields?.length && g.rootSelector);
      if (!groups.length) return;
      const primary = groups[0];
      const recipe = {
        id: crypto.randomUUID(),
        name: `Recipe ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        pageUrl: location.href,
        // Legacy single-table shape (first group) for older Walk / readers.
        rootSelector: primary.rootSelector,
        itemSelector: primary.itemSelector,
        fields: primary.fields,
        columnOrder: primary.columnOrder.slice(),
        hiddenColumns: primary.hiddenColumns.slice(),
        groups: groups.map((g) => ({
          rootSelector: g.rootSelector,
          itemSelector: g.itemSelector,
          fields: g.fields.map((f) => ({ name: f.name, relativeSelector: f.relativeSelector })),
          columnOrder: g.columnOrder.slice(),
          hiddenColumns: g.hiddenColumns.slice(),
        })),
      };
      await NS.storage.saveRecipe(recipe);
      let count = 0;
      try {
        const recipes = await NS.storage.listRecipes();
        count = recipes.length;
      } catch {
        /* save already succeeded */
      }
      const fieldTotal = groups.reduce((n, g) => n + g.fields.length, 0);
      if (NS.storage.shouldNudgeRecipes?.(count)) {
        setHint(`Recipe saved (${groups.length} table(s), ${fieldTotal} field(s)). ${NS.storage.recipeNudgeCopy(count)}`);
      } else {
        setHint(`Recipe saved (${groups.length} table(s), ${fieldTotal} field(s)). Open the extension popup to re-run.`);
      }
    });
    overlay.querySelector("#cs-stop")?.addEventListener("click", stopPicker);
  }

  function startPicker() {
    if (state.active) return;
    state.active = true;
    state.groups = [];
    state.walked = false;
    selectedByField.clear();
    bindOverlay();
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    refreshUi();
  }

  function stopPicker() {
    walkGeneration += 1;
    try {
      walkController?.abort();
    } catch {
      /* ignore */
    }
    walkController = null;
    state.active = false;
    state.walking = false;
    clearHover();
    clearRetrievedItems();
    selectedByField.clear();
    document.querySelectorAll(".click-scrape-selected").forEach((el) => el.classList.remove("click-scrape-selected"));
    document.querySelectorAll(".click-scrape-similar").forEach((el) => el.classList.remove("click-scrape-similar"));
    document.querySelectorAll(".click-scrape-item").forEach((el) => el.classList.remove("click-scrape-item"));
    similarHintNodes = [];
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    NS.overlay.removeOverlay();
  }

  async function runRecipe(recipe) {
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
    for (const spec of specs) {
      const group = createGroup({
        rootSelector: spec.rootSelector || "",
        itemSelector: spec.itemSelector || "*",
        items: [],
      });
      group.fields = (spec.fields || []).map((f) => ({
        name: f.name,
        relativeSelector: f.relativeSelector,
      }));
      group.columnOrder = Array.isArray(spec.columnOrder)
        ? spec.columnOrder.slice()
        : group.fields.map((f) => f.name);
      group.hiddenColumns = Array.isArray(spec.hiddenColumns) ? spec.hiddenColumns.slice() : [];
      const subRecipe = {
        rootSelector: group.rootSelector,
        itemSelector: group.itemSelector,
        fields: group.fields,
      };
      const result = NS.extract.retrieve?.(subRecipe) || {
        items: [],
        rows: NS.extract.extractRows(subRecipe),
      };
      group.rows = result.rows || [];
      group.liveItems = (result.items || []).filter((n) => n?.nodeType === 1);
      allItems.push(...group.liveItems);
      built.push(group);
    }

    state.groups = built;
    state.walked = false;
    highlightRetrievedItems(allItems);
    NS.overlay.ensureOverlay();
    bindOverlay();
    applyColumnView();
    const totalRows = built.reduce((n, g) => n + (g.rows?.length || 0), 0);
    const totalFields = built.reduce((n, g) => n + (g.fields?.length || 0), 0);
    setHint(
      `Ran saved recipe — ${built.length} table(s), ${totalFields} field(s), ${totalRows} row(s). Walk pages or Export.`
    );
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "CLICK_SCRAPE_START") {
      startPicker();
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_STOP") {
      stopPicker();
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_RUN_RECIPE") {
      runRecipe(msg.recipe);
      sendResponse({ ok: true });
    } else if (msg?.type === "CLICK_SCRAPE_TOGGLE") {
      if (state.active) stopPicker();
      else startPicker();
      sendResponse({ ok: true, active: state.active });
    }
    return true;
  });
})();
