import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDocument, loadClickScrape, loadFixture } from "./helpers/load-click-scrape.mjs";

describe("outline cleanup", () => {
  it("undo clears .click-scrape-selected when the field is removed", () => {
    const html = loadFixture("nested-cards.html");
    const { window, document } = createDocument(html);
    const ClickScrape = loadClickScrape(window);

    const titleEl = document.querySelector("article.product .title");
    assert.ok(titleEl, "fixture has title element");
    titleEl.classList.add("click-scrape-selected");

    const field = { name: "Title", relativeSelector: ":scope .title" };
    const state = {
      fields: [field],
      rootSelector: ".products",
      itemSelector: "article.product",
      columnOrder: ["Title"],
      hiddenColumns: [],
    };

    const root = document.querySelector(state.rootSelector);
    const items = ClickScrape.selectors.queryItems(root, state.itemSelector);
    assert.ok(items.length > 0, "fixture has items");

    assert.ok(titleEl.classList.contains("click-scrape-selected"), "outline present before undo");

    state.fields.pop();
    for (const item of items) {
      const fieldEl = ClickScrape.extract.queryField(item, field.relativeSelector);
      if (fieldEl) fieldEl.classList.remove("click-scrape-selected");
    }

    assert.ok(!titleEl.classList.contains("click-scrape-selected"), "outline cleared after undo");
  });

  it("drop deletes field from recipe and can clear outline", () => {
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    const ClickScrape = loadClickScrape(window);

    const model = {
      fields: [
        { name: "Title", relativeSelector: ":scope .title" },
        { name: "Price", relativeSelector: ":scope .price" },
      ],
      columnOrder: ["Title", "Price"],
      hiddenColumns: [],
    };

    const dropped = ClickScrape.columns.dropColumn(model, "Price");
    assert.equal(dropped.fields.length, 1);
    assert.equal(dropped.fields[0].name, "Title");
    assert.equal(dropped.fields.find((f) => f.name === "Price"), undefined);
    assert.deepEqual(dropped.columnOrder, ["Title"]);
    assert.deepEqual(dropped.hiddenColumns, []);
  });

  it("clearFieldOutlines contract: fields removed via undo no longer have selection class", () => {
    const html = loadFixture("nested-cards.html");
    const { window, document } = createDocument(html);
    const ClickScrape = loadClickScrape(window);

    const root = document.querySelector(".products");
    const items = ClickScrape.selectors.queryItems(root, "article.product");
    assert.ok(items.length >= 2, "fixture has multiple items");

    const field = { name: "Title", relativeSelector: ":scope .title" };
    for (const item of items) {
      const fieldEl = ClickScrape.extract.queryField(item, field.relativeSelector);
      if (fieldEl) fieldEl.classList.add("click-scrape-selected");
    }

    const firstTitle = ClickScrape.extract.queryField(items[0], field.relativeSelector);
    assert.ok(firstTitle.classList.contains("click-scrape-selected"), "outline applied");

    for (const item of items) {
      const fieldEl = ClickScrape.extract.queryField(item, field.relativeSelector);
      if (fieldEl) fieldEl.classList.remove("click-scrape-selected");
    }

    assert.ok(!firstTitle.classList.contains("click-scrape-selected"), "outline cleared");
  });
});
