(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  function visibleColumns(columnOrder, hiddenColumns) {
    const hidden = new Set(hiddenColumns || []);
    return (columnOrder || []).filter((name) => name && !hidden.has(name));
  }

  function uniqueName(desired, usedNames) {
    const used = new Set(usedNames || []);
    if (!used.has(desired)) return desired;
    let n = 2;
    let candidate = `${desired} ${n}`;
    while (used.has(candidate)) {
      n += 1;
      candidate = `${desired} ${n}`;
    }
    return candidate;
  }

  function remapName(list, oldName, nextName) {
    return (list || []).map((name) => (name === oldName ? nextName : name));
  }

  function renameColumn(model, oldName, nextName) {
    const fields = Array.isArray(model?.fields) ? model.fields : [];
    const next = String(nextName || "").trim();
    if (!next || !oldName || next === oldName) {
      return {
        fields,
        rows: Array.isArray(model?.rows) ? model.rows : [],
        columnOrder: Array.isArray(model?.columnOrder) ? model.columnOrder.slice() : [],
        hiddenColumns: Array.isArray(model?.hiddenColumns) ? model.hiddenColumns.slice() : [],
      };
    }

    const used = fields.map((f) => f.name).filter((name) => name !== oldName);
    const name = uniqueName(next, used);

    const nextFields = fields.map((f) => (f.name === oldName ? { ...f, name } : f));
    const rows = (model?.rows || []).map((row) => {
      if (!row || !Object.prototype.hasOwnProperty.call(row, oldName)) return row;
      const copy = { ...row };
      copy[name] = copy[oldName];
      delete copy[oldName];
      return copy;
    });

    return {
      fields: nextFields,
      rows,
      columnOrder: remapName(model?.columnOrder, oldName, name),
      hiddenColumns: remapName(model?.hiddenColumns, oldName, name),
    };
  }

  function dropColumn(model, name) {
    const fields = Array.isArray(model?.fields) ? model.fields.slice() : [];
    const columnOrder = Array.isArray(model?.columnOrder) ? model.columnOrder.slice() : [];
    const hiddenColumns = Array.isArray(model?.hiddenColumns) ? model.hiddenColumns.slice() : [];
    if (!name) return { fields, columnOrder, hiddenColumns };
    const nextFields = fields.filter((f) => f.name !== name);
    const nextOrder = columnOrder.filter((n) => n !== name);
    const nextHidden = hiddenColumns.filter((n) => n !== name);
    return { fields: nextFields, columnOrder: nextOrder, hiddenColumns: nextHidden };
  }

  function moveColumn(columnOrder, name, dir) {
    const order = Array.isArray(columnOrder) ? columnOrder.slice() : [];
    const idx = order.indexOf(name);
    const next = idx + Number(dir);
    if (idx < 0 || next < 0 || next >= order.length) return order;
    const tmp = order[idx];
    order[idx] = order[next];
    order[next] = tmp;
    return order;
  }

  function applyPick(name, model) {
    const fields = Array.isArray(model?.fields) ? model.fields.map((f) => ({ ...f })) : [];
    const columnOrder = Array.isArray(model?.columnOrder) ? model.columnOrder.slice() : [];
    const hiddenColumns = Array.isArray(model?.hiddenColumns) ? model.hiddenColumns.slice() : [];
    const desired = String(name || "").trim();
    if (!desired) {
      return { fields, columnOrder, hiddenColumns, name: desired, added: false };
    }

    if (hiddenColumns.includes(desired)) {
      return {
        fields,
        columnOrder: columnOrder.includes(desired) ? columnOrder : columnOrder.concat(desired),
        hiddenColumns: hiddenColumns.filter((n) => n !== desired),
        name: desired,
        added: false,
      };
    }

    const resolved = uniqueName(
      desired,
      fields.map((f) => f.name)
    );
    const relativeSelector = model?.relativeSelector != null ? String(model.relativeSelector) : "";
    return {
      fields: fields.concat([{ name: resolved, relativeSelector }]),
      columnOrder: columnOrder.includes(resolved) ? columnOrder : columnOrder.concat(resolved),
      hiddenColumns,
      name: resolved,
      added: true,
    };
  }

  NS.columns = { visibleColumns, uniqueName, renameColumn, dropColumn, moveColumn, applyPick };
})();
