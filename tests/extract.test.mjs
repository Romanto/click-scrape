import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  loadFixture,
  createDocument,
  loadClickScrape,
  assertItemRelative,
} from "./helpers/load-click-scrape.mjs";

function buildRecipe(ClickScrape, doc) {
  const titleEl = doc.querySelector(".products .title");
  const priceEl = doc.querySelector(".products .price");
  const titleCtx = ClickScrape.selectors.findListContext(titleEl);
  const sampleItem = titleCtx.items[0];

  return {
    rootSelector: titleCtx.rootSelector,
    itemSelector: titleCtx.itemSelector,
    fields: [
      {
        name: "Title",
        relativeSelector: ClickScrape.selectors.relativeSelector(sampleItem, titleEl),
      },
      {
        name: "Price",
        relativeSelector: ClickScrape.selectors.relativeSelector(sampleItem, priceEl),
      },
    ],
  };
}

describe("extract", () => {
  let doc;
  let ClickScrape;
  let recipe;

  beforeEach(() => {
    const html = loadFixture("nested-cards.html");
    const { window, document } = createDocument(html);
    ClickScrape = loadClickScrape(window);
    doc = document;
    recipe = buildRecipe(ClickScrape, doc);
  });

  it("recipe fields use item-relative selectors", () => {
    for (const field of recipe.fields) {
      assertItemRelative(field.relativeSelector);
    }
  });

  it("extractRows yields one row per sibling card with Title and Price columns", () => {
    const rows = ClickScrape.extract.extractRows(recipe, doc);

    assert.equal(rows.length, 3, "one row per product card");
    assert.deepEqual(
      Object.keys(rows[0]),
      ["Title", "Price"],
      "consistent column keys across rows"
    );

    for (const row of rows) {
      assert.ok(row.Title.length > 0, "Title must be extracted");
      assert.match(row.Price, /^\$\d+\.\d{2}$/, "Price must be extracted");
    }

    const titles = rows.map((row) => `${row.Title}`);
    const prices = rows.map((row) => `${row.Price}`);
    assert.equal(titles.join("|"), "Acme Notebook|Bright Lamp|USB-C Hub");
    assert.equal(prices.join("|"), "$12.00|$34.50|$29.99");
  });

  it("same recipe run twice on the same fixture rematches row count and keys", () => {
    const first = ClickScrape.extract.extractRows(recipe, doc);
    const second = ClickScrape.extract.extractRows(recipe, doc);

    assert.equal(first.length, second.length);
    assert.deepEqual(
      first.map((row) => Object.keys(row)),
      second.map((row) => Object.keys(row))
    );
    assert.deepEqual(first, second);
  });

  it("extractRows works when itemSelector is explicitly article.product", () => {
    const explicitRecipe = {
      ...recipe,
      rootSelector: ".products",
      itemSelector: "article.product",
    };

    const rows = ClickScrape.extract.extractRows(explicitRecipe, doc);
    assert.equal(rows.length, 3);
    assert.deepEqual(Object.keys(rows[0]), ["Title", "Price"]);
  });
});
