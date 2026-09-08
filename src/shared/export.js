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

  NS.export = { toCsv, toJson, downloadText, exportCsv, exportJson };
})();
