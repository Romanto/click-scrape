import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

const SAMPLE_ROWS = [
  { Title: "Acme Notebook", Price: "$12.00", Meta: "Stationery" },
  { Title: "Bright Lamp", Price: "$34.50", Meta: "Home" },
];

describe("export", () => {
  let ClickScrape;

  beforeEach(() => {
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    ClickScrape = loadClickScrape(window);
  });

  it("toJson projects only requested columns in order", () => {
    assert.equal(typeof ClickScrape.export.toJson, "function", "toJson must exist");

    const jsonText = ClickScrape.export.toJson(SAMPLE_ROWS, ["Price", "Title"]);
    const parsed = JSON.parse(jsonText);

    assert.equal(parsed.length, 2);
    assert.deepEqual(Object.keys(parsed[0]), ["Price", "Title"]);
    assert.deepEqual(Object.keys(parsed[1]), ["Price", "Title"]);
    assert.equal(parsed[0].Price, "$12.00");
    assert.equal(parsed[0].Title, "Acme Notebook");
    assert.equal(parsed[0].Meta, undefined);
    assert.equal(parsed[1].Meta, undefined);
  });

  it("exportJson with columns array projects before download", () => {
    let downloaded = "";
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    loadClickScrape(window, {
      Blob: class Blob {
        constructor(parts) {
          downloaded = parts.map(String).join("");
        }
      },
    });

    window.ClickScrape.export.exportJson(SAMPLE_ROWS, ["Price", "Title"], "demo");
    const parsed = JSON.parse(downloaded);
    assert.deepEqual(Object.keys(parsed[0]), ["Price", "Title"]);
    assert.equal(parsed[0].Meta, undefined);
  });

  it("toCsv unchanged: still respects column order", () => {
    const csv = ClickScrape.export.toCsv(SAMPLE_ROWS, ["Price", "Title"]);
    assert.equal(csv.split("\n")[0], "Price,Title");
    assert.equal(csv.split("\n")[1], "$12.00,Acme Notebook");
  });

  it("toCsvTables joins groups with a blank separator line", () => {
    const csv = ClickScrape.export.toCsvTables([
      { columns: ["Pack"], rows: [{ Pack: "5" }, { Pack: "6" }] },
      { columns: ["Size"], rows: [{ Size: "Small" }, { Size: "Medium" }] },
    ]);
    const lines = csv.split("\n");
    assert.deepEqual(lines, ["Pack", "5", "6", "", "Size", "Small", "Medium"]);
  });

  it("toJsonTables returns an array of projected tables", () => {
    const parsed = JSON.parse(
      ClickScrape.export.toJsonTables([
        { columns: ["Pack"], rows: [{ Pack: "5", Extra: "x" }] },
        { columns: ["Size"], rows: [{ Size: "Small" }] },
      ])
    );
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], { columns: ["Pack"], rows: [{ Pack: "5" }] });
    assert.deepEqual(parsed[1], { columns: ["Size"], rows: [{ Size: "Small" }] });
  });
});
