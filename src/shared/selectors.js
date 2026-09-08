(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  const MAX_WALK = 12;
  const MAX_CLASSES = 3;
  const SIMILARITY_MIN = 0.4;
  const ITEM_CLASS_HINT = /(product|card|item|result|row|listing|entry|post|tile|record)/i;
  const SEMANTIC_ITEMS = new Set(["ARTICLE", "LI", "TR", "SECTION"]);
  const LAYOUT_TAGS = new Set(["HEADER", "NAV", "FOOTER", "ASIDE", "MAIN", "BODY", "HTML"]);

  function stableClasses(el) {
    if (!el?.classList) return [];
    return [...el.classList].filter((c) => c && !c.startsWith("click-scrape-"));
  }

  function classSuffix(names) {
    return names
      .slice(0, MAX_CLASSES)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
  }

  function siblingIndexOfType(el) {
    const parent = el.parentElement;
    if (!parent) return 1;
    const ofType = [...parent.children].filter((c) => c.tagName === el.tagName);
    return ofType.indexOf(el) + 1;
  }

  function matchesAmongSiblings(el, selector) {
    const parent = el.parentElement;
    if (!parent) return [el];
    try {
      return [...parent.children].filter((c) => c.matches(selector));
    } catch {
      return [...parent.children].filter((c) => c.tagName === el.tagName);
    }
  }

  /** Tag + classes; nth-of-type only when that is not unique among siblings. */
  function partFor(el, { allowNth = true } = {}) {
    const tag = el.tagName.toLowerCase();
    const classes = stableClasses(el).slice(0, 2);
    let part = tag + classSuffix(classes);
    if (el.id) return `${tag}#${CSS.escape(el.id)}`;
    if (allowNth && matchesAmongSiblings(el, part).length > 1) {
      part += `:nth-of-type(${siblingIndexOfType(el)})`;
    }
    return part;
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && node !== document.documentElement) {
      if (node.id) {
        parts.unshift(`${node.tagName.toLowerCase()}#${CSS.escape(node.id)}`);
        break;
      }
      parts.unshift(partFor(node, { allowNth: true }));
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function similarity(a, b) {
    if (a.tagName !== b.tagName) return 0;
    const ca = new Set(stableClasses(a));
    const cb = new Set(stableClasses(b));
    if (!ca.size && !cb.size) return 0.5;
    let overlap = 0;
    for (const c of ca) if (cb.has(c)) overlap += 1;
    return overlap / Math.max(ca.size, cb.size, 1);
  }

  function sharedClasses(elements) {
    if (!elements.length) return [];
    let shared = stableClasses(elements[0]);
    for (let i = 1; i < elements.length; i += 1) {
      const set = new Set(stableClasses(elements[i]));
      shared = shared.filter((c) => set.has(c));
    }
    return shared;
  }

  /** CSS selector for repeating items under a list root (tag + shared classes when possible). */
  function itemSelectorFor(sample, peers) {
    const tag = sample.tagName.toLowerCase();
    const shared = sharedClasses(peers.length ? peers : [sample]);
    if (shared.length) return tag + classSuffix(shared);
    const own = stableClasses(sample);
    if (own.length) return tag + classSuffix(own);
    return tag;
  }

  function descendantCount(el) {
    return el.querySelectorAll("*").length;
  }

  function countFieldMatches(items, sample, fieldEl) {
    if (sample === fieldEl) return items.length;
    if (!sample.contains(fieldEl)) return 0;
    const rel = relativePathFrom(sample, fieldEl);
    const rest = stripScope(rel);
    if (!rest) return items.length;
    let n = 0;
    for (const item of items) {
      try {
        if (item.querySelector(rest)) n += 1;
      } catch {
        /* ignore invalid */
      }
    }
    return n;
  }

  function scoreCandidate(c, fieldEl) {
    const classes = stableClasses(c.item);
    const semantic =
      SEMANTIC_ITEMS.has(c.item.tagName) || classes.some((cl) => ITEM_CLASS_HINT.test(cl));
    const descendants = descendantCount(c.item);
    const isRecord = c.item !== fieldEl && descendants >= 2;
    const matches = countFieldMatches(c.items, c.item, fieldEl);
    const matchRatio = matches / Math.max(c.items.length, 1);

    let score = 0;
    score += c.items.length * 12;
    score += Math.min(descendants, 24);
    score += matchRatio * 20;
    if (semantic) score += 22;
    if (classes.length) score += 10;
    if (isRecord) score += 16;
    if (c.root === document.body || c.root === document.documentElement) score -= 28;
    if (LAYOUT_TAGS.has(c.item.tagName)) score -= 24;
    if (descendants > 60) score -= Math.min(40, descendants - 60);
    if (c.items.length === 2 && descendants > 30) score -= 20;
    return score;
  }

  function collectCandidates(fieldEl) {
    const candidates = [];
    let node = fieldEl;
    for (let depth = 0; depth < MAX_WALK && node && node !== document.body; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.documentElement) break;
      const sameTag = [...parent.children].filter((c) => c.tagName === node.tagName);
      if (sameTag.length >= 2) {
        const similar = sameTag.filter((s) => similarity(s, node) >= SIMILARITY_MIN);
        if (similar.length >= 2) {
          candidates.push({ item: node, root: parent, items: similar });
        }
      }
      node = parent;
    }
    return candidates;
  }

  function pickCandidate(candidates, fieldEl) {
    if (!candidates.length) return null;
    let best = candidates[0];
    let bestScore = scoreCandidate(best, fieldEl);
    for (let i = 1; i < candidates.length; i += 1) {
      const score = scoreCandidate(candidates[i], fieldEl);
      if (score > bestScore) {
        best = candidates[i];
        bestScore = score;
      }
    }
    return best;
  }

  function findListContext(fieldEl) {
    if (!(fieldEl instanceof Element)) {
      const root = document.body || document.documentElement;
      return { root, items: [], itemSelector: "*", rootSelector: cssPath(root) || "body" };
    }

    const chosen = pickCandidate(collectCandidates(fieldEl), fieldEl);
    if (chosen) {
      return {
        root: chosen.root,
        items: chosen.items,
        itemSelector: itemSelectorFor(chosen.item, chosen.items),
        rootSelector: cssPath(chosen.root),
      };
    }

    const fallback =
      fieldEl.closest("article, li, tr, section") ||
      fieldEl.closest("[class]") ||
      fieldEl;
    const root = fallback.parentElement || document.body;
    const peers = root
      ? [...root.children].filter((c) => similarity(c, fallback) >= SIMILARITY_MIN)
      : [fallback];
    const items = peers.length ? peers : [fallback];
    return {
      root,
      items,
      itemSelector: itemSelectorFor(fallback, items),
      rootSelector: cssPath(root),
    };
  }

  function uniqueDescendantSelector(root, el) {
    if (el.id) {
      const sel = `#${CSS.escape(el.id)}`;
      try {
        if (root.querySelector(sel) === el) return sel;
      } catch {
        /* ignore */
      }
    }
    const tag = el.tagName.toLowerCase();
    const classes = stableClasses(el);
    if (classes.length) {
      const withTag = tag + classSuffix(classes);
      try {
        const hits = root.querySelectorAll(withTag);
        if (hits.length === 1 && hits[0] === el) return withTag;
      } catch {
        /* ignore */
      }
      const classOnly = classSuffix(classes);
      try {
        const hits = root.querySelectorAll(classOnly);
        if (hits.length === 1 && hits[0] === el) return classOnly;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  /** Item-relative path. Prefers `:scope ` + a unique class path; nth only when needed. */
  function relativePathFrom(from, to) {
    if (from === to) return ":scope";
    if (!(from instanceof Element) || !(to instanceof Element) || !from.contains(to)) {
      return ":scope";
    }

    const shortcut = uniqueDescendantSelector(from, to);
    if (shortcut) return `:scope ${shortcut}`;

    const chain = [];
    let node = to;
    while (node && node !== from) {
      chain.unshift(partFor(node, { allowNth: true }));
      const candidate = chain.join(" > ");
      try {
        const hits = from.querySelectorAll(candidate);
        if (hits.length === 1 && hits[0] === to) return `:scope ${candidate}`;
      } catch {
        /* keep walking */
      }
      node = node.parentElement;
    }
    return chain.length ? `:scope ${chain.join(" > ")}` : ":scope";
  }

  function containingItem(item, fieldEl) {
    if (item instanceof Element && (item === fieldEl || item.contains(fieldEl))) return item;
    const ctx = findListContext(fieldEl);
    return ctx.items.find((i) => i === fieldEl || i.contains(fieldEl)) || ctx.items[0] || item;
  }

  function relativeSelector(item, fieldEl) {
    if (!(fieldEl instanceof Element)) return ":scope";
    const from = containingItem(item, fieldEl);
    if (!(from instanceof Element)) return ":scope";
    return relativePathFrom(from, fieldEl);
  }

  function topLevelMatches(root, selector) {
    try {
      const childHits = [...root.children].filter((c) => c.matches(selector));
      if (childHits.length) return childHits;
    } catch {
      /* invalid selector */
    }
    try {
      const all = [...root.querySelectorAll(selector)];
      return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
    } catch {
      return [];
    }
  }

  function groupedChildren(root) {
    const children = [...root.children];
    if (children.length >= 2) {
      const byTag = new Map();
      for (const c of children) {
        const t = c.tagName;
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(c);
      }
      let best = children;
      for (const group of byTag.values()) if (group.length > best.length) best = group;
      return best;
    }
    return children.length ? children : [root];
  }

  function queryItems(root, itemSelector) {
    if (!root) return [];
    const sel = (itemSelector || "*").trim() || "*";
    if (sel !== "*") return topLevelMatches(root, sel);
    return groupedChildren(root);
  }

  function stripScope(rel) {
    const trimmed = (rel || "").trim();
    if (!trimmed || trimmed === ":scope") return "";
    if (trimmed.startsWith(":scope")) {
      return trimmed.slice(":scope".length).trim().replace(/^[>\s+~]+/, "").trim();
    }
    return trimmed;
  }

  NS.selectors = { cssPath, findListContext, relativeSelector, queryItems };
})();
