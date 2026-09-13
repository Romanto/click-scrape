(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});

  const DEFAULT_STICK_PAD = 2;

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

  /**
   * Reduce nested parent/child thrash while still allowing refine-into-child.
   * - Descendant of current → switch immediately (more specific pick).
   * - Ancestor of current → keep current while pointer stays in its box.
   * - Unrelated → switch.
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
    set("left", `${style.left}px`);
    set("top", `${style.top}px`);
    set("width", `${style.width}px`);
    set("height", `${style.height}px`);
    if (el.hidden != null) el.hidden = false;
  }

  NS.highlight = {
    DEFAULT_STICK_PAD,
    pointInRect,
    stabilizeHoverTarget,
    boxStyleFromRect,
    applyBoxStyle,
  };
})();
