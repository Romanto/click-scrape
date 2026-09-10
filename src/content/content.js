(() => {
  if (globalThis.__clickScrapeLoaded) {
    return;
  }
  globalThis.__clickScrapeLoaded = true;

  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  /** @type {{ rootSelector: string, itemSelector: string, fields: {name:string,relativeSelector:string}[], sampleItem: Element|null, rows: object[], walked: boolean, columnOrder: string[], hiddenColumns: string[] }} */
  let state = {
    active: false,
    rootSelector: "",
    itemSelector: "*",
    fields: [],
    sampleItem: null,
    hoverEl: null,
    rows: [],
    walked: false,
    walking: false,
    columnOrder: [],
    hiddenColumns: [],
  };

  let walkController = null;
  let walkGeneration = 0;
  /** @type {Element[]} */
  let similarHintNodes = [];
  /** @type {Element[]} */
  let retrievedItemNodes = [];
  // TODO: Consider throttling onMouseMove with requestAnimationFrame for performance on complex pages.
  // Current direct handler works well for typical list pages but may lag on heavy DOM trees.

  function isOverlay(el) {
    return !!(el && (el.id === "click-scrape-overlay" || el.closest?.("#click-scrape-overlay")));
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

  function clearFieldOutlines(relativeSelector) {
    if (!relativeSelector || !state.rootSelector) return;
    try {
      const root = document.querySelector(state.rootSelector);
      if (!root) return;
      const items = NS.selectors.queryItems?.(root, state.itemSelector) || [];
      for (const item of items) {
        const fieldEl = NS.extract.queryField?.(item, relativeSelector);
        if (fieldEl) fieldEl.classList.remove("click-scrape-selected");
      }
    } catch {
      /* ignore */
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
    if (!state.active || isOverlay(e.target)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === state.hoverEl || isOverlay(el)) return;
    clearHover();
    state.hoverEl = el;
    el.classList.add("click-scrape-hover");
    const peers = NS.selectors.findSimilarPeers?.(el) || [];
    applySimilarHints(peers);
  }

  function onClick(e) {
    if (!state.active || isOverlay(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (state.walking) return;
    const el = state.hoverEl || e.target;
    if (!(el instanceof Element) || isOverlay(el)) return;

    const nameInput = document.getElementById("cs-field-name");
    const name = (nameInput?.value || "").trim() || `Field ${state.fields.length + 1}`;

    const ctx = NS.selectors.findListContext(el);
    if (!state.rootSelector) {
      state.rootSelector = ctx.rootSelector;
      state.itemSelector = ctx.itemSelector;
    }

    const item = ctx.items.find((i) => i === el || i.contains(el)) || el;
    if (!state.sampleItem) state.sampleItem = item;

    const rel = NS.selectors.relativeSelector(item, el);
    const picked = NS.columns.applyPick(name, {
      fields: state.fields,
      columnOrder: state.columnOrder,
      hiddenColumns: state.hiddenColumns,
      relativeSelector: rel,
    });
    state.fields = picked.fields;
    state.columnOrder = picked.columnOrder;
    state.hiddenColumns = picked.hiddenColumns;
    el.classList.add("click-scrape-selected");
    if (nameInput) nameInput.value = "";
    refreshUi();
  }

  function onKeyDown(e) {
    if (!state.active) return;
    if (e.key === "Escape") stopPicker();
  }

  function currentRecipe() {
    return {
      rootSelector: state.rootSelector,
      itemSelector: state.itemSelector,
      fields: state.fields,
    };
  }

  function syncColumnOrder() {
    const hidden = new Set(state.hiddenColumns);
    const inOrder = new Set(state.columnOrder);
    for (const f of state.fields) {
      if (!inOrder.has(f.name) && !hidden.has(f.name)) {
        state.columnOrder.push(f.name);
        inOrder.add(f.name);
      }
    }
  }

  function getColumns() {
    syncColumnOrder();
    const names = new Set(state.fields.map((f) => f.name));
    return NS.columns.visibleColumns(state.columnOrder, state.hiddenColumns).filter((n) => names.has(n));
  }

  function visibleFieldList() {
    const byName = new Map(state.fields.map((f) => [f.name, f]));
    return getColumns()
      .map((n) => byName.get(n))
      .filter(Boolean);
  }

  function getSessionRows() {
    return Array.isArray(state.rows) ? state.rows : [];
  }

  function applyColumnView() {
    NS.overlay.renderFields(visibleFieldList());
    NS.overlay.renderPreview(getSessionRows(), getColumns(), { pagination: state.walking });
  }

  function onRename(oldName, nextName) {
    if (state.walking) return;
    const updated = NS.columns.renameColumn(state, oldName, nextName);
    state.fields = updated.fields;
    state.rows = updated.rows;
    state.columnOrder = updated.columnOrder;
    state.hiddenColumns = updated.hiddenColumns;
    applyColumnView();
  }

  function onDrop(name) {
    if (state.walking) return;
    const field = state.fields.find((f) => f.name === name);
    const updated = NS.columns.dropColumn(state, name);
    state.fields = updated.fields;
    state.columnOrder = updated.columnOrder;
    state.hiddenColumns = updated.hiddenColumns;
    if (field) clearFieldOutlines(field.relativeSelector);
    applyColumnView();
  }

  function onMove(name, dir) {
    if (state.walking) return;
    state.columnOrder = NS.columns.moveColumn(state.columnOrder, name, dir);
    applyColumnView();
  }

  function bindColumnHandlers() {
    NS.overlay.setColumnHandlers(state.walking ? {} : { onRename, onDrop, onMove });
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

  function refreshUi() {
    if (!state.fields.length || !state.rootSelector) {
      state.rows = [];
      state.walked = false;
      clearRetrievedItems();
      NS.overlay.renderFields(state.fields);
      NS.overlay.renderPreview([], []);
      return;
    }
    state.walked = false;
    const result = NS.extract.retrieve?.(currentRecipe()) || {
      items: NS.extract.retrieveItems?.(currentRecipe()) || [],
      rows: NS.extract.extractRows(currentRecipe()),
    };
    state.rows = result.rows || [];
    highlightRetrievedItems(result.items || []);
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
    const recipe = currentRecipe();
    if (!recipe.fields.length || !recipe.rootSelector) {
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

    const columns = getColumns();
    const stale = () => generation !== walkGeneration;
    try {
      const result = await NS.pagination.walkPages(recipe, document, {
        currentUrl: location.href,
        persistPageCount,
        signal: walkController?.signal,
        columns,
        onProgress: ({ rows, hint, done }) => {
          if (stale()) return;
          state.rows = rows;
          NS.overlay.renderPreview(rows, getColumns());
          if (hint) setHint(hint);
          if (done) state.walked = true;
        },
      });
      if (stale()) return;
      state.rows = result.rows;
      state.walked = true;
      NS.overlay.renderPreview(state.rows, getColumns());
      const walkHint = result.hint || `${state.rows.length} row(s) from ${result.pages} page(s).`;
      setHint(withPageNudge(walkHint, result.pages));
    } catch {
      if (stale()) return;
      state.walked = Array.isArray(state.rows) && state.rows.length > 0;
      setHint("Pagination stopped. Keeping rows already collected.");
      NS.overlay.renderPreview(state.rows || [], getColumns());
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
      const removed = state.fields.pop();
      if (removed) {
        const name = removed.name;
        const still = state.fields.some((f) => f.name === name);
        if (!still) {
          state.columnOrder = state.columnOrder.filter((n) => n !== name);
          state.hiddenColumns = state.hiddenColumns.filter((n) => n !== name);
          clearFieldOutlines(removed.relativeSelector);
        }
      }
      refreshUi();
    });
    overlay.querySelector("#cs-export-csv")?.addEventListener("click", () => {
      const rows = getSessionRows();
      const columns = getColumns();
      NS.export.exportCsv(rows, columns, "click-scrape");
    });
    overlay.querySelector("#cs-export-json")?.addEventListener("click", () => {
      const rows = getSessionRows();
      const columns = getColumns();
      NS.export.exportJson(rows, columns, "click-scrape");
    });
    overlay.querySelector("#cs-save")?.addEventListener("click", async () => {
      if (!state.fields.length || !state.rootSelector) return;
      const recipe = {
        id: crypto.randomUUID(),
        name: `Recipe ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        pageUrl: location.href,
        rootSelector: state.rootSelector,
        itemSelector: state.itemSelector,
        fields: state.fields,
        columnOrder: state.columnOrder.slice(),
        hiddenColumns: state.hiddenColumns.slice(),
      };
      await NS.storage.saveRecipe(recipe);
      let count = 0;
      try {
        const recipes = await NS.storage.listRecipes();
        count = recipes.length;
      } catch {
        /* save already succeeded */
      }
      if (NS.storage.shouldNudgeRecipes?.(count)) {
        setHint(`Recipe saved. ${NS.storage.recipeNudgeCopy(count)}`);
      } else {
        setHint("Recipe saved. Open the extension popup to re-run.");
      }
    });
    overlay.querySelector("#cs-stop")?.addEventListener("click", stopPicker);
  }

  function startPicker() {
    if (state.active) return;
    state.active = true;
    state.fields = [];
    state.rootSelector = "";
    state.itemSelector = "*";
    state.sampleItem = null;
    state.rows = [];
    state.walked = false;
    state.columnOrder = [];
    state.hiddenColumns = [];
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
    state.fields = recipe.fields || [];
    state.rootSelector = recipe.rootSelector || "";
    state.itemSelector = recipe.itemSelector || "*";
    state.columnOrder = Array.isArray(recipe.columnOrder)
      ? recipe.columnOrder.slice()
      : state.fields.map((f) => f.name);
    state.hiddenColumns = Array.isArray(recipe.hiddenColumns) ? recipe.hiddenColumns.slice() : [];
    state.walked = false;
    const result = NS.extract.retrieve?.(recipe) || {
      items: [],
      rows: NS.extract.extractRows(recipe),
    };
    state.rows = result.rows || [];
    highlightRetrievedItems(result.items || []);
    NS.overlay.ensureOverlay();
    bindOverlay();
    applyColumnView();
    setHint(`Ran saved recipe — ${state.rows.length} row(s). Walk pages or Export.`);
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
