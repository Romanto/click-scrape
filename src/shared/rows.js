(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  function cloneRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) =>
      row && typeof row === "object" ? { ...row } : {}
    );
  }

  function updateCell(rows, rowIndex, column, value) {
    const next = cloneRows(rows);
    const i = Number(rowIndex);
    if (!column || Number.isNaN(i) || i < 0 || i >= next.length) return next;
    next[i] = { ...next[i], [column]: String(value ?? "") };
    return next;
  }

  function addRow(rows, columns) {
    const next = cloneRows(rows);
    const row = {};
    for (const col of columns || []) {
      if (col) row[col] = "";
    }
    next.push(row);
    return next;
  }

  function removeRow(rows, rowIndex) {
    const next = cloneRows(rows);
    const i = Number(rowIndex);
    if (Number.isNaN(i) || i < 0 || i >= next.length) return next;
    next.splice(i, 1);
    return next;
  }

  /** Drop a column key from every row (after column drop). */
  function stripColumn(rows, column) {
    if (!column) return cloneRows(rows);
    return cloneRows(rows).map((row) => {
      const copy = { ...row };
      delete copy[column];
      return copy;
    });
  }

  /**
   * Merge scraped values for `column` into existing rows by index.
   * Extra scraped rows are appended whole; existing rows keep other edited keys.
   */
  function mergeColumn(rows, column, scrapedRows) {
    if (!column) return cloneRows(rows);
    const base = cloneRows(rows);
    const scraped = Array.isArray(scrapedRows) ? scrapedRows : [];
    const len = Math.max(base.length, scraped.length);
    const out = [];
    for (let i = 0; i < len; i += 1) {
      if (i >= base.length) {
        out.push(scraped[i] && typeof scraped[i] === "object" ? { ...scraped[i] } : {});
        continue;
      }
      const row = { ...base[i] };
      if (scraped[i] && Object.prototype.hasOwnProperty.call(scraped[i], column)) {
        row[column] = scraped[i][column];
      } else if (!(column in row)) {
        row[column] = "";
      }
      out.push(row);
    }
    return out;
  }

  NS.rows = {
    updateCell,
    addRow,
    removeRow,
    stripColumn,
    mergeColumn,
  };
})();
