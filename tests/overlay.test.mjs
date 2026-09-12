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
      "setRowHandlers",
      "setSessionHandlers",
      "getVisibleColumns",
      "markTableDirty",
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

  it("renders the first 200 rows and a count caption", () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ Title: `Row ${i + 1}` }));
    overlay.renderPreview(rows, ["Title"]);
    const trs = document.querySelectorAll("#cs-preview tbody tr");
    assert.equal(trs.length, 200);
    const hint = document.querySelector("#cs-preview .cs-hint");
    assert.equal(hint.textContent, "250 rows · showing 200");
    assert.match(document.querySelector("#cs-preview tbody").textContent, /Row 200/);
    assert.doesNotMatch(document.querySelector("#cs-preview tbody").textContent, /Row 201/);
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

  it("renderPreview options.tables draws separate tables from row 1", () => {
    overlay.renderPreview([], [], {
      tables: [
        { columns: ["Pack"], rows: [{ Pack: "5" }, { Pack: "12" }], groupIndex: 0 },
        { columns: ["Size"], rows: [{ Size: "Small" }, { Size: "Medium" }], groupIndex: 1 },
      ],
    });
    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 2);
    assert.ok(tables[0].textContent.includes("5"));
    assert.ok(!tables[0].textContent.includes("Small"));
    assert.ok(tables[1].textContent.includes("Small"));
    assert.ok(!tables[1].textContent.includes("12"));
  });

  it("shows Edit recipe control (hidden until Run)", () => {
    const btn = document.querySelector("#cs-edit-recipe");
    assert.ok(btn);
    assert.equal(btn.textContent, "Edit recipe");
    assert.equal(btn.hidden, true);
    assert.equal(document.querySelector("#cs-new-list"), null);
  });

  it("session handler fires for Edit recipe", () => {
    const calls = [];
    overlay.setSessionHandlers({
      onEditRecipe() {
        calls.push("edit");
      },
    });
    const editBtn = document.querySelector("#cs-edit-recipe");
    editBtn.hidden = false;
    editBtn.disabled = false;
    click(editBtn);
    assert.deepEqual(calls, ["edit"]);
  });

  it("row handlers fire for cell edit, add, and delete", () => {
    const calls = [];
    overlay.setRowHandlers({
      onEditCell(groupIndex, rowIndex, col, value) {
        calls.push(["edit", groupIndex, rowIndex, col, value]);
      },
      onAddRow(groupIndex) {
        calls.push(["add", groupIndex]);
      },
      onDeleteRow(groupIndex, rowIndex) {
        calls.push(["del", groupIndex, rowIndex]);
      },
      onResetRows(groupIndex) {
        calls.push(["reset", groupIndex]);
      },
    });
    overlay.renderPreview([], [], {
      tables: [
        {
          groupIndex: 0,
          columns: ["Title"],
          rows: [{ Title: "A" }, { Title: "B" }],
          rowsDirty: true,
        },
      ],
    });
    assert.ok(document.querySelector('td.cs-cell[data-cs-row="0"]'));
    const cell = document.querySelector('td.cs-cell[data-cs-row="1"][data-cs-col="Title"]');
    cell.textContent = "edited";
    cell.dispatchEvent(new document.defaultView.Event("focusout", { bubbles: true }));
    click(document.querySelector('[data-cs-del-row="0"]'));
    click(document.querySelector("[data-cs-add-row]"));
    click(document.querySelector("[data-cs-reset-rows]"));
    assert.deepEqual(calls, [
      ["edit", 0, 1, "Title", "edited"],
      ["del", 0, 0],
      ["add", 0],
      ["reset", 0],
    ]);
  });

  it("shows an empty editable table with Add row when row handlers are set", () => {
    overlay.setRowHandlers({
      onAddRow() {},
    });
    overlay.renderPreview([], ["Title"]);
    assert.equal(document.querySelector("#cs-preview .cs-empty"), null);
    assert.ok(document.querySelector("#cs-preview table"));
    assert.ok(document.querySelector("[data-cs-add-row]"));
  });
});
