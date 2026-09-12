(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});
  const PREVIEW_LIMIT = 20;

  let columnHandlers = {};
  let visibleColumns = [];

  function setColumnHandlers(handlers) {
    columnHandlers = handlers && typeof handlers === "object" ? handlers : {};
  }

  function getVisibleColumns() {
    return visibleColumns.slice();
  }

  function callHandler(name, ...args) {
    const fn = columnHandlers[name];
    if (typeof fn === "function") fn(...args);
  }

  function ensureOverlay() {
    let el = document.getElementById("click-scrape-overlay");
    if (el) {
      bindOverlayUi(el);
      return el;
    }
    el = document.createElement("div");
    el.id = "click-scrape-overlay";
    el.innerHTML = `
      <h2>Nestix</h2>
      <p class="cs-hint">Hover and click elements to add columns. Esc cancels.</p>
      <div class="cs-row">
        <input id="cs-field-name" placeholder="Column name (e.g. Title)" />
        <button type="button" id="cs-undo" class="secondary">Undo</button>
      </div>
      <ul class="cs-fields" id="cs-fields"></ul>
      <div class="cs-row">
        <button type="button" id="cs-export-csv">Export CSV</button>
        <button type="button" id="cs-export-json" class="secondary">Export JSON</button>
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

      const drop = t.closest("[data-cs-drop]");
      if (drop && el.contains(drop) && !drop.disabled) {
        e.preventDefault();
        const name = drop.getAttribute("data-cs-drop");
        const group = drop.getAttribute("data-cs-group");
        if (name) callHandler("onDrop", name, group == null || group === "" ? undefined : Number(group));
        return;
      }

      const move = t.closest("[data-cs-move]");
      if (move && el.contains(move) && !move.disabled) {
        e.preventDefault();
        const name = move.getAttribute("data-cs-move");
        const dir = Number(move.getAttribute("data-cs-dir"));
        const group = move.getAttribute("data-cs-group");
        if (name && (dir === -1 || dir === 1)) {
          callHandler("onMove", name, dir, group == null || group === "" ? undefined : Number(group));
        }
        return;
      }

      if (t.tagName === "INPUT") return;
      const rename = t.closest("[data-cs-rename]");
      if (rename && el.contains(rename)) {
        e.preventDefault();
        startRename(rename);
      }
    });

    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const t = e.target;
      if (!t || t.tagName === "INPUT" || typeof t.closest !== "function") return;
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
    const groupAttr = nameEl.getAttribute("data-cs-group");
    const groupIndex = groupAttr == null || groupAttr === "" ? undefined : Number(groupAttr);
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
      if (save && next && next !== oldName) callHandler("onRename", oldName, next, groupIndex);
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
        const gi = f?.groupIndex;
        const groupAttr = gi == null ? "" : ` data-cs-group="${escapeHtml(String(gi))}"`;
        return `<li class="cs-field">
          <div class="cs-field-main">
            <strong class="cs-field-name">${escapeHtml(name)}</strong>
            <button type="button" class="cs-col-btn cs-col-drop" data-cs-drop="${escapeHtml(name)}"${groupAttr} title="Remove column">×</button>
          </div>
          <code class="cs-field-sel" title="${escapeHtml(sel)}">${escapeHtml(sel)}</code>
        </li>`;
      })
      .join("");
  }

  function emptyCopy(rows, columns, options) {
    if (typeof options.empty === "string") return options.empty;
    if (!columns.length) return "Click elements to add columns.";
    if (!rows.length) {
      if (options.pagination) return "Pagination in progress…";
      return "No rows matched.";
    }
    return "";
  }

  function renderTableHtml(rows, columns, groupIndex) {
    const rowList = Array.isArray(rows) ? rows : [];
    const cols = Array.isArray(columns) ? columns : [];
    const gi = groupIndex == null ? "" : String(groupIndex);
    const slice = rowList.slice(0, PREVIEW_LIMIT);
    const last = cols.length - 1;
    const groupAttr = gi === "" ? "" : ` data-cs-group="${escapeHtml(gi)}"`;
    const head = cols
      .map((c, i) => {
        const upOff = i === 0 ? " disabled" : "";
        const downOff = i === last ? " disabled" : "";
        return `<th data-cs-col="${escapeHtml(c)}"${groupAttr}>
          <div class="cs-th">
            <span class="cs-th-name" data-cs-rename="${escapeHtml(c)}" data-cs-group="${escapeHtml(gi)}" tabindex="0" title="Rename column">${escapeHtml(c)}</span>
            <span class="cs-th-actions">
              <button type="button" class="cs-col-btn" data-cs-move="${escapeHtml(c)}" data-cs-dir="-1" data-cs-group="${escapeHtml(gi)}" title="Move up"${upOff}>↑</button>
              <button type="button" class="cs-col-btn" data-cs-move="${escapeHtml(c)}" data-cs-dir="1" data-cs-group="${escapeHtml(gi)}" title="Move down"${downOff}>↓</button>
              <button type="button" class="cs-col-btn cs-col-drop" data-cs-drop="${escapeHtml(c)}" data-cs-group="${escapeHtml(gi)}" title="Drop column">×</button>
            </span>
          </div>
        </th>`;
      })
      .join("");
    const body = slice
      .map(
        (row) =>
          `<tr>${cols
            .map((c) => {
              const val = row?.[c] || "";
              return `<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
            })
            .join("")}</tr>`
      )
      .join("");
    return `<div class="cs-preview-table"${groupAttr}>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="cs-hint">${rowList.length} row(s) — showing ${slice.length}</p>
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
        const empty = emptyCopy([], [], opts);
        box.innerHTML = `<p class="cs-empty">${escapeHtml(empty || "Click elements to add columns.")}</p>`;
        return;
      }
      box.innerHTML = usable
        .map((t, i) => renderTableHtml(t.rows || [], t.columns || [], t.groupIndex ?? i))
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

    box.innerHTML = renderTableHtml(rowList, cols, opts.groupIndex);
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
    getVisibleColumns,
  };
})();
