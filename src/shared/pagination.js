(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});
  const MAX_PAGES = 20;
  const ROW_SEP = "\0";

  function normalizeLabel(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isNextLabel(s) {
    const t = normalizeLabel(s);
    if (!t) return false;
    if (t === "next" || t === "next page") return true;
    if (t === "›" || t === "→" || t === "»") return true;
    return /^next\b/.test(t);
  }

  function isPrevLabel(s) {
    const t = normalizeLabel(s);
    if (!t) return false;
    if (t === "prev" || t === "previous" || t === "prev page" || t === "previous page") return true;
    if (t === "‹" || t === "←" || t === "«") return true;
    return /^(prev|previous)\b/.test(t) || /^[‹←«]/.test(t);
  }

  function normalizeUrl(url) {
    return String(url || "")
      .replace(/#.*$/, "")
      .replace(/\/+$/, "");
  }

  function samePage(a, b) {
    if (!a || !b) return false;
    return normalizeUrl(a) === normalizeUrl(b);
  }

  function resolveUrl(href, baseUrl) {
    const raw = String(href || "").trim();
    if (!raw || raw.charAt(0) === "#" || /^javascript:/i.test(raw)) return "";
    try {
      const ctor = globalThis.URL;
      if (typeof ctor === "function") {
        const abs = baseUrl ? new ctor(raw, baseUrl) : new ctor(raw);
        if (abs && typeof abs.href === "string" && abs.href.indexOf("://") !== -1) {
          return abs.href;
        }
      }
    } catch {
      /* fall through to manual join */
    }
    if (/^https?:\/\//i.test(raw) || /^file:/i.test(raw)) return raw;
    if (!baseUrl) return raw;
    const base = String(baseUrl).replace(/[?#].*$/, "");
    if (raw.startsWith("//")) {
      const proto = base.match(/^https?:/i)?.[0] || "https:";
      return proto + raw;
    }
    if (raw.startsWith("/")) {
      const origin = base.match(/^(https?:\/\/[^/]+)/);
      return origin ? origin[1] + raw : raw;
    }
    const slash = base.lastIndexOf("/");
    const dir = slash >= 0 ? base.slice(0, slash + 1) : `${base}/`;
    return dir + raw;
  }

  function relIsPrev(el) {
    const rel = (el.getAttribute?.("rel") || "").toLowerCase();
    return /\bprev\b/.test(rel);
  }

  function rawHref(el) {
    if (!el || relIsPrev(el) || isPrevLabel(el.textContent)) return "";
    return (
      el.getAttribute?.("href") ||
      el.getAttribute?.("data-href") ||
      el.getAttribute?.("data-url") ||
      el.getAttribute?.("formaction") ||
      ""
    );
  }

  function paginationRoots(doc) {
    return doc.querySelectorAll("nav.pagination, .pagination, [aria-label*='page' i]");
  }

  function getCurrentPageNumber(doc) {
    const marked = doc.querySelector(
      '[aria-current="page"], .pagination .current, nav .current'
    );
    if (marked) {
      const t = normalizeLabel(marked.textContent);
      if (/^\d+$/.test(t)) return parseInt(t, 10);
    }
    const nav = doc.querySelector("nav.pagination, .pagination, [aria-label*='page' i]");
    if (!nav) return null;
    for (const el of nav.querySelectorAll("span, em, strong, [aria-current]")) {
      if (el.tagName === "A") continue;
      const t = normalizeLabel(el.textContent);
      if (/^\d+$/.test(t)) return parseInt(t, 10);
    }
    return null;
  }

  function hrefIfNext(el, currentUrl) {
    const url = resolveUrl(rawHref(el), currentUrl);
    if (url && !samePage(url, currentUrl)) return url;
    return "";
  }

  function findLabeledNextIn(root, currentUrl) {
    if (!root) return "";
    for (const el of root.querySelectorAll("a[href], button")) {
      if (!isNextLabel(el.textContent)) continue;
      const url = hrefIfNext(el, currentUrl);
      if (url) return url;
    }
    return "";
  }

  function findNumberedNextIn(root, currentUrl, want) {
    if (!root) return "";
    for (const el of root.querySelectorAll("a[href]")) {
      if (normalizeLabel(el.textContent) !== want) continue;
      const url = hrefIfNext(el, currentUrl);
      if (url) return url;
    }
    return "";
  }

  function findScopedThenDocument(doc, finder) {
    for (const root of paginationRoots(doc)) {
      const found = finder(root);
      if (found) return found;
    }
    return finder(doc) || "";
  }

  function findRelNextAnchor(doc) {
    try {
      const el = doc.querySelector('a[rel~="next"][href]');
      if (el && !relIsPrev(el)) return el;
    } catch {
      /* some engines reject ~=; fall through */
    }
    for (const el of doc.querySelectorAll("a[href][rel]")) {
      const rel = (el.getAttribute("rel") || "").toLowerCase();
      if (/\bnext\b/.test(rel) && !relIsPrev(el)) return el;
    }
    return null;
  }

  function findNextUrl(doc, currentUrl) {
    if (!doc) return "";

    const relNext = findRelNextAnchor(doc);
    if (relNext) {
      const url = resolveUrl(relNext.getAttribute("href"), currentUrl);
      if (url && !samePage(url, currentUrl)) return url;
    }

    const fromLabel = findScopedThenDocument(doc, (root) => findLabeledNextIn(root, currentUrl));
    if (fromLabel) return fromLabel;

    const current = getCurrentPageNumber(doc);
    if (current == null) return "";
    const want = String(current + 1);
    return findScopedThenDocument(doc, (root) => findNumberedNextIn(root, currentUrl, want));
  }

  function projectRow(row, columns) {
    const out = {};
    for (const col of columns) {
      out[col] = row && row[col] != null ? String(row[col]) : "";
    }
    return out;
  }

  function rowKey(row, columns) {
    const cols = Array.isArray(columns) && columns.length ? columns : Object.keys(row || {});
    return cols.map((c) => String((row && row[c]) ?? "")).join(ROW_SEP);
  }

  function mergeRows(existing, incoming, columns) {
    const cols = Array.isArray(columns) ? columns.slice() : [];
    if (!cols.length) return [];
    const result = [];
    const seen = new Set();
    const add = (row) => {
      const projected = projectRow(row, cols);
      const key = rowKey(projected, cols);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(projected);
    };
    for (const row of existing || []) add(row);
    for (const row of incoming || []) add(row);
    return result;
  }

  function isHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function isFileUrl(url) {
    return /^file:/i.test(String(url || ""));
  }

  function originOf(url) {
    const m = String(url || "").match(/^(https?:\/\/[^/?#]*)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function isCrossOrigin(currentUrl, candidateUrl) {
    if (!currentUrl || isFileUrl(currentUrl) || !isHttpUrl(currentUrl)) return false;
    if (!isHttpUrl(candidateUrl)) return false;
    const a = originOf(currentUrl);
    const b = originOf(candidateUrl);
    if (!a || !b) return false;
    return a !== b;
  }

  function isAbortError(err, signal) {
    if (signal?.aborted) return true;
    const name = err && err.name;
    return name === "AbortError" || name === "TimeoutError";
  }

  async function defaultFetchPage(url, fetchOptions = {}) {
    const init = { method: "GET", credentials: "same-origin", redirect: "follow" };
    if (fetchOptions.signal) init.signal = fetchOptions.signal;
    const res = await fetch(url, init);
    if (!res || !res.ok || res.type === "opaque" || res.type === "opaqueredirect") return null;
    if (res.url && isCrossOrigin(fetchOptions.currentUrl || "", res.url)) return null;
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function walkPages(recipe, startDoc, options = {}) {
    const columns = Array.isArray(options.columns)
      ? options.columns.slice()
      : (recipe?.fields || []).map((f) => f.name);
    const maxPages = Number(options.maxPages) > 0 ? Number(options.maxPages) : MAX_PAGES;
    const extractRows = options.extractRows || NS.extract?.extractRows;
    const fetchPage = options.fetchPage || defaultFetchPage;
    const onProgress = options.onProgress;
    const persistPageCount = options.persistPageCount;
    const signal = options.signal;

    let url = options.currentUrl || "";
    let doc = startDoc;
    const firstPageRows = Array.isArray(options.initialRows)
      ? options.initialRows
      : (extractRows ? extractRows(recipe, doc) : []);
    let rows = mergeRows([], firstPageRows, columns);
    let pages = 1;
    let hint = "Pagination in progress…";
    const visited = new Set();
    if (url) visited.add(normalizeUrl(url));

    const aborted = () => !!(signal && signal.aborted);
    const emit = (payload) => {
      if (aborted()) return;
      onProgress?.(payload);
    };

    emit({ pages, rows, columns, hint, done: false });

    while (pages < maxPages) {
      if (aborted()) {
        hint = "Pagination stopped. Keeping rows already collected.";
        break;
      }
      const nextUrl = findNextUrl(doc, url);
      if (!nextUrl) break;
      if (isCrossOrigin(url, nextUrl)) {
        hint = "Could not load next page (blocked or CORS). Keeping rows already collected.";
        break;
      }
      const token = normalizeUrl(nextUrl);
      if (token && visited.has(token)) break;
      if (token) visited.add(token);

      let nextDoc = null;
      try {
        nextDoc = await fetchPage(nextUrl, { signal, currentUrl: url });
      } catch (err) {
        if (isAbortError(err, signal)) {
          hint = "Pagination stopped. Keeping rows already collected.";
          break;
        }
        nextDoc = null;
      }
      if (aborted()) {
        hint = "Pagination stopped. Keeping rows already collected.";
        break;
      }
      if (!nextDoc) {
        hint = "Could not load next page (blocked or CORS). Keeping rows already collected.";
        break;
      }

      const nextRows = extractRows ? extractRows(recipe, nextDoc) : [];
      rows = mergeRows(rows, nextRows, columns);
      pages += 1;
      doc = nextDoc;
      url = nextUrl;
      emit({ pages, rows, columns, hint: "Pagination in progress…", done: false });
    }

    if (aborted() && hint === "Pagination in progress…") {
      hint = "Pagination stopped. Keeping rows already collected.";
    }

    if (hint === "Pagination in progress…") {
      hint = `${rows.length} row(s) from ${pages} page(s).`;
    }

    try {
      await persistPageCount?.(pages);
    } catch {
      /* scraping must still work if storage write fails */
    }

    emit({ pages, rows, columns, hint, done: true });
    return { rows, pages, columns, hint };
  }

  NS.pagination = {
    MAX_PAGES,
    findNextUrl,
    mergeRows,
    rowKey,
    walkPages,
    resolveUrl,
  };
})();
