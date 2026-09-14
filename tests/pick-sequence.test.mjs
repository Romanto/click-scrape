import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  loadFixture,
  createDocument,
  loadClickScrape,
} from "./helpers/load-click-scrape.mjs";

describe("pick sequence (Title then Price)", () => {
  let doc;
  let ClickScrape;

  beforeEach(() => {
    const html = loadFixture("nested-cards.html");
    const { window, document } = createDocument(html);
    ClickScrape = loadClickScrape(window);
    doc = document;
  });

  it("Title then Price picks yield correct column values (no swap)", () => {
    const titleEl = doc.querySelector(".products .title");
    const priceEl = doc.querySelector(".products .price");

    const titleCtx = ClickScrape.selectors.findListContext(titleEl);
    const sampleItem = titleCtx.items[0];

    // Simulate first pick: Title
    const titleRel = ClickScrape.selectors.relativeSelector(sampleItem, titleEl);
    const afterTitle = ClickScrape.columns.applyPick("Title", {
      fields: [],
      columnOrder: [],
      hiddenColumns: [],
      relativeSelector: titleRel,
    });

    assert.equal(afterTitle.added, true);
    assert.equal(afterTitle.name, "Title");
    assert.equal(afterTitle.fields.length, 1);
    assert.equal(afterTitle.fields[0].name, "Title");
    assert.equal(afterTitle.fields[0].relativeSelector, titleRel);

    // Simulate second pick: Price
    const priceRel = ClickScrape.selectors.relativeSelector(sampleItem, priceEl);
    const afterPrice = ClickScrape.columns.applyPick("Price", {
      fields: afterTitle.fields,
      columnOrder: afterTitle.columnOrder,
      hiddenColumns: afterTitle.hiddenColumns,
      relativeSelector: priceRel,
    });

    assert.equal(afterPrice.added, true);
    assert.equal(afterPrice.name, "Price");
    assert.equal(afterPrice.fields.length, 2);
    
    // KEY: Verify no swap - Title field still has title selector, Price has price selector
    assert.equal(afterPrice.fields[0].name, "Title");
    assert.equal(afterPrice.fields[0].relativeSelector, titleRel, "Title field must keep title selector");
    assert.equal(afterPrice.fields[1].name, "Price");
    assert.equal(afterPrice.fields[1].relativeSelector, priceRel, "Price field must have price selector");

    // Extract rows with both fields
    const recipe = {
      rootSelector: titleCtx.rootSelector,
      itemSelector: titleCtx.itemSelector,
      fields: afterPrice.fields,
    };

    const rows = ClickScrape.extract.extractRows(recipe, doc);

    assert.equal(rows.length, 3);
    // Verify no swap: Title column has title values, Price column has price values
    assert.equal(rows[0].Title, "Acme Notebook", "Title column should show title value, not price");
    assert.equal(rows[0].Price, "$12.00", "Price column should show price value, not title");
    assert.equal(rows[1].Title, "Bright Lamp");
    assert.equal(rows[1].Price, "$34.50");
    assert.equal(rows[2].Title, "USB-C Hub");
    assert.equal(rows[2].Price, "$29.99");
  });

  it("picks from different cards still extract correctly", () => {
    const titleEl = doc.querySelector(".products article:nth-child(1) .title");
    const priceEl = doc.querySelector(".products article:nth-child(2) .price");

    const titleCtx = ClickScrape.selectors.findListContext(titleEl);
    const titleItem = titleCtx.items[0];
    const priceItem = titleCtx.items[1];

    // First pick: Title from card 1
    const titleRel = ClickScrape.selectors.relativeSelector(titleItem, titleEl);
    const pickedTitle = ClickScrape.columns.applyPick("Title", {
      fields: [],
      columnOrder: [],
      hiddenColumns: [],
      relativeSelector: titleRel,
    });

    // Second pick: Price from card 2 (different item)
    const priceRel = ClickScrape.selectors.relativeSelector(priceItem, priceEl);
    const pickedPrice = ClickScrape.columns.applyPick("Price", {
      fields: pickedTitle.fields,
      columnOrder: pickedTitle.columnOrder,
      hiddenColumns: pickedTitle.hiddenColumns,
      relativeSelector: priceRel,
    });

    // Extract rows - both selectors should work across all items
    const recipe = {
      rootSelector: titleCtx.rootSelector,
      itemSelector: titleCtx.itemSelector,
      fields: pickedPrice.fields,
    };
    const rows = ClickScrape.extract.extractRows(recipe, doc);

    assert.equal(rows.length, 3);
    assert.equal(rows[0].Title, "Acme Notebook");
    assert.equal(rows[0].Price, "$12.00");
    assert.equal(rows[1].Title, "Bright Lamp");
    assert.equal(rows[1].Price, "$34.50");
  });
});
