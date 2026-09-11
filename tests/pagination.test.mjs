import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach } from "node:test";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE1_HTML = readFileSync(path.join(ROOT, "demo.html"), "utf8");
const PAGE2_HTML = readFileSync(path.join(ROOT, "demo-page-2.html"), "utf8");
const BASE = "https://example.com/demo.html";
const PAGE2_URL = "https://example.com/demo-page-2.html";

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

describe("pagination", () => {
  let page1;
  let page2;
  let ClickScrape;
  let recipe;

  beforeEach(() => {
    const d1 = createDocument(PAGE1_HTML);
    ClickScrape = loadClickScrape(d1.window);
    page1 = d1.document;
    page2 = createDocument(PAGE2_HTML).document;
    recipe = buildRecipe(ClickScrape, page1);
  });

  it("findNextUrl prefers a[rel=next] on demo page 1", () => {
    const next = ClickScrape.pagination.findNextUrl(page1, BASE);
    assert.match(next, /demo-page-2\.html/);
  });

  it("findNextUrl finds Next text when rel=next is absent", () => {
    const html = `<nav class="pagination">
      <span class="current">1</span>
      <a href="page-b.html">Next</a>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/page-a.html");
    assert.match(next, /page-b\.html/);
  });

  it("findNextUrl finds numbered page 2 when current is 1", () => {
    const html = `<nav class="pagination">
      <span class="current">1</span>
      <a href="/results?page=2">2</a>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/results?page=1");
    assert.match(next, /page=2/);
  });

  it("findNextUrl returns empty on demo page 2 (no next)", () => {
    const next = ClickScrape.pagination.findNextUrl(page2, PAGE2_URL);
    assert.equal(next, "");
  });

  it("findNextUrl does not follow Previous", () => {
    const html = `<nav class="pagination">
      <a href="demo.html">‹ Previous</a>
      <a href="demo.html">1</a>
      <span class="current">2</span>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, PAGE2_URL);
    assert.equal(next, "");
  });

  it("mergeRows dedupes by concatenated column values", () => {
    const cols = ["Title", "Price"];
    const a = [
      { Title: "Acme Notebook", Price: "$12.00" },
      { Title: "Bright Lamp", Price: "$34.50" },
    ];
    const b = [
      { Title: "Acme Notebook", Price: "$12.00", Extra: "noise" },
      { Title: "USB-C Hub", Price: "$29.99" },
    ];
    const merged = ClickScrape.pagination.mergeRows(a, b, cols);
    assert.equal(merged.length, 3);
    for (const row of merged) {
      assert.equal(Object.keys(row).join("|"), "Title|Price");
    }
    assert.equal(merged.some((row) => "Extra" in row), false);
    assert.equal(merged[2].Title, "USB-C Hub");
  });

  it("walkPages merges demo page 1+2 into 10 unique stable-column rows", async () => {
    const page1Rows = ClickScrape.extract.extractRows(recipe, page1);
    const page2Rows = ClickScrape.extract.extractRows(recipe, page2);
    assert.equal(page1Rows.length, 5, "demo.html has 5 products");
    assert.equal(page2Rows.length, 5, "demo-page-2.html has 5 products");

    let persisted = 0;
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      extractRows: (r, d) => ClickScrape.extract.extractRows(r, d),
      persistPageCount: async (n) => {
        persisted = n;
      },
      fetchPage: async (url) => {
        assert.match(url, /demo-page-2\.html/);
        return page2;
      },
    });

    assert.equal(result.pages, 2);
    assert.equal(persisted, 2);
    assert.equal(result.rows.length, 10, "5+5 unique rows");
    assert.deepEqual(result.columns, ["Title", "Price"]);
    for (const row of result.rows) {
      assert.deepEqual(Object.keys(row), ["Title", "Price"]);
    }

    const titles = result.rows.map((row) => row.Title);
    assert.equal(new Set(titles).size, 10);
    assert.ok(titles.includes("Acme Notebook"));
    assert.ok(titles.includes("Stainless Water Bottle"));

    const again = ClickScrape.pagination.mergeRows(result.rows, page1Rows, result.columns);
    assert.equal(again.length, 10, "re-merging page 1 must not duplicate");
  });

  it("walkPages options.columns omits dropped fields after merge", async () => {
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      columns: ["Title"],
      extractRows: (r, d) => ClickScrape.extract.extractRows(r, d),
      fetchPage: async (url) => {
        assert.match(url, /demo-page-2\.html/);
        return page2;
      },
    });
    assert.deepEqual(result.columns, ["Title"]);
    assert.equal(result.rows.length, 10);
    for (const row of result.rows) {
      assert.deepEqual(Object.keys(row), ["Title"]);
      assert.equal("Price" in row, false);
    }
  });

  it("walkPages stops on fetch failure and keeps page-1 rows", async () => {
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      fetchPage: async () => {
        throw new Error("CORS");
      },
    });
    assert.equal(result.pages, 1);
    assert.equal(result.rows.length, 5);
    assert.match(result.hint, /CORS|blocked/i);
  });

  it("walkPages caps the walk at maxPages", async () => {
    const looping = `<html><body>
      <div class="products"><article class="product"><span class="title">X</span><span class="price">$1</span></article></div>
      <a rel="next" href="https://example.com/p?n=next">Next</a>
    </body></html>`;
    let fetches = 0;
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      maxPages: 3,
      fetchPage: async (url) => {
        fetches += 1;
        const { document } = createDocument(looping.replace("n=next", `n=${fetches}`));
        return document;
      },
    });
    assert.equal(result.pages, 3);
    assert.equal(fetches, 2);
  });

  it("findNextUrl matches rel~=next token lists", () => {
    const html = `<nav class="pagination">
      <a rel="next prefetch" href="page-b.html">Continue</a>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/page-a.html");
    assert.match(next, /page-b\.html/);
  });

  it("findNextUrl prefers Next inside .pagination over an earlier decoy", () => {
    const html = `<p><a href="https://ads.example/skip">Next</a></p>
    <nav class="pagination">
      <a href="page-b.html">Next</a>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/page-a.html");
    assert.match(next, /page-b\.html/);
    assert.equal(/ads\.example/.test(next), false);
  });

  it("findNextUrl ignores unqualified .current outside pagination", () => {
    const html = `<div class="carousel"><span class="current">5</span></div>
    <nav class="pagination">
      <span class="current">1</span>
      <a href="/results?page=2">2</a>
    </nav>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/results?page=1");
    assert.match(next, /page=2/);
  });

  it("findNextUrl does not treat a stray .current as the page number", () => {
    const html = `<div class="carousel"><span class="current">1</span></div>
    <a href="/results?page=2">2</a>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const next = CS.pagination.findNextUrl(document, "https://example.com/results?page=1");
    assert.equal(next, "");
  });

  it("walkPages does not fetch a cross-origin next URL", async () => {
    const html = `<html><body>
      <div class="products"><article class="product"><span class="title">X</span><span class="price">$1</span></article></div>
      <a rel="next" href="https://evil.example/page2">Next</a>
    </body></html>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const r = buildRecipe(CS, document);
    let fetches = 0;
    const result = await CS.pagination.walkPages(r, document, {
      currentUrl: "https://example.com/page1",
      fetchPage: async () => {
        fetches += 1;
        return document;
      },
    });
    assert.equal(fetches, 0);
    assert.equal(result.pages, 1);
    assert.match(result.hint, /blocked|CORS/i);
  });

  it("walkPages skips origin check when currentUrl is a file URL", async () => {
    let fetched = "";
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: "file:///tmp/demo.html",
      fetchPage: async (url) => {
        fetched = url;
        return page2;
      },
    });
    assert.match(fetched, /demo-page-2\.html/);
    assert.equal(result.pages, 2);
  });

  it("walkPages stops when the abort signal fires", async () => {
    const looping = `<html><body>
      <div class="products"><article class="product"><span class="title">X</span><span class="price">$1</span></article></div>
      <a rel="next" href="https://example.com/p?n=next">Next</a>
    </body></html>`;
    const ac = new AbortController();
    let fetches = 0;
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      maxPages: 10,
      signal: ac.signal,
      fetchPage: async () => {
        fetches += 1;
        ac.abort();
        const { document } = createDocument(looping.replace("n=next", `n=${fetches}`));
        return document;
      },
    });
    assert.equal(fetches, 1);
    assert.ok(result.pages <= 2);
    assert.match(result.hint, /stopped/i);
  });

  it("walkPages does not fetch when already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    let fetches = 0;
    const result = await ClickScrape.pagination.walkPages(recipe, page1, {
      currentUrl: BASE,
      signal: ac.signal,
      fetchPage: async () => {
        fetches += 1;
        return page2;
      },
    });
    assert.equal(fetches, 0);
    assert.equal(result.pages, 1);
    assert.equal(result.rows.length, 5);
  });
});
