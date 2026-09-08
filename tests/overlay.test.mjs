import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const overlaySrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "picker-overlay.js"),
  "utf8"
);

function loadOverlay() {
  const { window, document } = parseHTML("<!DOCTYPE html><html><body></body></html>");
  const sandbox = {
    document,
    window,
    Element: window.Element,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(overlaySrc, sandbox);
  return { document, overlay: sandbox.ClickScrape.overlay };
}

function click(el) {
  const EventCtor = el.ownerDocument.defaultView.Event;
  el.dispatchEvent(new EventCtor("click", { bubbles: true }));
}

describe("overlay preview", () => {
  let document;
  let overlay;

  beforeEach(() => {
    ({ document, overlay } = loadOverlay());
    overlay.ensureOverlay();
  });

  it("exposes the frozen overlay API", () => {
    for (const name of [
      "ensureOverlay",
      "renderFields",
      "renderPreview",
      "removeOverlay",
      "escapeHtml",
      "setColumnHandlers",
      "getVisibleColumns",
    ]) {
      assert.equal(typeof overlay[name], "function", name);
    }
  });

  it("shows empty copy when there are no columns", () => {
    overlay.renderPreview([], []);
    const empty = document.querySelector("#cs-preview .cs-empty");
    assert.ok(empty);
    assert.equal(empty.textContent, "Click elements to add columns.");
    assert.equal(document.querySelector("#cs-preview table"), null);
    assert.deepEqual(overlay.getVisibleColumns(), []);
  });

  it("shows empty copy when columns exist but no rows", () => {
    overlay.renderPreview([], ["Title"]);
    assert.equal(document.querySelector("#cs-preview .cs-empty").textContent, "No rows matched.");
    assert.deepEqual(overlay.getVisibleColumns(), ["Title"]);
  });

  it("shows pagination empty copy when options.pagination is true and no rows yet", () => {
    overlay.renderPreview([], ["Title"], { pagination: true });
    assert.equal(document.querySelector("#cs-preview .cs-empty").textContent, "Pagination in progress…");
    assert.equal(document.querySelector("#cs-preview table"), null);
  });

  it("shows the table when options.pagination is true and rows exist", () => {
    overlay.renderPreview([{ Title: "A" }], ["Title"], { pagination: true });
    assert.equal(document.querySelector("#cs-preview .cs-empty"), null);
    assert.ok(document.querySelector("#cs-preview table"));
    assert.equal(document.querySelector("#cs-preview tbody tr td").textContent, "A");
  });

  it("uses options.empty when provided", () => {
    overlay.renderPreview([], [], { empty: "Custom empty." });
    assert.equal(document.querySelector("#cs-preview .cs-empty").textContent, "Custom empty.");
  });

  it("renders the first 20 rows and a count caption", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ Title: `Row ${i + 1}` }));
    overlay.renderPreview(rows, ["Title"]);
    const trs = document.querySelectorAll("#cs-preview tbody tr");
    assert.equal(trs.length, 20);
    const hint = document.querySelector("#cs-preview .cs-hint");
    assert.equal(hint.textContent, "25 row(s) — showing 20");
    assert.match(document.querySelector("#cs-preview tbody").textContent, /Row 20/);
    assert.doesNotMatch(document.querySelector("#cs-preview tbody").textContent, /Row 21/);
  });

  it("renders rename, drop, and up/down controls without mutating rows", () => {
    const rows = [
      { Title: "A", Price: "$1" },
      { Title: "B", Price: "$2" },
    ];
    const snapshot = JSON.stringify(rows);
    overlay.renderPreview(rows, ["Title", "Price"]);
    assert.ok(document.querySelector('[data-cs-rename="Title"]'));
    assert.ok(document.querySelector('[data-cs-drop="Title"]'));
    assert.ok(document.querySelector('[data-cs-move="Title"][data-cs-dir="-1"]'));
    assert.ok(document.querySelector('[data-cs-move="Title"][data-cs-dir="1"]'));
    assert.equal(document.querySelector('[data-cs-move="Title"][data-cs-dir="-1"]').disabled, true);
    assert.equal(document.querySelector('[data-cs-move="Price"][data-cs-dir="1"]').disabled, true);
    assert.equal(JSON.stringify(rows), snapshot);
    assert.deepEqual(overlay.getVisibleColumns(), ["Title", "Price"]);
  });

  it("calls column handlers from header controls and does not reorder locally", () => {
    const calls = [];
    overlay.setColumnHandlers({
      onDrop(name) {
        calls.push(["drop", name]);
      },
      onMove(name, dir) {
        calls.push(["move", name, dir]);
      },
      onRename(oldName, newName) {
        calls.push(["rename", oldName, newName]);
      },
    });
    overlay.renderPreview([{ Title: "A", Price: "$1" }], ["Title", "Price"]);
    click(document.querySelector('[data-cs-drop="Price"]'));
    click(document.querySelector('[data-cs-move="Title"][data-cs-dir="1"]'));
    assert.deepEqual(calls, [
      ["drop", "Price"],
      ["move", "Title", 1],
    ]);
    assert.deepEqual(overlay.getVisibleColumns(), ["Title", "Price"]);
    assert.ok(document.querySelector('[data-cs-col="Price"]'));
  });

  it("shows field names primary and selectors secondary", () => {
    overlay.renderFields([
      { name: "Title", relativeSelector: ":scope > .title" },
      { name: "Price", relativeSelector: ":scope .price" },
    ]);
    const items = [...document.querySelectorAll("#cs-fields .cs-field")];
    assert.equal(items.length, 2);
    assert.equal(items[0].querySelector(".cs-field-name").textContent, "Title");
    assert.equal(items[0].querySelector(".cs-field-sel").textContent, ":scope > .title");
    assert.ok(items[0].querySelector('[data-cs-drop="Title"]'));
  });
});
