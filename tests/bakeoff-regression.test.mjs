import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadFixture,
  createDocument,
  loadClickScrape,
  resolveRelative,
} from "./helpers/load-click-scrape.mjs";

describe("bakeoff regression tests", () => {
  describe("laptop grid card completeness", () => {
    it("Name+Price pick should capture all 10 cards", () => {
      const html = loadFixture("laptop-grid.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      // Pick from first card's title
      const titleEl = document.querySelector(".title");
      assert.ok(titleEl, "fixture must have a title element");
      
      const ctx = ClickScrape.selectors.findListContext(titleEl);
      console.log("Title context:", {
        itemsLength: ctx.items.length,
        itemSelector: ctx.itemSelector,
        rootSelector: ctx.rootSelector
      });

      assert.ok(ctx.items.length >= 10, `must detect all 10 cards, got ${ctx.items.length}`);

      // Pick from first card's price
      const priceEl = document.querySelector(".price");
      assert.ok(priceEl, "fixture must have a price element");

      const priceCtx = ClickScrape.selectors.findListContext(priceEl);
      console.log("Price context:", {
        itemsLength: priceCtx.items.length,
        itemSelector: priceCtx.itemSelector,
        rootSelector: priceCtx.rootSelector
      });

      assert.ok(priceCtx.items.length >= 10, `must detect all 10 cards from price too, got ${priceCtx.items.length}`);

      // Verify the title field resolves on all items
      const sampleItem = ctx.items[0];
      const titleRel = ClickScrape.selectors.relativeSelector(sampleItem, titleEl);
      
      let titleMatchCount = 0;
      for (const item of ctx.items) {
        const resolved = resolveRelative(item, titleRel);
        if (resolved && resolved.classList.contains("title")) {
          titleMatchCount++;
        }
      }
      
      assert.equal(titleMatchCount, ctx.items.length, 
        `title field must resolve on all ${ctx.items.length} cards, got ${titleMatchCount}`);
    });

    it("extracts full title text from title attribute when present", () => {
      const html = loadFixture("laptop-grid.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      const titleEl = document.querySelector(".title");
      const ctx = ClickScrape.selectors.findListContext(titleEl);
      const sampleItem = ctx.items[0];

      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          {
            name: "Name",
            relativeSelector: ClickScrape.selectors.relativeSelector(sampleItem, titleEl)
          }
        ]
      };

      const rows = ClickScrape.extract.extractRows(recipe, document);
      console.log("First row Name:", rows[0].Name);

      // Should extract full title, not truncated ellipsis version
      assert.match(rows[0].Name, /Asus VivoBook X441NA-GA190/, 
        "Should extract full title text, not truncated 'Asus VivoBook X441NA-GA190...'");
      
      // Should NOT contain ellipsis
      assert.ok(!rows[0].Name.includes("..."), 
        "Extracted text should not contain ellipsis from display text");
    });
  });

  describe("quotes simple two-field pick", () => {
    it("Quote+Author pick should capture all 7 quotes cleanly", () => {
      const html = loadFixture("quotes-simple.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      // Pick from first quote's text
      const textEl = document.querySelector(".quote .text");
      assert.ok(textEl, "fixture must have a quote text element");
      
      const ctx = ClickScrape.selectors.findListContext(textEl);
      assert.ok(ctx.items.length >= 7, `must detect all 7 quotes, got ${ctx.items.length}`);

      // Pick from first quote's author
      const authorEl = document.querySelector(".quote .author");
      assert.ok(authorEl, "fixture must have an author element");

      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          {
            name: "Quote",
            relativeSelector: ClickScrape.selectors.relativeSelector(ctx.items[0], textEl)
          },
          {
            name: "Author",
            relativeSelector: ClickScrape.selectors.relativeSelector(ctx.items[0], authorEl)
          }
        ]
      };

      const rows = ClickScrape.extract.extractRows(recipe, document);
      
      assert.equal(rows.length, 7, "must extract all 7 quotes");
      assert.ok(rows[0].Quote.includes("The world as we have created it"), 
        "first quote text should be extracted");
      assert.equal(rows[0].Author, "Albert Einstein", 
        "first author should be Albert Einstein");
    });

    it("walkPages across quotes page 1+2 yields ~10 unique quotes", async () => {
      const page1Html = loadFixture("quotes-simple.html");
      const page2Html = loadFixture("quotes-page-2.html");
      
      const { window: win1, document: doc1 } = createDocument(page1Html);
      const ClickScrape = loadClickScrape(win1);
      const { document: doc2 } = createDocument(page2Html);

      const textEl = doc1.querySelector(".quote .text");
      const authorEl = doc1.querySelector(".quote .author");
      const ctx = ClickScrape.selectors.findListContext(textEl);

      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          {
            name: "Quote",
            relativeSelector: ClickScrape.selectors.relativeSelector(ctx.items[0], textEl)
          },
          {
            name: "Author",
            relativeSelector: ClickScrape.selectors.relativeSelector(ctx.items[0], authorEl)
          }
        ]
      };

      const baseUrl = "https://example.com/quotes-simple.html";
      
      let fetchCount = 0;
      const result = await ClickScrape.pagination.walkPages(recipe, doc1, {
        currentUrl: baseUrl,
        maxPages: 2,
        fetchPage: async (url) => {
          fetchCount++;
          assert.match(url, /quotes-page-2\.html/, "should fetch page 2");
          return doc2;
        }
      });

      assert.ok(result.rows.length >= 10, `walkPages should yield ~10 rows from 2 pages, got ${result.rows.length}`);
      assert.equal(result.pages, 2, "should walk 2 pages");
      assert.equal(fetchCount, 1, "should fetch exactly one next page");
      
      // Verify no duplicates
      const seen = new Set();
      for (const row of result.rows) {
        const key = `${row.Quote}::${row.Author}`;
        assert.ok(!seen.has(key), `duplicate quote found: ${row.Quote.slice(0, 50)}...`);
        seen.add(key);
      }
    });
  });
});
