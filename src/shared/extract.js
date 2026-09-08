(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

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

  function extractRows(recipe, doc = document) {
    if (!recipe?.rootSelector) return [];
    const root = doc.querySelector(recipe.rootSelector);
    if (!root) return [];
    const items = NS.selectors.queryItems(root, recipe.itemSelector || "*");
    return items.map((item) => {
      const row = {};
      for (const field of recipe.fields || []) {
        let el = null;
        try {
          el = queryField(item, field.relativeSelector);
        } catch {
          el = null;
        }
        row[field.name] = (el?.textContent || "").replace(/\s+/g, " ").trim();
      }
      return row;
    });
  }

  NS.extract = { extractRows };
})();
