import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "..", "..", "src", "shared");
const MODULES = ["selectors.js", "extract.js", "export.js", "pagination.js", "columns.js", "storage.js"];

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
