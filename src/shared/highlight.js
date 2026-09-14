(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  const DEFAULT_STICK_PAD = 6;
  const OVERLAP_KEEP_RATIO = 0.55;

  function pointInRect(x, y, rect, pad = 0) {
    if (!rect) return false;
    const p = Number(pad) || 0;
    return (
      x >= rect.left - p &&
      x <= rect.right + p &&
      y >= rect.top - p &&
      y <= rect.bottom + p
    );
  }

  function rectArea(rect) {
    if (!rect) return 0;
    return Math.max(0, Number(rect.width) || 0) * Math.max(0, Number(rect.height) || 0);
  }

  function overlapRatio(a, b) {
    if (!a || !b) return 0;
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    const w = right - left;
    const h = bottom - top;
    if (w <= 0 || h <= 0) return 0;
    const inter = w * h;
    const smaller = Math.min(rectArea(a), rectArea(b)) || 1;
    return inter / smaller;
  }

  /**
   * Reduce nested parent/child thrash while still allowing refine-into-child.
   * - Descendant of current → switch immediately (more specific pick).
   * - Ancestor of current → keep current while pointer stays in its box.
   * - Unrelated with heavy overlap → keep current (resist sibling thrash).
   * - Unrelated otherwise → switch.
   */
  function stabilizeHoverTarget(current, candidate, clientX, clientY, options = {}) {
    if (!(candidate && candidate.nodeType === 1)) return current && current.nodeType === 1 ? current : null;
    if (!(current && current.nodeType === 1 && current.isConnected !== false)) return candidate;
    if (current === candidate) return current;

    const pad = options.pad != null ? options.pad : DEFAULT_STICK_PAD;
    const contains = typeof current.contains === "function" ? current.contains.bind(current) : null;
    const candidateContains =
      typeof candidate.contains === "function" ? candidate.contains.bind(candidate) : null;

    if (contains?.(candidate)) return candidate;

    if (candidateContains?.(current)) {
      const rect =
        typeof current.getBoundingClientRect === "function" ? current.getBoundingClientRect() : null;
      if (pointInRect(clientX, clientY, rect, pad)) return current;
      return candidate;
    }

    // Dense sibling thrash: keep current when pointer is still in its box and
    // the candidate heavily overlaps (one-frame flips on Amazon grids).
    const curRect =
      typeof current.getBoundingClientRect === "function" ? current.getBoundingClientRect() : null;
    const candRect =
      typeof candidate.getBoundingClientRect === "function" ? candidate.getBoundingClientRect() : null;
    if (
      pointInRect(clientX, clientY, curRect, pad) &&
      overlapRatio(curRect, candRect) >= OVERLAP_KEEP_RATIO
    ) {
      return current;
    }

    return candidate;
  }

  function boxStyleFromRect(rect, offset = 2) {
    if (!rect) return null;
    const o = Number(offset) || 0;
    return {
      left: Math.round(rect.left - o),
      top: Math.round(rect.top - o),
      width: Math.max(0, Math.round(rect.width + o * 2)),
      height: Math.max(0, Math.round(rect.height + o * 2)),
    };
  }

  function applyBoxStyle(el, style, options = {}) {
    if (!el || !style) return;
    const animate = options.animate !== false;
    if (!animate) el.classList?.add?.("cs-no-motion");
    else el.classList?.remove?.("cs-no-motion");
    const set = (prop, value) => {
      if (typeof el.style?.setProperty === "function") {
        el.style.setProperty(prop, value, "important");
      } else {
        el.style[prop] = value;
      }
    };
    // Prefer transform for smoother morph; keep left/top at 0.
    set("left", "0px");
    set("top", "0px");
    set("transform", `translate3d(${style.left}px, ${style.top}px, 0)`);
    set("width", `${style.width}px`);
    set("height", `${style.height}px`);
    if (options.opacity != null) set("opacity", String(options.opacity));
    if (el.hidden != null) el.hidden = false;
  }

  NS.highlight = {
    DEFAULT_STICK_PAD,
    OVERLAP_KEEP_RATIO,
    pointInRect,
    overlapRatio,
    stabilizeHoverTarget,
    boxStyleFromRect,
    applyBoxStyle,
  };
})();
