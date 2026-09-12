import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT_DIR, "src", "shared");
const MODULES = [
  "selectors.js",
  "extract.js",
  "export.js",
  "pagination.js",
  "columns.js",
  "rows.js",
  "storage.js",
];
const PICKER_FILES = [
  "src/shared/selectors.js",
  "src/shared/extract.js",
  "src/shared/export.js",
  "src/shared/storage.js",
  "src/shared/pagination.js",
  "src/shared/columns.js",
  "src/shared/rows.js",
  "src/content/picker-overlay.js",
  "src/content/content.js",
];

export function loadFixture(name) {
  return readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");
}

export function createDocument(html) {
  const { window, document } = parseHTML(html);
  return { window, document };
}

export function loadClickScrape(window, options = {}) {
  const cssEscape =
    window.CSS?.escape ??
    ((value) => String(value).replace(/([^\w-])/g, "\\$1"));

  const BlobClass =
    options.Blob ??
    class Blob {
      constructor(parts, blobOptions = {}) {
        this.parts = parts;
        this.type = blobOptions.type ?? "";
      }
    };

  const sandbox = {
    globalThis: window,
    document: window.document,
    Element: window.Element,
    Node: window.Node,
    CSS: { escape: cssEscape },
    Blob: BlobClass,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {},
    },
  };

  window.ClickScrape = undefined;

  for (const file of MODULES) {
    const code = readFileSync(path.join(SRC_DIR, file), "utf8");
    vm.runInNewContext(code, sandbox);
  }

  return window.ClickScrape;
}

/**
 * Load overlay + content picker against a live document (chrome.runtime mocked).
 * Use for outline/drop tests that must exercise content.js, not a reimplemented loop.
 */
export function loadPicker(html, options = {}) {
  const { window, document } = parseHTML(html);
  const listeners = [];
  const cssEscape =
    window.CSS?.escape ??
    ((value) => String(value).replace(/([^\w-])/g, "\\$1"));

  const sandbox = {
    console,
    document,
    window,
    Element: window.Element,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    CSS: { escape: cssEscape },
    location: { href: options.locationHref || "http://127.0.0.1:8765/demo.html" },
    crypto: { randomUUID: () => "test-id" },
    AbortController,
    chrome: {
      runtime: {
        onMessage: {
          addListener(fn) {
            listeners.push(fn);
          },
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  window.document = document;

  for (const file of PICKER_FILES) {
    vm.runInNewContext(readFileSync(path.join(ROOT_DIR, file), "utf8"), sandbox);
  }

  function send(type, extra = {}) {
    for (const fn of listeners) fn({ type, ...extra }, {}, () => {});
  }

  function fire(el, type) {
    const EventCtor = window.Event;
    el.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true }));
  }

  function startPicker() {
    send("CLICK_SCRAPE_START");
  }

  function pick(el) {
    document.elementFromPoint = () => el;
    fire(el, "mousemove");
    fire(el, "click");
  }

  return { window, document, sandbox, send, fire, startPicker, pick };
}

/** Resolve a field element from an item using an item-relative selector. */
export function resolveRelative(item, relativeSelector) {
  if (relativeSelector === ":scope") return item;
  if (relativeSelector.startsWith(":scope ")) {
    return item.querySelector(relativeSelector.slice(":scope ".length));
  }
  return item.querySelector(relativeSelector);
}

/** MVP contract: selector must not be a document-absolute path from html/body. */
export function assertItemRelative(selector) {
  const normalized = selector.trim();
  if (/^(html|body)\b/i.test(normalized)) {
    throw new Error(`expected item-relative selector, got document path: ${selector}`);
  }
  if (/\bhtml\s*>|\bbody\s*>/i.test(normalized)) {
    throw new Error(`expected item-relative selector, got document path: ${selector}`);
  }
}
