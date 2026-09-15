(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract text from an element, preferring fuller sources when the display text is truncated.
   * Order of preference:
   * 1. own title / aria-label when fuller than textContent (or text has ellipsis)
   * 2. descendant [title] / [aria-label] when own text is empty or ellipsis-truncated
   * 3. textContent
   */
  function attrText(el, attr) {
    if (!(el instanceof Element)) return "";
    try {
      return normalizeText(el.getAttribute(attr));
    } catch {
      return "";
    }
  }

  function preferFiller(textContent, filler) {
    if (!filler) return null;
    if (!textContent || textContent.includes("...") || filler.length > textContent.length) {
      return filler;
    }
    return null;
  }

  function extractText(el) {
    if (!(el instanceof Element)) return "";

    const textContent = normalizeText(el.textContent);

    for (const attr of ["title", "aria-label"]) {
      const preferred = preferFiller(textContent, attrText(el, attr));
      if (preferred) return preferred;
    }

    // Picking an h3 (or similar wrapper) whose child a[title] holds the full name.
    if (!textContent || textContent.includes("...")) {
      let best = "";
      try {
        const nodes = el.querySelectorAll("a[title], [title], [aria-label]");
        for (const node of nodes) {
          for (const attr of ["title", "aria-label"]) {
            const v = attrText(node, attr);
            if (v && v.length > best.length) best = v;
          }
        }
      } catch {
        /* ignore */
      }
      const preferred = preferFiller(textContent, best);
      if (preferred) return preferred;
    }

    return textContent;
  }

  /** Stable per-item identity for merge dedupe (not exported). */
  function itemIdentity(item) {
    if (!(item instanceof Element)) return "";
    try {
      const link =
        item.querySelector("a.title[href]") ||
        item.querySelector("h3 a[href]") ||
        item.querySelector("a[href]");
      const href = link?.getAttribute?.("href");
      return href ? String(href).trim() : "";
    } catch {
      return "";
    }
  }

  function queryField(item, relativeSelector) {
    const rel = (relativeSelector || "").trim();
    if (!rel || rel === ":scope") return item;

    const candidates = [];
    if (rel.startsWith(":scope")) {
      const rest = rel.slice(":scope".length).trim();
      if (!rest) return item;
      candidates.push(rest);
      const withoutComb = rest.replace(/^[>\s+~]+/, "").trim();
      if (withoutComb && withoutComb !== rest) candidates.push(withoutComb);
      candidates.push(rel);
    } else {
      candidates.push(rel);
    }

    for (const selector of candidates) {
      try {
        const el = item.querySelector(selector);
        if (el) return el;
      } catch {
        /* try next candidate */
      }
    }
    return null;
  }

  function resolveRoot(recipe, doc = document) {
    if (!recipe?.rootSelector || !doc?.querySelector) return null;
    try {
      return doc.querySelector(recipe.rootSelector);
    } catch {
      return null;
    }
  }

  /** Resolve repeating item elements from a saved recipe. */
  function retrieveItems(recipe, doc = document) {
    const root = resolveRoot(recipe, doc);
    if (!root) return [];
    return NS.selectors.queryItems(root, recipe.itemSelector || "*");
  }

  function rowFromItem(item, fields) {
    const row = {};
    for (const field of fields || []) {
      let el = null;
      try {
        el = queryField(item, field.relativeSelector);
      } catch {
        el = null;
      }
      row[field.name] = extractText(el);
    }
    const id = itemIdentity(item);
    if (id) row.__itemId = id;
    return row;
  }

  /** Map already-resolved item nodes → row objects. */
  function retrieveRowsFromItems(items, fields) {
    return (items || []).map((item) => rowFromItem(item, fields));
  }

  /** Recipe → items → rows (selector re-query path). */
  function retrieveRows(recipe, doc = document) {
    const items = retrieveItems(recipe, doc);
    return retrieveRowsFromItems(items, recipe?.fields);
  }

  /**
   * Live retrieve from a picked element: discover list context, then map fields.
   * Prefers the live `ctx.items` peer group; falls back to selector re-query.
   */
  function retrieveFromElement(fieldEl, fields = [], doc = document) {
    const ctx = NS.selectors.findListContext(fieldEl);
    const recipe = {
      rootSelector: ctx.rootSelector,
      itemSelector: ctx.itemSelector,
      fields: fields || [],
    };
    const liveItems = Array.isArray(ctx.items) ? ctx.items.filter((n) => n?.nodeType === 1) : [];
    if (liveItems.length) {
      return {
        recipe,
        items: liveItems,
        rows: retrieveRowsFromItems(liveItems, fields),
        context: ctx,
        source: "live",
      };
    }
    const items = retrieveItems(recipe, doc);
    return {
      recipe,
      items,
      rows: retrieveRowsFromItems(items, fields),
      context: ctx,
      source: "selectors",
    };
  }

  /** Full retrieve for a recipe: items + rows (for highlight + preview). */
  function retrieve(recipe, doc = document) {
    const items = retrieveItems(recipe, doc);
    return {
      root: resolveRoot(recipe, doc),
      items,
      rows: retrieveRowsFromItems(items, recipe?.fields),
      source: "selectors",
    };
  }

  // Back-compat alias used by content / pagination / tests.
  function extractRows(recipe, doc = document) {
    return retrieveRows(recipe, doc);
  }

  NS.extract = {
    normalizeText,
    extractText,
    itemIdentity,
    queryField,
    resolveRoot,
    retrieveItems,
    retrieveRowsFromItems,
    retrieveRows,
    retrieveFromElement,
    retrieve,
    extractRows,
  };
})();
