(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  const MAX_WALK = 12;
  const MAX_CLASSES = 3;
  const SIMILARITY_MIN = 0.4;
  const MAX_SIMILAR_PEERS = 80;
  const ITEM_CLASS_HINT = /(product|card|item|result|row|listing|entry|post|tile|record)/i;
  const SEMANTIC_ITEMS = new Set(["ARTICLE", "LI", "TR", "SECTION"]);
  const LAYOUT_TAGS = new Set(["HEADER", "NAV", "FOOTER", "ASIDE", "MAIN", "BODY", "HTML"]);

  function stableClasses(el) {
    if (!el?.classList) return [];
    // Filter out extension-injected classes (click-scrape-*) and ESP browser extension classes (esp-*)
    // to ensure clean, stable selectors that work across sessions and extension states.
    return [...el.classList].filter((c) => c && !c.startsWith("click-scrape-") && !c.startsWith("esp-"));
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
  function partFor(el, { allowNth = true, allowId = true } = {}) {
    const tag = el.tagName.toLowerCase();
    const classes = stableClasses(el).slice(0, 2);
    let part = tag + classSuffix(classes);
    if (allowId && el.id) return `${tag}#${CSS.escape(el.id)}`;
    if (allowNth && matchesAmongSiblings(el, part).length > 1) {
      part += `:nth-of-type(${siblingIndexOfType(el)})`;
    }
    return part;
  }

  function idSelector(el) {
    if (!el?.id) return null;
    return `${el.tagName.toLowerCase()}#${CSS.escape(el.id)}`;
  }

  /** True when this id selects exactly one node in the document (Amazon reuses ids). */
  function isUniqueId(el) {
    if (!el?.id) return false;
    const sel = idSelector(el);
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && node !== document.documentElement) {
      // Amazon reuses ids (e.g. #tp-inline-twister-dim-values-container ×3). Only stop on unique ids
      // so saved recipes rematch Size under the size expander, not Color/Pack.
      if (node.id && isUniqueId(node)) {
        parts.unshift(idSelector(node));
        break;
      }
      parts.unshift(partFor(node, { allowNth: true, allowId: false }));
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
    // One-item sessions must not rematch every page-wide .celwidget on Walk/save.
    // Only use an id when it is unique in the document.
    if (peers.length === 1 && sample?.id && isUniqueId(sample)) {
      return `#${CSS.escape(sample.id)}`;
    }
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
    const chromeOnly = classes.includes("celwidget");

    let score = 0;
    // Prefer groups where the picked field rematches across peers (avoids Amazon
    // .celwidget chrome filling the preview with empty rows).
    score += matches * 28;
    score += matchRatio * 70;
    score += Math.min(c.items.length, 12) * 4;
    score += Math.min(descendants, 24);
    if (semantic) score += 22;
    if (classes.length) score += 10;
    if (isRecord) score += 16;
    if (c.root === document.body || c.root === document.documentElement) score -= 28;
    if (LAYOUT_TAGS.has(c.item.tagName)) score -= 24;
    if (descendants > 60) score -= Math.min(40, descendants - 60);
    if (c.items.length === 2 && descendants > 30) score -= 20;
    if (chromeOnly && matchRatio < 0.85) score -= 100;
    if (c.items.length >= 4 && matchRatio < 0.5) score -= 120;
    return score;
  }

  function isDenseCandidate(c, fieldEl) {
    if (!c?.items?.length) return false;
    // Heading / chrome beside a list: the field sits outside the rows, so rematch
    // count is 0 — still a valid list if we already resolved sibling rows.
    const heading = closestHeading(fieldEl);
    const onHeading = !!(heading && (heading === fieldEl || heading.contains(fieldEl)));
    if (onHeading && c.items.every((item) => item !== fieldEl && !item.contains(fieldEl))) {
      return c.items.length >= 2;
    }
    const matches = countFieldMatches(c.items, c.item, fieldEl);
    const matchRatio = matches / c.items.length;
    // Sparse rematch = page chrome (Amazon .celwidget) or accidental siblings (price + %).
    if (c.items.length <= 3) return matches === c.items.length;
    return matchRatio >= 0.45 || matches >= 3;
  }

  /** Host for a one-row pick when no dense repeating list exists (PDP price, etc.). */
  function singletonHost(fieldEl) {
    return (
      fieldEl.closest("article, li, tr, section") ||
      fieldEl.closest(
        '[class*="product"], [id*="corePrice"], [id*="apex"], [id*="price"]'
      ) ||
      fieldEl.closest(".celwidget") ||
      fieldEl.closest("[class]") ||
      fieldEl
    );
  }

  function isHeadingNode(el) {
    if (!(el instanceof Element)) return false;
    if (/^H[1-6]$/.test(el.tagName)) return true;
    return el.getAttribute("role") === "heading";
  }

  function closestHeading(element) {
    if (!element?.closest) return null;
    let el = element;
    for (let d = 0; d < 10 && el; d += 1) {
      if (isHeadingNode(el)) return el;
      el = el.parentElement;
    }
    return element.closest("h1, h2, h3, h4, h5, h6");
  }

  function factRowsUnder(parent) {
    if (!parent) return [];
    const items = [];
    for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
      if (c.classList?.contains("product-facts-detail")) items.push(c);
    }
    return items;
  }

  /** Amazon Top highlights: label/value rows, not ul/li. */
  function factRowGroupElements(element) {
    if (!element?.closest) return [];
    const row = element.closest(".product-facts-detail");
    if (row?.parentElement) {
      const items = factRowsUnder(row.parentElement);
      if (items.length >= 2) return items;
    }

    const heading = closestHeading(element);
    if (!(heading && (heading === element || heading.contains(element)))) return [];
    const label = heading.textContent.replace(/\s+/g, " ").trim();
    if (!/^top highlights$/i.test(label)) return [];

    // Only the expander next to this heading — never querySelector("#topHighlight")
    // from #centerCol, which would steal every other pick on the page.
    let node = heading;
    for (let d = 0; d < 6 && node; d += 1) {
      const parent = node.parentElement;
      if (!parent) break;
      for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
        if (c.id !== "topHighlight") continue;
        const items = factRowsUnder(c.querySelector('[role="list"]'));
        if (items.length >= 2) return items;
      }
      node = parent;
    }
    return [];
  }

  /**
   * Narrow "similar" to a subtree so site-wide classes (e.g. Amazon `.a-list-item`)
   * only count peers in the same list region.
   */
  function getSimilarScopeRoot(element) {
    if (!element?.closest) return null;
    // Amazon product detail pages use these known feature-bullet container IDs.
    // Scoping to these containers prevents highlighting unrelated .a-list-item spans elsewhere on the page.
    const byId = element.closest(
      '#featurebullets_feature_div, #feature-bullets-bullet-list, ' +
        '[id*="featurebullets_feature"], [id*="feature-bullets"], [id*="detailBullets_feature"], ' +
        '[id*="justAskAlexa"], [id*="AskAlexa"], [id*="alexaInteraction"]'
    );
    if (byId) return byId;

    const facts = factRowGroupElements(element);
    if (facts.length >= 2) return facts[0].parentElement;

    // Heading beside a list (Amazon "Ask Alexa" / "Top highlights"): scope to that widget, not #centerCol.
    const heading = closestHeading(element);
    const fromHeading = heading && (heading === element || heading.contains(element)) ? heading : null;
    if (fromHeading) {
      let host = fromHeading.parentElement;
      for (let d = 0; d < 6 && host; d += 1) {
        let listed = 0;
        for (let c = host.firstElementChild; c; c = c.nextElementSibling) {
          if (c.tagName !== "UL" && c.tagName !== "OL") continue;
          let lis = 0;
          for (let li = c.firstElementChild; li; li = li.nextElementSibling) {
            if (li.tagName === "LI") lis += 1;
          }
          if (lis >= 2) listed += 1;
        }
        if (listed >= 1) return host;
        host = host.parentElement;
      }
    }

    let el = element;
    for (let d = 0; d < 10 && el; d += 1) {
      if (el.tagName === "UL" || el.tagName === "OL") {
        let liDirect = 0;
        for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
          if (c.tagName === "LI") liDirect += 1;
        }
        if (liDirect >= 2) return el;
      }
      el = el.parentElement;
    }
    return element.closest('#centerCol, #dp, #dp-container, main, [role="main"]') || document.documentElement;
  }

  function filterNodesToScope(nodes, scopeRoot) {
    if (!scopeRoot || !nodes?.length) return nodes || [];
    return nodes.filter((n) => n?.nodeType === Node.ELEMENT_NODE && scopeRoot.contains(n));
  }

  /** Short CSS candidates for peer matching — no :nth-of-type (those are unique paths). */
  function peerSelectorCandidates(el) {
    if (!(el instanceof Element)) return [];
    const tag = el.tagName.toLowerCase();
    const classes = stableClasses(el);
    const out = [];
    const push = (sel) => {
      if (!sel || out.includes(sel)) return;
      // Bare layout tags match too much (price + discount % siblings under one parent).
      if (/^(div|span|p|i|b|em|strong|section)$/i.test(sel)) return;
      out.push(sel);
    };
    if (classes.length) {
      push(tag + classSuffix(classes.slice(0, MAX_CLASSES)));
      push(tag + classSuffix(classes.slice(0, 2)));
      push(tag + classSuffix(classes.slice(0, 1)));
      push(classSuffix(classes.slice(0, 2)));
      push(classSuffix(classes.slice(0, 1)));
    }
    push(partFor(el, { allowNth: false }));
    if (SEMANTIC_ITEMS.has(el.tagName) || ITEM_CLASS_HINT.test(classes.join(" "))) {
      push(tag);
    }
    return out;
  }

  function querySelectorAllSafe(root, selector) {
    try {
      return [...(root || document).querySelectorAll(selector)];
    } catch {
      return [];
    }
  }

  function innermostMatchRoot(nodes, element) {
    const cand = nodes.filter(
      (n) => n.nodeType === Node.ELEMENT_NODE && (n === element || n.contains(element))
    );
    if (!cand.length) return null;
    let deepest = cand[0];
    for (let i = 1; i < cand.length; i += 1) {
      const n = cand[i];
      if (deepest.contains(n) && n !== deepest) deepest = n;
    }
    return deepest;
  }

  /**
   * Prefer the selector with the smallest match count in [2, MAX] inside the scope
   * (tight peer group), even when the unique nth path would only match one node.
   */
  function pickPeerSelectorAtElement(element) {
    if (!(element instanceof Element)) return null;
    const scopeRoot = getSimilarScopeRoot(element);
    if (!scopeRoot) return null;
    const list = peerSelectorCandidates(element);
    let best = null;
    let bestCount = Infinity;
    for (const value of list) {
      const nodes = filterNodesToScope(querySelectorAllSafe(scopeRoot, value), scopeRoot);
      if (!innermostMatchRoot(nodes, element)) continue;
      const total = nodes.length;
      if (total < 2 || total > MAX_SIMILAR_PEERS) continue;
      if (total < bestCount) {
        bestCount = total;
        best = value;
      }
    }
    return best;
  }

  /** Try the node, then walk up so an inner hit can still group via a parent row selector. */
  function pickPeerSelector(element) {
    let el = element;
    for (let depth = 0; depth < 5 && el && el !== document.body; depth += 1) {
      const pref = pickPeerSelectorAtElement(el);
      if (pref) return { selector: pref, at: el };
      el = el.parentElement;
    }
    return null;
  }

  /**
   * Direct &lt;li&gt; children of the innermost ul/ol in scope that contains `element`.
   * Fallback when CSS peer selectors fail (noisy shared classes).
   */
  function computeSiblingListGroupElements(element) {
    if (!element?.closest) return [];
    const scopeRoot = getSimilarScopeRoot(element);
    if (!scopeRoot || !scopeRoot.contains(element)) return [];
    let el = element;
    for (let depth = 0; depth < 24 && el; depth += 1) {
      el = el.parentElement;
      if (!el || !scopeRoot.contains(el)) break;
      if (el.tagName !== "UL" && el.tagName !== "OL") continue;
      const items = [];
      for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
        if (c.tagName === "LI") items.push(c);
      }
      if (items.length < 2) continue;
      if (!items.some((item) => item === element || item.contains(element))) continue;
      return items;
    }
    return [];
  }

  function peersShareParent(peers) {
    if (!peers.length) return null;
    const parent = peers[0].parentElement;
    if (!parent) return null;
    if (!peers.every((p) => p.parentElement === parent)) return null;
    return parent;
  }

  function candidateFromPeers(fieldEl, peers) {
    if (!peers || peers.length < 2) return null;
    const item =
      innermostMatchRoot(peers, fieldEl) ||
      peers.find((p) => p === fieldEl || p.contains(fieldEl)) ||
      peers[0];
    const sharedParent = peersShareParent(peers);
    const root = sharedParent || item.parentElement;
    if (!root) return null;
    const items = sharedParent
      ? peers
      : [...root.children].filter((c) => peers.includes(c) || similarity(c, item) >= SIMILARITY_MIN);
    if (items.length < 2) return null;
    return { item, root, items };
  }

  /**
   * Heading / chrome beside a list (Amazon "About this item") still maps to that ul/ol.
   */
  function computeAdjacentListGroupElements(element) {
    const nested = computeSiblingListGroupElements(element);
    if (nested.length >= 2) return nested;
    const facts = factRowGroupElements(element);
    if (facts.length >= 2) return facts;
    if (!element?.closest) return [];
    const scopeRoot = getSimilarScopeRoot(element);
    if (!scopeRoot || !scopeRoot.contains(element)) return [];
    const heading = closestHeading(element);
    if (!heading || !scopeRoot.contains(heading)) return [];
    let n = heading.nextElementSibling;
    while (n && (n === scopeRoot || scopeRoot.contains(n))) {
      const lists = [];
      if (n.tagName === "UL" || n.tagName === "OL") lists.push(n);
      else if (n.querySelector) lists.push(...n.querySelectorAll("ul, ol"));
      for (const list of lists) {
        if (list !== scopeRoot && !scopeRoot.contains(list)) continue;
        const items = [];
        for (let c = list.firstElementChild; c; c = c.nextElementSibling) {
          if (c.tagName === "LI") items.push(c);
        }
        if (items.length >= 2) return items;
      }
      n = n.nextElementSibling;
    }
    return [];
  }

  /**
   * Similar peers for hover highlighting (exclude the hovered node / its match root).
   * Strategy: scoped non-unique CSS selector, then sibling &lt;li&gt; list.
   */
  function findSimilarPeers(element) {
    if (!(element instanceof Element)) return [];
    const heading = closestHeading(element);
    const onListHeading = !!(heading && (heading === element || heading.contains(element)));
    if (!onListHeading) {
      const picked = pickPeerSelector(element);
      if (picked) {
        const scopeRoot = getSimilarScopeRoot(element);
        const all = filterNodesToScope(querySelectorAllSafe(scopeRoot, picked.selector), scopeRoot);
        const root = innermostMatchRoot(all, element);
        if (root && all.length >= 2) {
          return all.filter((el) => el !== element && el !== root && el.nodeType === Node.ELEMENT_NODE);
        }
      }
    }
    const sib = computeAdjacentListGroupElements(element);
    if (sib.length < 2) return [];
    const row = sib.find((item) => item === element || item.contains(element));
    if (!row) return sib.filter((item) => item !== element);
    return sib.filter((item) => item !== row);
  }

  function collectCandidates(fieldEl) {
    const candidates = [];
    const scopeRoot = getSimilarScopeRoot(fieldEl);
    let node = fieldEl;
    for (let depth = 0; depth < MAX_WALK && node && node !== document.body; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.documentElement) break;
      // Stay inside the similar-peer scope so page-wide widgets (Amazon .celwidget) cannot win.
      if (scopeRoot && parent !== scopeRoot && !scopeRoot.contains(parent)) break;
      const sameTag = [...parent.children].filter((c) => c.tagName === node.tagName);
      if (sameTag.length >= 2) {
        const similar = sameTag.filter((s) => similarity(s, node) >= SIMILARITY_MIN);
        if (similar.length >= 2) {
          candidates.push({ item: node, root: parent, items: similar });
        }
      }
      node = parent;
    }

    // Selector-peer strategy (refineNetSelector-style): tight non-unique CSS matches in scope.
    let el = fieldEl;
    for (let depth = 0; depth < 5 && el && el !== document.body; depth += 1) {
      const pref = pickPeerSelectorAtElement(el);
      if (pref) {
        const scopeRoot = getSimilarScopeRoot(fieldEl);
        const nodes = filterNodesToScope(querySelectorAllSafe(scopeRoot, pref), scopeRoot);
        const item = innermostMatchRoot(nodes, fieldEl);
        if (item) {
          const fromPeers = candidateFromPeers(fieldEl, nodes);
          if (fromPeers) candidates.push(fromPeers);
        }
      }
      el = el.parentElement;
    }

    const siblingLis = computeAdjacentListGroupElements(fieldEl);
    const fromLis = candidateFromPeers(fieldEl, siblingLis);
    if (fromLis) candidates.push(fromLis);

    return candidates;
  }

  function pickCandidate(candidates, fieldEl) {
    if (!candidates.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (!isDenseCandidate(c, fieldEl)) continue;
      const score = scoreCandidate(c, fieldEl);
      if (score > bestScore) {
        best = c;
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

    const host = singletonHost(fieldEl);
    const root = host.parentElement || document.body;
    return {
      root,
      items: [host],
      itemSelector: itemSelectorFor(host, [host]),
      rootSelector: cssPath(root),
    };
  }

  function uniqueDescendantSelector(root, el) {
    // Indexed widget ids (Amazon size_name_0-announce) are unique per row and
    // will not rematch sibling items. Prefer class/tag paths instead.
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
      chain.unshift(partFor(node, { allowNth: true, allowId: false }));
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

  const FIELD_SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "PATH",
    "BR",
    "HR",
    "IMG",
    "INPUT",
    "BUTTON",
    "TEXTAREA",
    "SELECT",
    "META",
    "LINK",
  ]);

  function isMeaningfulFieldNode(el) {
    if (!(el instanceof Element)) return false;
    if (FIELD_SKIP_TAGS.has(el.tagName)) return false;
    if (el.id === "click-scrape-overlay" || el.closest?.("#click-scrape-overlay")) return false;
    return true;
  }

  function textWeight(el) {
    return String(el?.textContent || "")
      .replace(/\s+/g, " ")
      .trim().length;
  }

  /** Prefer a single content branch when narrowing (wrapper → inner text host). */
  function preferredNarrowChild(el) {
    if (!(el instanceof Element)) return null;
    const kids = [...el.children].filter(isMeaningfulFieldNode);
    if (!kids.length) return null;
    if (kids.length === 1) return kids[0];
    let best = null;
    let bestScore = -1;
    for (const k of kids) {
      const tw = textWeight(k);
      if (tw === 0 && !k.children.length) continue;
      // Prefer text-heavy branches; slight boost for leaves with text.
      const score = tw * 10 + (k.children.length ? 0 : 1);
      if (score > bestScore) {
        best = k;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * Ladder from list item → current field → preferred descendants (max ~8).
   * Used for Broader / Narrower nesting adjust.
   */
  function fieldTargetLadder(item, currentEl, options = {}) {
    const maxLen = Math.max(2, Number(options.maxLength) || 8);
    if (!(item instanceof Element) || !(currentEl instanceof Element)) return [];
    if (item !== currentEl && !item.contains(currentEl)) return [];

    const between = [];
    let node = currentEl;
    while (node && node !== item) {
      between.unshift(node);
      node = node.parentElement;
    }
    if (node !== item) return [];

    const chain = [item, ...between];
    let tip = currentEl;
    while (chain.length < maxLen) {
      const child = preferredNarrowChild(tip);
      if (!child || chain.includes(child)) break;
      chain.push(child);
      tip = child;
    }
    return chain;
  }

  function fieldTargetStepInfo(item, currentEl) {
    const ladder = fieldTargetLadder(item, currentEl);
    const index = ladder.indexOf(currentEl);
    return {
      ladder,
      index,
      canBroader: index > 0,
      canNarrower: index >= 0 && index < ladder.length - 1,
    };
  }

  /**
   * @param {Element} item
   * @param {Element} currentEl
   * @param {-1|1|"broader"|"narrower"} direction -1/broader = toward item; 1/narrower = toward leaf
   * @returns {Element|null}
   */
  function stepFieldTarget(item, currentEl, direction) {
    const dir =
      direction === -1 || direction === "broader"
        ? -1
        : direction === 1 || direction === "narrower"
          ? 1
          : 0;
    if (!dir) return null;
    const { ladder, index } = fieldTargetStepInfo(item, currentEl);
    if (index < 0) return null;
    return ladder[index + dir] || null;
  }

  NS.selectors = {
    cssPath,
    findListContext,
    relativeSelector,
    queryItems,
    findSimilarPeers,
    getSimilarScopeRoot,
    fieldTargetLadder,
    fieldTargetStepInfo,
    stepFieldTarget,
  };
})();
