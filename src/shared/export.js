(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  function toCsv(rows, columns) {
    const escape = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [columns.map(escape).join(",")];
    for (const row of rows) lines.push(columns.map((c) => escape(row[c])).join(","));
    return lines.join("\n");
  }

  function toJson(rows, columns) {
    if (Array.isArray(columns)) {
      const projected = rows.map((row) => {
        const obj = {};
        for (const c of columns) obj[c] = row[c];
        return obj;
      });
      return JSON.stringify(projected, null, 2);
    }
    return JSON.stringify(rows, null, 2);
  }

  /** Multiple tables → one CSV with a blank line between groups. */
  function toCsvTables(tables) {
    const list = Array.isArray(tables) ? tables : [];
    const parts = [];
    for (const table of list) {
      const cols = Array.isArray(table?.columns) ? table.columns : [];
      const rows = Array.isArray(table?.rows) ? table.rows : [];
      if (!cols.length) continue;
      if (parts.length) parts.push("");
      parts.push(toCsv(rows, cols));
    }
    return parts.join("\n");
  }

  /** Multiple tables → JSON array of { name?, columns, rows } (projected). */
  function toJsonTables(tables) {
    const list = Array.isArray(tables) ? tables : [];
    const out = list.map((table) => {
      const cols = Array.isArray(table?.columns) ? table.columns : [];
      const rows = Array.isArray(table?.rows) ? table.rows : [];
      const entry = {
        columns: cols.slice(),
        rows: cols.length
          ? rows.map((row) => {
              const obj = {};
              for (const c of cols) obj[c] = row?.[c];
              return obj;
            })
          : rows.slice(),
      };
      const name = String(table?.name || "").trim();
      if (name) entry.name = name;
      return entry;
    });
    return JSON.stringify(out, null, 2);
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv(rows, columns, baseName = "click-scrape") {
    downloadText(`${baseName}.csv`, toCsv(rows, columns), "text/csv;charset=utf-8");
  }

  function exportCsvTables(tables, baseName = "click-scrape") {
    downloadText(`${baseName}.csv`, toCsvTables(tables), "text/csv;charset=utf-8");
  }

  function exportJson(rows, columnsOrBaseName, baseName = "click-scrape") {
    let columns;
    let name = baseName;

    if (Array.isArray(columnsOrBaseName)) {
      columns = columnsOrBaseName;
    } else if (typeof columnsOrBaseName === "string") {
      name = columnsOrBaseName;
    }

    downloadText(`${name}.json`, toJson(rows, columns), "application/json");
  }

  function exportJsonTables(tables, baseName = "click-scrape") {
    downloadText(`${baseName}.json`, toJsonTables(tables), "application/json");
  }

  NS.export = {
    toCsv,
    toJson,
    toCsvTables,
    toJsonTables,
    downloadText,
    exportCsv,
    exportCsvTables,
    exportJson,
    exportJsonTables,
  };
})();
