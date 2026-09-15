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
    it("Name+Price pick should capture all cards including duplicate visible keys", () => {
      const html = loadFixture("laptop-grid.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      // Pick from first card's title
      const titleEl = document.querySelector(".title");
      assert.ok(titleEl, "fixture must have a title element");
      
      const ctx = ClickScrape.selectors.findListContext(titleEl);

      assert.ok(ctx.items.length >= 12, `must detect all 12 cards, got ${ctx.items.length}`);

      // Pick from first card's price
      const priceEl = document.querySelector(".price");
      assert.ok(priceEl, "fixture must have a price element");

      const priceCtx = ClickScrape.selectors.findListContext(priceEl);

      assert.ok(priceCtx.items.length >= 12, `must detect all 12 cards from price too, got ${priceCtx.items.length}`);

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

      // Should extract full title, not truncated ellipsis version
      assert.match(rows[0].Name, /Asus VivoBook X441NA-GA190/, 
        "Should extract full title text, not truncated 'Asus VivoBook X441NA-GA190...'");
      
      // Should NOT contain ellipsis
      assert.ok(!rows[0].Name.includes("..."), 
        "Extracted text should not contain ellipsis from display text");
    });

    it("keeps two cards with identical Name|Price when hrefs differ", async () => {
      const html = loadFixture("laptop-grid.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      const titleEl = document.querySelector(".title");
      const priceEl = document.querySelector(".price");
      const ctx = ClickScrape.selectors.findListContext(titleEl);
      const sampleItem = ctx.items[0];
      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          {
            name: "Name",
            relativeSelector: ClickScrape.selectors.relativeSelector(sampleItem, titleEl),
          },
          {
            name: "Price",
            relativeSelector: ClickScrape.selectors.relativeSelector(sampleItem, priceEl),
          },
        ],
      };

      const extracted = ClickScrape.extract.extractRows(recipe, document);
      assert.equal(extracted.length, 12, "extractRows should keep all 12 cards");

      const dupes = extracted.filter((r) => r.Name === "MSI GL72M 7RDX" && r.Price === "$1099");
      assert.equal(dupes.length, 2, "fixture must include two MSI rows with same visible columns");
      assert.notEqual(dupes[0].__itemId, dupes[1].__itemId, "duplicate visible rows need distinct __itemId");

      const merged = ClickScrape.pagination.mergeRows([], extracted, ["Name", "Price"]);
      assert.equal(merged.length, 12, "mergeRows must not collapse distinct hrefs");

      const scraped = await ClickScrape.lazyLoad.scrapeRecipeWhileScrolling(recipe, document, {
        settleMs: 1,
        stableRounds: 2,
        maxRounds: 5,
        wait: async () => {},
        columns: ["Name", "Price"],
      });
      assert.equal(scraped.rows.length, 12, "scroll-merge must keep 12 rows");
    });
  });

  describe("books.toscrape product_pod Title|Price", () => {
    it("Title on h3 + Price yield full titles and prices", () => {
      const html = loadFixture("books-product-pod.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);

      const h3 = document.querySelector("article.product_pod h3");
      const priceEl = document.querySelector("article.product_pod .price_color");
      const ctx = ClickScrape.selectors.findListContext(h3);
      assert.ok(ctx.items.length >= 3, `expected product pods, got ${ctx.items.length}`);

      const item = ctx.items.find((i) => i.contains(h3)) || ctx.items[0];
      const titleRel = ClickScrape.selectors.relativeSelector(item, h3);
      const priceRel = ClickScrape.selectors.relativeSelector(item, priceEl);

      assert.match(titleRel, /a/i, "Title relative selector should target the titled anchor, not bare h3 only");
      assert.notEqual(titleRel.trim(), ":scope a", "must not save ambiguous :scope a (image link)");

      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          { name: "Title", relativeSelector: titleRel },
          { name: "Price", relativeSelector: priceRel },
        ],
      };
      const rows = ClickScrape.extract.extractRows(recipe, document);
      assert.equal(rows.length, 3);
      assert.equal(rows[0].Title, "A Light in the Attic");
      assert.ok(!rows[0].Title.includes("..."), "title must not stay truncated");
      assert.equal(rows[0].Price, "£51.77");
      assert.equal(rows[1].Title, "Tipping the Velvet");
      assert.equal(rows[1].Price, "£53.74");
    });

    it("Title on h3 a + Price walk-merge page 2 stays aligned", async () => {
      const page1 = loadFixture("books-product-pod.html");
      const page2 = loadFixture("books-page-2.html");
      const { window, document } = createDocument(page1);
      const ClickScrape = loadClickScrape(window);
      const { document: doc2 } = createDocument(page2);

      const titleEl = document.querySelector("article.product_pod h3 a");
      const priceEl = document.querySelector("article.product_pod .price_color");
      const ctx = ClickScrape.selectors.findListContext(titleEl);
      const item = ctx.items.find((i) => i.contains(titleEl)) || ctx.items[0];
      const recipe = {
        rootSelector: ctx.rootSelector,
        itemSelector: ctx.itemSelector,
        fields: [
          {
            name: "Title",
            relativeSelector: ClickScrape.selectors.relativeSelector(item, titleEl),
          },
          {
            name: "Price",
            relativeSelector: ClickScrape.selectors.relativeSelector(item, priceEl),
          },
        ],
      };

      const result = await ClickScrape.pagination.walkPages(recipe, document, {
        currentUrl: "https://example.com/books-product-pod.html",
        maxPages: 2,
        fetchPage: async () => doc2,
      });

      assert.equal(result.pages, 2);
      assert.equal(result.rows.length, 5);
      assert.equal(result.rows[0].Title, "A Light in the Attic");
      assert.equal(result.rows[0].Price, "£51.77");
      assert.equal(result.rows[3].Title, "In Her Wake");
      assert.equal(result.rows[3].Price, "£12.84");
      assert.ok(result.rows.every((r) => r.Title && r.Price && !String(r.Title).includes("...")));
    });

    it("extractText on h3 prefers descendant a[title]", () => {
      const html = loadFixture("books-product-pod.html");
      const { window, document } = createDocument(html);
      const ClickScrape = loadClickScrape(window);
      const h3 = document.querySelector("article.product_pod h3");
      assert.equal(ClickScrape.extract.extractText(h3), "A Light in the Attic");
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
