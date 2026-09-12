(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});
  const PREVIEW_LIMIT = 200;

  let columnHandlers = {};
  let rowHandlers = {};
  let sessionHandlers = {};
  let visibleColumns = [];
  let rowEditingEnabled = false;

  function setColumnHandlers(handlers) {
    columnHandlers = handlers && typeof handlers === "object" ? handlers : {};
  }

  function setRowHandlers(handlers) {
    rowHandlers = handlers && typeof handlers === "object" ? handlers : {};
    rowEditingEnabled = Object.keys(rowHandlers).length > 0;
  }

  function setSessionHandlers(handlers) {
    sessionHandlers = handlers && typeof handlers === "object" ? handlers : {};
  }

  function getVisibleColumns() {
    return visibleColumns.slice();
  }

  function callHandler(bag, name, ...args) {
    const fn = bag[name];
    if (typeof fn === "function") fn(...args);
  }

  function parseGroup(el) {
    const group = el.getAttribute("data-cs-group");
    return group == null || group === "" ? undefined : Number(group);
  }

  function ensureOverlay() {
    let el = document.getElementById("click-scrape-overlay");
    // Rebuild if an older inject left a panel without Edit recipe.
    if (el && !el.querySelector("#cs-edit-recipe")) {
      el.remove();
      el = null;
    }
    if (el) {
      bindOverlayUi(el);
      return el;
    }
    el = document.createElement("div");
    el.id = "click-scrape-overlay";
    el.innerHTML = `
      <h2>Nestix</h2>
      <p class="cs-hint">Hover and click to add columns. Esc cancels.</p>
      <div class="cs-row">
        <input id="cs-field-name" placeholder="Column name (e.g. Title)" />
        <button type="button" id="cs-undo" class="secondary">Undo</button>
      </div>
      <ul class="cs-fields" id="cs-fields"></ul>
      <div class="cs-row">
        <button type="button" id="cs-export-csv">Export CSV</button>
        <button type="button" id="cs-export-json" class="secondary">Export JSON</button>
        <button type="button" id="cs-edit-recipe" class="secondary" hidden>Edit recipe</button>
        <button type="button" id="cs-save" class="secondary">Save recipe</button>
        <button type="button" id="cs-stop" class="danger">Stop</button>
      </div>
      <div id="cs-preview"></div>
    `;
    document.documentElement.appendChild(el);
    bindOverlayUi(el);
    return el;
  }

  function bindOverlayUi(el) {
    if (el.dataset.csColUi === "1") return;
    el.dataset.csColUi = "1";

    el.addEventListener("click", (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;

      const editRecipe = t.closest("#cs-edit-recipe");
      if (editRecipe && el.contains(editRecipe) && !editRecipe.disabled && !editRecipe.hidden) {
        e.preventDefault();
        e.stopPropagation();
        callHandler(sessionHandlers, "onEditRecipe");
        return;
      }

      const delRow = t.closest("[data-cs-del-row]");
      if (delRow && el.contains(delRow) && !delRow.disabled) {
        e.preventDefault();
        const rowIndex = Number(delRow.getAttribute("data-cs-del-row"));
        callHandler(rowHandlers, "onDeleteRow", parseGroup(delRow), rowIndex);
        return;
      }

      const addRow = t.closest("[data-cs-add-row]");
      if (addRow && el.contains(addRow) && !addRow.disabled) {
        e.preventDefault();
        callHandler(rowHandlers, "onAddRow", parseGroup(addRow));
        return;
      }

      const resetRows = t.closest("[data-cs-reset-rows]");
      if (resetRows && el.contains(resetRows) && !resetRows.disabled) {
        e.preventDefault();
        callHandler(rowHandlers, "onResetRows", parseGroup(resetRows));
        return;
      }

      const drop = t.closest("[data-cs-drop]");
      if (drop && el.contains(drop) && !drop.disabled) {
        e.preventDefault();
        const name = drop.getAttribute("data-cs-drop");
        if (name) callHandler(columnHandlers, "onDrop", name, parseGroup(drop));
        return;
      }

      const adjust = t.closest("[data-cs-adjust]");
      if (adjust && el.contains(adjust) && !adjust.disabled) {
        e.preventDefault();
        const name = adjust.getAttribute("data-cs-adjust");
        const dir = Number(adjust.getAttribute("data-cs-dir"));
        if (name && (dir === -1 || dir === 1)) {
          callHandler(columnHandlers, "onAdjustField", name, dir, parseGroup(adjust));
        }
        return;
      }

      const move = t.closest("[data-cs-move]");
      if (move && el.contains(move) && !move.disabled) {
        e.preventDefault();
        const name = move.getAttribute("data-cs-move");
        const dir = Number(move.getAttribute("data-cs-dir"));
        if (name && (dir === -1 || dir === 1)) {
          callHandler(columnHandlers, "onMove", name, dir, parseGroup(move));
        }
        return;
      }

      if (t.tagName === "INPUT") return;
      const rename = t.closest("[data-cs-rename]");
      if (rename && el.contains(rename) && !rename.closest("[data-cs-cell]")) {
        e.preventDefault();
        startRename(rename);
      }
    });

    el.addEventListener("focusout", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.hasAttribute("data-cs-cell")) return;
      if (!el.contains(t)) return;
      const col = t.getAttribute("data-cs-col");
      const rowIndex = Number(t.getAttribute("data-cs-row"));
      const text = t.textContent ?? "";
      t.classList.toggle("cs-cell-empty", !String(text).trim());
      t.title = String(text).trim() ? text : "Click to edit";
      callHandler(rowHandlers, "onEditCell", parseGroup(t), rowIndex, col, text);
    });

    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t instanceof Element && t.hasAttribute("data-cs-cell")) {
        e.preventDefault();
        t.blur();
        return;
      }
      if (t.tagName === "INPUT") return;
      const rename = t.closest("[data-cs-rename]");
      if (rename && el.contains(rename) && t === rename) {
        e.preventDefault();
        startRename(rename);
      }
    });
  }

  function startRename(nameEl) {
    if (nameEl.querySelector("input")) return;
    const oldName = nameEl.getAttribute("data-cs-rename") || "";
    const groupIndex = parseGroup(nameEl);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "cs-th-input";
    input.value = oldName;
    input.setAttribute("aria-label", "Rename column");
    nameEl.replaceChildren(input);
    input.focus();
    input.select();

    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      nameEl.textContent = oldName;
      if (save && next && next !== oldName) {
        callHandler(columnHandlers, "onRename", oldName, next, groupIndex);
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        commit(false);
      }
    });
    input.addEventListener("blur", () => commit(true));
  }

  function renderFields(fields) {
    const ul = document.getElementById("cs-fields");
    if (!ul) return;
    const list = Array.isArray(fields) ? fields : [];
    ul.innerHTML = list
      .map((f) => {
        const name = f?.name ?? "";
        const sel = f?.relativeSelector ?? "";
        const sample = String(f?.sample ?? "").trim();
        const gi = f?.groupIndex;
        const groupAttr = gi == null ? "" : ` data-cs-group="${escapeHtml(String(gi))}"`;
        const broadOff = f?.canBroader ? "" : " disabled";
        const narrowOff = f?.canNarrower ? "" : " disabled";
        const sampleHtml = sample
          ? `<span class="cs-field-sample" title="${escapeHtml(sample)}">${escapeHtml(sample)}</span>`
          : `<span class="cs-field-sample cs-field-sample-empty">No text at this level</span>`;
        return `<li class="cs-field">
          <div class="cs-field-main">
            <strong class="cs-field-name">${escapeHtml(name)}</strong>
            <span class="cs-field-adjust">
              <button type="button" class="cs-col-btn" data-cs-adjust="${escapeHtml(name)}" data-cs-dir="-1"${groupAttr} title="Broader — select a larger area"${broadOff}>Broader</button>
              <button type="button" class="cs-col-btn" data-cs-adjust="${escapeHtml(name)}" data-cs-dir="1"${groupAttr} title="Narrower — select a smaller area"${narrowOff}>Narrower</button>
            </span>
            <button type="button" class="cs-col-btn cs-col-drop" data-cs-drop="${escapeHtml(name)}"${groupAttr} title="Remove column">×</button>
          </div>
          ${sampleHtml}
          <code class="cs-field-sel" hidden title="${escapeHtml(sel)}">${escapeHtml(sel)}</code>
        </li>`;
      })
      .join("");
  }

  function emptyCopy(rows, columns, options) {
    if (typeof options.empty === "string") return options.empty;
    if (!columns.length) return "Click elements to add columns.";
    if (!rows.length) {
      if (options.pagination) return "Pagination in progress…";
      // Editable tables can start empty — still render chrome for Add row.
      if (rowEditingEnabled && !options.forceEmpty) return "";
      return "No rows matched.";
    }
    return "";
  }

  function renderTableHtml(rows, columns, groupIndex, options = {}) {
    const rowList = Array.isArray(rows) ? rows : [];
    const cols = Array.isArray(columns) ? columns : [];
    const gi = groupIndex == null ? "" : String(groupIndex);
    const slice = rowList.slice(0, PREVIEW_LIMIT);
    const last = cols.length - 1;
    const groupAttr = gi === "" ? "" : ` data-cs-group="${escapeHtml(gi)}"`;
    const dirty = !!options.rowsDirty;
    const editing = rowEditingEnabled && !options.pagination;
    const disabledAttr = editing ? "" : " disabled";
    const tableIndex = Number(gi);
    const tableLabel =
      Number.isFinite(tableIndex) && tableIndex >= 0 ? `Table ${tableIndex + 1}` : "Preview";

    const headCells = cols
      .map((c, i) => {
        const upOff = i === 0 ? " disabled" : "";
        const downOff = i === last ? " disabled" : "";
        return `<th data-cs-col="${escapeHtml(c)}"${groupAttr}>
          <div class="cs-th">
            <span class="cs-th-name" data-cs-rename="${escapeHtml(c)}" data-cs-group="${escapeHtml(gi)}" tabindex="0" title="Rename column">${escapeHtml(c)}</span>
            <span class="cs-th-actions">
              <button type="button" class="cs-col-btn" data-cs-move="${escapeHtml(c)}" data-cs-dir="-1" data-cs-group="${escapeHtml(gi)}" title="Move column left"${upOff}>↑</button>
              <button type="button" class="cs-col-btn" data-cs-move="${escapeHtml(c)}" data-cs-dir="1" data-cs-group="${escapeHtml(gi)}" title="Move column right"${downOff}>↓</button>
              <button type="button" class="cs-col-btn cs-col-drop" data-cs-drop="${escapeHtml(c)}" data-cs-group="${escapeHtml(gi)}" title="Remove column">×</button>
            </span>
          </div>
        </th>`;
      })
      .join("");
    const head = editing
      ? `${headCells}<th class="cs-row-actions-head" aria-label="Row actions"></th>`
      : headCells;

    const body =
      slice.length === 0 && editing
        ? `<tr class="cs-empty-row"><td colspan="${cols.length + 1}"><span class="cs-empty-row-msg">No rows yet — click a cell area after Add row, or pick on the page.</span></td></tr>`
        : slice
            .map((row, rowIndex) => {
              const cells = cols
                .map((c) => {
                  const val = row?.[c] ?? "";
                  if (editing) {
                    const emptyClass = val === "" ? " cs-cell-empty" : "";
                    return `<td class="cs-cell${emptyClass}" contenteditable="true" data-cs-cell="1" data-cs-row="${rowIndex}" data-cs-col="${escapeHtml(c)}" data-cs-group="${escapeHtml(gi)}" data-placeholder="Edit…" title="${escapeHtml(val) || "Click to edit"}">${escapeHtml(val)}</td>`;
                  }
                  return `<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
                })
                .join("");
              if (!editing) return `<tr>${cells}</tr>`;
              return `<tr class="cs-data-row">
          ${cells}
          <td class="cs-row-actions">
            <button type="button" class="cs-col-btn cs-col-drop cs-del-row" data-cs-del-row="${rowIndex}" data-cs-group="${escapeHtml(gi)}" title="Delete this row"${disabledAttr} aria-label="Delete row">×</button>
          </td>
        </tr>`;
            })
            .join("");

    const footer = editing
      ? `<div class="cs-table-actions">
          <button type="button" class="secondary cs-row-btn cs-add-row" data-cs-add-row="1" data-cs-group="${escapeHtml(gi)}"${disabledAttr}>+ Add row</button>
          <button type="button" class="secondary cs-row-btn cs-reset-rows" data-cs-reset-rows="1" data-cs-group="${escapeHtml(gi)}" title="Discard edits and re-scrape this table from the page"${dirty ? "" : " disabled"}>Reset from page</button>
        </div>`
      : "";

    const shownNote =
      rowList.length > slice.length
        ? `${rowList.length} rows · showing ${slice.length}`
        : `${rowList.length} row${rowList.length === 1 ? "" : "s"}`;

    const dirtyBadge = dirty
      ? `<span class="cs-dirty-badge" title="Edits apply to Export; Reset to re-scrape">Edited</span>`
      : `<span class="cs-dirty-badge cs-dirty-badge-off" hidden>Edited</span>`;

    return `<div class="cs-preview-table${dirty ? " cs-dirty" : ""}"${groupAttr}>
      <div class="cs-table-toolbar">
        <span class="cs-table-label">${escapeHtml(tableLabel)}</span>
        ${dirtyBadge}
      </div>
      <div class="cs-table-scroll">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${footer}
      <p class="cs-table-meta cs-hint">${shownNote}${editing ? " · click cells to edit" : ""}</p>
    </div>`;
  }

  function renderPreview(rows, columns, options) {
    const box = document.getElementById("cs-preview");
    if (!box) return;
    const opts = options && typeof options === "object" ? options : {};
    const tables = Array.isArray(opts.tables) ? opts.tables : null;

    if (tables) {
      visibleColumns = tables.flatMap((t) => (Array.isArray(t?.columns) ? t.columns : []));
      const usable = tables.filter((t) => Array.isArray(t?.columns) && t.columns.length);
      if (!usable.length) {
        const empty = emptyCopy([], [], { ...opts, forceEmpty: true });
        box.innerHTML = `<p class="cs-empty">${escapeHtml(empty || "Click elements to add columns.")}</p>`;
        return;
      }
      box.innerHTML = usable
        .map((t, i) =>
          renderTableHtml(t.rows || [], t.columns || [], t.groupIndex ?? i, {
            pagination: opts.pagination,
            rowsDirty: !!t.rowsDirty,
          })
        )
        .join("");
      return;
    }

    const rowList = Array.isArray(rows) ? rows : [];
    const cols = Array.isArray(columns) ? columns : [];
    visibleColumns = cols.slice();

    const empty = emptyCopy(rowList, cols, opts);
    if (empty) {
      box.innerHTML = `<p class="cs-empty">${escapeHtml(empty)}</p>`;
      return;
    }

    if (!cols.length) {
      box.innerHTML = `<p class="cs-empty">Click elements to add columns.</p>`;
      return;
    }

    box.innerHTML = renderTableHtml(rowList, cols, opts.groupIndex, {
      pagination: opts.pagination,
      rowsDirty: !!opts.rowsDirty,
    });
  }

  function markTableDirty(groupIndex, dirty) {
    const gi = groupIndex == null ? "" : String(groupIndex);
    const root = document.getElementById("cs-preview");
    if (!root) return;
    const table =
      gi === ""
        ? root.querySelector(".cs-preview-table")
        : root.querySelector(`.cs-preview-table[data-cs-group="${gi}"]`);
    if (!table) return;
    table.classList.toggle("cs-dirty", !!dirty);
    const badge = table.querySelector(".cs-dirty-badge");
    if (badge) {
      badge.hidden = !dirty;
      badge.classList.toggle("cs-dirty-badge-off", !dirty);
    }
    const reset = table.querySelector("[data-cs-reset-rows]");
    if (reset) reset.disabled = !dirty;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function removeOverlay() {
    document.getElementById("click-scrape-overlay")?.remove();
    visibleColumns = [];
  }

  NS.overlay = {
    ensureOverlay,
    renderFields,
    renderPreview,
    removeOverlay,
    escapeHtml,
    setColumnHandlers,
    setRowHandlers,
    setSessionHandlers,
    getVisibleColumns,
    markTableDirty,
  };
})();
