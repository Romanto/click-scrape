import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

describe("rows helpers", () => {
  let rows;

  beforeEach(() => {
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    rows = loadClickScrape(window).rows;
  });

  it("updateCell copies rows and sets one value", () => {
    const input = [
      { Title: "A", Price: "$1" },
      { Title: "B", Price: "$2" },
    ];
    const next = rows.updateCell(input, 1, "Price", "$9");
    assert.equal(input[1].Price, "$2");
    assert.equal(next[1].Price, "$9");
    assert.equal(next[0].Title, "A");
  });

  it("addRow appends empty cells for columns", () => {
    const next = rows.addRow([{ Title: "A" }], ["Title", "Price"]);
    assert.equal(next.length, 2);
    assert.equal(next[1].Title, "");
    assert.equal(next[1].Price, "");
  });

  it("removeRow drops by index", () => {
    const next = rows.removeRow([{ Title: "A" }, { Title: "B" }, { Title: "C" }], 1);
    assert.deepEqual(
      next.map((r) => r.Title),
      ["A", "C"]
    );
  });

  it("stripColumn removes keys from every row", () => {
    const next = rows.stripColumn(
      [
        { Title: "A", Price: "$1" },
        { Title: "B", Price: "$2" },
      ],
      "Price"
    );
    assert.equal(next.length, 2);
    assert.equal(next[0].Title, "A");
    assert.equal(next[0].Price, undefined);
    assert.equal(next[1].Title, "B");
    assert.equal(next[1].Price, undefined);
  });

  it("mergeColumn fills a field by index without wiping other keys", () => {
    const edited = [
      { Title: "edited", Price: "" },
      { Title: "B", Price: "" },
    ];
    const scraped = [{ Title: "A", Price: "$1" }, { Title: "B", Price: "$2" }, { Title: "C", Price: "$3" }];
    const next = rows.mergeColumn(edited, "Price", scraped);
    assert.equal(next[0].Title, "edited");
    assert.equal(next[0].Price, "$1");
    assert.equal(next[1].Price, "$2");
    assert.equal(next[2].Title, "C");
    assert.equal(next[2].Price, "$3");
  });
});
