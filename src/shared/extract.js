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
   * 1. title attribute (often contains full text when display is ellipsis-truncated)
   * 2. aria-label (accessible alternative text)
   * 3. textContent (actual display text)
   */
  function extractText(el) {
    if (!(el instanceof Element)) return "";
    
    const textContent = normalizeText(el.textContent);
    
    // If element has a title attribute with meaningful content, prefer it
    const title = el.getAttribute("title");
    if (title) {
      const normalizedTitle = normalizeText(title);
      // Use title if it's longer than textContent or if textContent has ellipsis
      if (normalizedTitle && (normalizedTitle.length > textContent.length || textContent.includes("..."))) {
        return normalizedTitle;
      }
    }
    
    // Check aria-label as second preference
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) {
      const normalizedLabel = normalizeText(ariaLabel);
      // Use aria-label if it's longer than textContent or if textContent has ellipsis
      if (normalizedLabel && (normalizedLabel.length > textContent.length || textContent.includes("..."))) {
        return normalizedLabel;
      }
    }
    
    return textContent;
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
