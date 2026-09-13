(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  const DEFAULT_MAX_ROUNDS = 60;
    const DEFAULT_SETTLE_MS = 250;
  const DEFAULT_STABLE_ROUNDS = 2;
  const DEFAULT_STEP_RATIO = 0.9;

  function delay(ms, signal) {
    const wait = Math.max(0, Number(ms) || 0);
    const schedule =
      typeof globalThis.setTimeout === "function"
        ? globalThis.setTimeout.bind(globalThis)
        : (fn) => {
            fn();
            return 0;
          };
    const clear =
      typeof globalThis.clearTimeout === "function"
        ? globalThis.clearTimeout.bind(globalThis)
        : () => {};
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      const timer = schedule(() => {
        signal?.removeEventListener?.("abort", onAbort);
        resolve();
      }, wait);
      const onAbort = () => {
        clear(timer);
        reject(abortError());
      };
      signal?.addEventListener?.("abort", onAbort, { once: true });
    });
  }

  function abortError() {
    const err = new Error("Aborted");
    err.name = "AbortError";
    return err;
  }

  function isAborted(signal) {
    return !!(signal && signal.aborted);
  }

  /**
   * Nearest scrollable ancestor, else the document scrolling element.
   * @param {Element|null} el
   * @param {Document} [doc]
   * @returns {Element|null}
   */
  function findScrollParent(el, doc = document) {
    if (!(el instanceof Element)) {
      return doc?.scrollingElement || doc?.documentElement || doc?.body || null;
    }
    let node = el;
    while (node && node.nodeType === 1) {
      if (node === doc.documentElement || node === doc.body) break;
      if (looksScrollable(node)) return node;
      node = node.parentElement;
    }
    return doc.scrollingElement || doc.documentElement || doc.body || null;
  }

  function looksScrollable(el) {
    if (!(el instanceof Element)) return false;
    const height = Number(el.scrollHeight) || 0;
    const client = Number(el.clientHeight) || 0;
    if (height <= client + 1) return false;
    return true;
  }

  function countItems(root, itemSelector) {
    if (!root) return 0;
    try {
      const items = NS.selectors?.queryItems?.(root, itemSelector || "*") || [];
      return items.length;
    } catch {
      return 0;
    }
  }

  function dispatchScroll(port, doc) {
    const view = doc?.defaultView || globalThis;
    try {
      port?.dispatchEvent?.(new Event("scroll", { bubbles: true }));
    } catch {
      /* ignore */
    }
    try {
      view?.dispatchEvent?.(new Event("scroll"));
    } catch {
      /* ignore */
    }
  }

  function scrollStep(port, stepRatio, doc) {
    if (!port) return 0;
    const before = Number(port.scrollTop) || 0;
    const client = Math.max(1, Number(port.clientHeight) || Number(doc?.defaultView?.innerHeight) || 1);
    const max = Math.max(0, (Number(port.scrollHeight) || 0) - client);
    const ratio = Number(stepRatio);
    const step = Math.max(
      200,
      client * (Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_STEP_RATIO)
    );
    const next = Math.min(max, before + step);
    try {
      port.scrollTop = next;
    } catch {
      /* ignore */
    }
    if (typeof port.scrollBy === "function") {
      try {
        port.scrollBy(0, step);
      } catch {
        /* ignore */
      }
    }
    const view = doc?.defaultView || globalThis;
    if (port === doc?.scrollingElement || port === doc?.documentElement || port === doc?.body) {
      try {
        view.scrollBy?.(0, step);
      } catch {
        /* ignore */
      }
      try {
        view.scrollTo?.(0, Math.min(max, before + step));
      } catch {
        /* ignore */
      }
    }
    dispatchScroll(port, doc);
    return (Number(port.scrollTop) || 0) - before;
  }

  /** When the page is shorter than the viewport, nudge the last item into view to trigger IO/scroll loaders. */
  function nudgeLazyLoad(root, itemSelector, port, doc) {
    const items = NS.selectors?.queryItems?.(root, itemSelector || "*") || [];
    const last = items[items.length - 1];
    if (last && typeof last.scrollIntoView === "function") {
      try {
        last.scrollIntoView({ block: "end", inline: "nearest" });
      } catch {
        try {
          last.scrollIntoView(false);
        } catch {
          /* ignore */
        }
      }
    }
    const view = doc?.defaultView || globalThis;
    try {
      const y =
        Math.max(
          Number(doc?.body?.scrollHeight) || 0,
          Number(doc?.documentElement?.scrollHeight) || 0,
          Number(port?.scrollHeight) || 0
        ) + 800;
      view.scrollTo?.(0, y);
      if (port && port !== doc?.scrollingElement && port !== doc?.documentElement) {
        port.scrollTop = (Number(port.scrollHeight) || 0) + 800;
      }
    } catch {
      /* ignore */
    }
    dispatchScroll(port, doc);
  }

  /**
   * Scroll until matching item count stops growing (lazy / infinite lists).
   * Restores the scrollport position afterward by default.
   */
  async function scrollToRevealItems(root, opts = {}) {
    if (!(root instanceof Element)) {
      return { rounds: 0, itemCount: 0, stopped: "no-root" };
    }
    if (isAborted(opts.signal)) {
      return { rounds: 0, itemCount: countItems(root, opts.itemSelector), stopped: "aborted" };
    }

    const doc = root.ownerDocument || document;
    const port = findScrollParent(root, doc);
    const maxRounds = Math.max(1, Number(opts.maxRounds) || DEFAULT_MAX_ROUNDS);
    const settleMs = Math.max(0, Number(opts.settleMs) || DEFAULT_SETTLE_MS);
    const stableNeed = Math.max(1, Number(opts.stableRounds) || DEFAULT_STABLE_ROUNDS);
    const itemSelector = opts.itemSelector || "*";
    const getCount =
      typeof opts.getCount === "function" ? opts.getCount : () => countItems(root, itemSelector);
    const doScroll =
      typeof opts.doScroll === "function"
        ? opts.doScroll
        : (p) => scrollStep(p, opts.scrollStepRatio, doc);
    const wait = typeof opts.wait === "function" ? opts.wait : delay;
    const restoreScroll = opts.restoreScroll !== false;

    const startTop = Number(port?.scrollTop) || 0;
    let prev = getCount(root);
    let stable = 0;
    let rounds = 0;
    let stopped = "stable";

    try {
      for (let i = 0; i < maxRounds; i += 1) {
        if (isAborted(opts.signal)) {
          stopped = "aborted";
          break;
        }
        rounds = i + 1;
        let delta = doScroll(port);
        if (!delta) {
          // Page may be shorter than the viewport, or already at bottom — still nudge loaders.
          nudgeLazyLoad(root, itemSelector, port, doc);
          delta = 0;
        }
        await wait(settleMs, opts.signal);
        if (isAborted(opts.signal)) {
          stopped = "aborted";
          break;
        }
        const next = getCount(root);
        if (next > prev) {
          prev = next;
          stable = 0;
          continue;
        }
        stable += 1;
        if (stable >= stableNeed) {
          stopped = delta === 0 && i === 0 && next === prev ? "no-scroll" : "stable";
          break;
        }
      }
      if (rounds >= maxRounds && stable < stableNeed) stopped = "max-rounds";
    } catch (err) {
      if (err && err.name === "AbortError") stopped = "aborted";
      else throw err;
    } finally {
      if (restoreScroll && port && Number.isFinite(startTop)) {
        try {
          port.scrollTop = startTop;
        } catch {
          /* ignore */
        }
      }
    }

    return { rounds, itemCount: getCount(root), stopped };
  }

  /**
   * Scroll a live list and merge extracted rows each round.
   * Survives virtualized lists that unload off-screen nodes (unlike scroll-then-extract-once).
   *
   * @returns {Promise<{ rows: object[], rounds: number, stopped: string }>}
   */
  async function scrapeRecipeWhileScrolling(recipe, doc = document, opts = {}) {
    const sel = recipe?.rootSelector;
    if (!sel || !doc?.querySelector) {
      return { rows: [], rounds: 0, stopped: "no-root" };
    }
    if (!doc.defaultView) {
      const rows = NS.extract?.extractRows?.(recipe, doc) || [];
      return { rows, rounds: 0, stopped: "offline-doc" };
    }
    let root = null;
    try {
      root = doc.querySelector(sel);
    } catch {
      root = null;
    }
    if (!(root instanceof Element)) {
      return { rows: [], rounds: 0, stopped: "no-root" };
    }

    const columns =
      (Array.isArray(opts.columns) && opts.columns.length
        ? opts.columns
        : (recipe.fields || []).map((f) => f.name)) || [];
    const merge = NS.pagination?.mergeRows;
    const extract = NS.extract?.extractRows;
    if (!merge || !extract) {
      return { rows: extract?.(recipe, doc) || [], rounds: 0, stopped: "no-helpers" };
    }

    const port = findScrollParent(root, doc);
    const maxRounds = Math.max(1, Number(opts.maxRounds) || DEFAULT_MAX_ROUNDS);
    const settleMs = Math.max(0, Number(opts.settleMs) || DEFAULT_SETTLE_MS);
    const stableNeed = Math.max(1, Number(opts.stableRounds) || DEFAULT_STABLE_ROUNDS);
    const wait = typeof opts.wait === "function" ? opts.wait : delay;
    const restoreScroll = opts.restoreScroll !== false;
    const startTop = Number(port?.scrollTop) || 0;
    const itemSelector = recipe.itemSelector || "*";

    let rows = merge([], extract(recipe, doc), columns);
    let prevCount = rows.length;
    let stable = 0;
    let noMoveStreak = 0;
    let rounds = 0;
    let stopped = "stable";

    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;

    try {
      for (let i = 0; i < maxRounds; i += 1) {
        if (isAborted(opts.signal)) {
          stopped = "aborted";
          break;
        }
        rounds = i + 1;
        const delta = scrollStep(port, opts.scrollStepRatio, doc);
        if (!delta) {
          nudgeLazyLoad(root, itemSelector, port, doc);
          noMoveStreak += 1;
        } else {
          noMoveStreak = 0;
        }
        // Non-scrollable pages: keep waits short so Run/Edit stay snappy in tests.
        const effectiveWait = delta ? settleMs : Math.min(settleMs, 40);
        await wait(effectiveWait, opts.signal);
        if (isAborted(opts.signal)) {
          stopped = "aborted";
          break;
        }
        rows = merge(rows, extract(recipe, doc), columns);
        onProgress?.({ rows, rounds, columns });
        if (rows.length > prevCount) {
          prevCount = rows.length;
          stable = 0;
          noMoveStreak = 0;
          continue;
        }
        stable += 1;
        // Fully-loaded / non-lazy pages: stop quickly when scrolling cannot move.
        if (noMoveStreak >= 2 && stable >= 1) {
          stopped = "no-scroll";
          break;
        }
        if (stable >= stableNeed) {
          stopped = "stable";
          break;
        }
      }
      if (rounds >= maxRounds && stable < stableNeed && stopped === "stable") stopped = "max-rounds";
    } catch (err) {
      if (err && err.name === "AbortError") stopped = "aborted";
      else throw err;
    } finally {
      if (restoreScroll && port && Number.isFinite(startTop)) {
        try {
          port.scrollTop = startTop;
        } catch {
          /* ignore */
        }
      }
    }

    return { rows, rounds, stopped };
  }

  async function revealRecipeItems(recipe, doc = document, opts = {}) {
    const sel = recipe?.rootSelector;
    if (!sel || !doc?.querySelector) {
      return { rounds: 0, itemCount: 0, stopped: "no-root" };
    }
    let root = null;
    try {
      root = doc.querySelector(sel);
    } catch {
      root = null;
    }
    if (!(root instanceof Element)) {
      return { rounds: 0, itemCount: 0, stopped: "no-root" };
    }
    if (!doc.defaultView) {
      return {
        rounds: 0,
        itemCount: countItems(root, recipe.itemSelector),
        stopped: "offline-doc",
      };
    }
    return scrollToRevealItems(root, {
      ...opts,
      itemSelector: recipe.itemSelector || "*",
    });
  }

  NS.lazyLoad = {
    findScrollParent,
    scrollToRevealItems,
    scrapeRecipeWhileScrolling,
    revealRecipeItems,
    DEFAULT_MAX_ROUNDS,
    DEFAULT_SETTLE_MS,
  };
})();
