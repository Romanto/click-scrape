import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

const SAMPLE_ROWS = [
  { Title: "Acme Notebook", Price: "$12.00", Meta: "Stationery" },
  { Title: "Bright Lamp", Price: "$34.50", Meta: "Home" },
];

function model(overrides = {}) {
  return {
    fields: [
      { name: "Title", relativeSelector: ":scope .title" },
      { name: "Price", relativeSelector: ":scope .price" },
      { name: "Meta", relativeSelector: ":scope .meta" },
    ],
    rows: SAMPLE_ROWS.map((r) => ({ ...r })),
    columnOrder: ["Title", "Price", "Meta"],
    hiddenColumns: [],
    ...overrides,
  };
}

describe("columns", () => {
  let ClickScrape;

  beforeEach(() => {
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    ClickScrape = loadClickScrape(window);
  });

  it("exposes rename/drop/move/visible helpers", () => {
    for (const name of ["visibleColumns", "uniqueName", "renameColumn", "dropColumn", "moveColumn", "applyPick"]) {
      assert.equal(typeof ClickScrape.columns[name], "function", name);
    }
  });

  it("visibleColumns returns preview order and omits hidden", () => {
    assert.deepEqual(
      ClickScrape.columns.visibleColumns(["Price", "Title", "Meta"], ["Meta"]),
      ["Price", "Title"]
    );
  });

  it("rename updates field name, row keys, and order together", () => {
    const next = ClickScrape.columns.renameColumn(model(), "Title", "Name");
    assert.equal(next.fields[0].name, "Name");
    assert.equal(next.fields[0].relativeSelector, ":scope .title");
    assert.deepEqual(next.columnOrder, ["Name", "Price", "Meta"]);
    assert.equal(next.rows[0].Name, "Acme Notebook");
    assert.equal(next.rows[0].Title, undefined);
    assert.equal(next.rows[0].Price, "$12.00");
  });

  it("rename skips empty names and appends 2 on collision", () => {
    const skipped = ClickScrape.columns.renameColumn(model(), "Title", "   ");
    assert.equal(skipped.fields[0].name, "Title");
    assert.equal(skipped.rows[0].Title, "Acme Notebook");

    const collided = ClickScrape.columns.renameColumn(model(), "Meta", "Title");
    assert.equal(collided.fields[2].name, "Title 2");
    assert.equal(collided.rows[0]["Title 2"], "Stationery");
    assert.equal(collided.rows[0].Title, "Acme Notebook");
    assert.deepEqual(collided.columnOrder, ["Title", "Price", "Title 2"]);
  });

  it("drop deletes the field and removes it from columnOrder and hiddenColumns", () => {
    const src = model();
    const dropped = ClickScrape.columns.dropColumn(src, "Price");
    assert.equal(dropped.fields.length, 2);
    assert.equal(dropped.fields.find((f) => f.name === "Price"), undefined);
    assert.deepEqual(dropped.columnOrder, ["Title", "Meta"]);
    assert.deepEqual(dropped.hiddenColumns, []);
    assert.deepEqual(
      ClickScrape.columns.visibleColumns(dropped.columnOrder, dropped.hiddenColumns),
      ["Title", "Meta"]
    );
  });

  it("move permutes visible order by ±1 without touching rows", () => {
    const order = ["Title", "Price", "Meta"];
    const snapshot = JSON.stringify(SAMPLE_ROWS);
    assert.deepEqual(ClickScrape.columns.moveColumn(order, "Title", 1), ["Price", "Title", "Meta"]);
    assert.deepEqual(ClickScrape.columns.moveColumn(order, "Meta", -1), ["Title", "Meta", "Price"]);
    assert.deepEqual(ClickScrape.columns.moveColumn(order, "Title", -1), ["Title", "Price", "Meta"]);
    assert.equal(JSON.stringify(SAMPLE_ROWS), snapshot);
  });

  it("applyPick unhides a dropped name without duplicating fields", () => {
    const src = model({
      hiddenColumns: ["Price"],
      columnOrder: ["Title", "Meta"],
    });
    const snapshot = src.fields.map((f) => f.relativeSelector);
    const next = ClickScrape.columns.applyPick("Price", {
      ...src,
      relativeSelector: ":scope .other-price",
    });
    assert.equal(next.added, false);
    assert.equal(next.name, "Price");
    assert.equal(next.fields.filter((f) => f.name === "Price").length, 1);
    assert.equal(next.fields.find((f) => f.name === "Price").relativeSelector, ":scope .price");
    assert.deepEqual(next.hiddenColumns, []);
    assert.deepEqual(next.columnOrder, ["Title", "Meta", "Price"]);
    assert.deepEqual(
      src.fields.map((f) => f.relativeSelector),
      snapshot
    );
  });

  it("applyPick uses uniqueName when the name is already a visible field", () => {
    const next = ClickScrape.columns.applyPick("Title", {
      ...model(),
      relativeSelector: ":scope .alt-title",
    });
    assert.equal(next.added, true);
    assert.equal(next.name, "Title 2");
    assert.equal(next.fields.length, 4);
    assert.equal(next.fields[3].name, "Title 2");
    assert.equal(next.fields[3].relativeSelector, ":scope .alt-title");
    assert.equal(next.fields[0].name, "Title");
    assert.deepEqual(next.columnOrder, ["Title", "Price", "Meta", "Title 2"]);
    assert.deepEqual(next.hiddenColumns, []);
  });

  it("applyPick appends a new name to fields and columnOrder", () => {
    const next = ClickScrape.columns.applyPick("Stock", {
      ...model(),
      relativeSelector: ":scope .stock",
    });
    assert.equal(next.added, true);
    assert.equal(next.name, "Stock");
    assert.equal(next.fields[3].name, "Stock");
    assert.equal(next.fields[3].relativeSelector, ":scope .stock");
    assert.deepEqual(next.columnOrder, ["Title", "Price", "Meta", "Stock"]);
  });

  it("CSV and JSON match visible preview order after drop and reorder", () => {
    let current = model();
    const dropped = ClickScrape.columns.dropColumn(current, "Meta");
    current = { ...current, ...dropped };
    current.columnOrder = ClickScrape.columns.moveColumn(current.columnOrder, "Title", 1);
    const columns = ClickScrape.columns.visibleColumns(current.columnOrder, current.hiddenColumns);

    assert.deepEqual(columns, ["Price", "Title"]);

    const csv = ClickScrape.export.toCsv(current.rows, columns);
    assert.equal(csv.split("\n")[0], "Price,Title");
    assert.equal(csv.split("\n")[1], "$12.00,Acme Notebook");
    assert.equal(csv.includes("Stationery"), false);

    const parsed = JSON.parse(ClickScrape.export.toJson(current.rows, columns));
    assert.deepEqual(Object.keys(parsed[0]), ["Price", "Title"]);
    assert.equal(parsed[0].Meta, undefined);
  });
});
