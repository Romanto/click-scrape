import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

describe("lazy load scroll", () => {
  let ClickScrape;
  let document;
  let window;

  beforeEach(() => {
    ({ window, document } = createDocument(`<!DOCTYPE html><html><body>
      <div id="list" class="feed">
        <article class="card"><span class="t">A</span></article>
        <article class="card"><span class="t">B</span></article>
      </div>
    </body></html>`));
    ClickScrape = loadClickScrape(window);
  });

  it("exposes lazyLoad helpers", () => {
    assert.equal(typeof ClickScrape.lazyLoad.scrollToRevealItems, "function");
    assert.equal(typeof ClickScrape.lazyLoad.revealRecipeItems, "function");
    assert.equal(typeof ClickScrape.lazyLoad.scrapeRecipeWhileScrolling, "function");
    assert.equal(typeof ClickScrape.lazyLoad.findScrollParent, "function");
  });

  it("scrollToRevealItems grows item count until stable via injectable scroll", async () => {
    const root = document.getElementById("list");
    let hidden = 0;
    const pending = ["C", "D", "E"];
    const result = await ClickScrape.lazyLoad.scrollToRevealItems(root, {
      itemSelector: "article.card",
      settleMs: 1,
      stableRounds: 2,
      maxRounds: 20,
      wait: async () => {},
      doScroll: () => {
        if (hidden < pending.length) {
          const art = document.createElement("article");
          art.className = "card";
          art.innerHTML = `<span class="t">${pending[hidden]}</span>`;
          root.appendChild(art);
          hidden += 1;
          return 40;
        }
        return 0;
      },
    });
    assert.equal(result.itemCount, 5);
    assert.ok(result.rounds >= 3);
    assert.ok(["stable", "bottom", "no-scroll"].includes(result.stopped));
  });

  it("scrapeRecipeWhileScrolling merges rows across rounds (virtualization-safe)", async () => {
    const root = document.getElementById("list");
    const recipe = {
      rootSelector: "#list",
      itemSelector: "article.card",
      fields: [{ name: "T", relativeSelector: ":scope .t" }],
    };
    let wave = 0;
    // Simulate virtualization: replace DOM contents each wave but keep merging titles.
    const waves = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ];
    const origScroll = ClickScrape.lazyLoad.scrollToRevealItems;
    assert.ok(origScroll);

    // Patch scrollStep path by using a custom wait/doScroll via scrape internals:
    // drive growth by mutating DOM between waits with a fake scroll parent height.
    Object.defineProperty(root, "scrollHeight", { get: () => 2000, configurable: true });
    Object.defineProperty(root, "clientHeight", { get: () => 400, configurable: true });
    let top = 0;
    Object.defineProperty(root, "scrollTop", {
      get: () => top,
      set: (v) => {
        top = Number(v) || 0;
        if (wave < waves.length) {
          root.innerHTML = waves[wave]
            .map((t) => `<article class="card"><span class="t">${t}</span></article>`)
            .join("");
          wave += 1;
        }
      },
      configurable: true,
    });

    const result = await ClickScrape.lazyLoad.scrapeRecipeWhileScrolling(recipe, document, {
      settleMs: 1,
      stableRounds: 2,
      maxRounds: 10,
      wait: async () => {},
      columns: ["T"],
    });
    const titles = result.rows.map((r) => r.T).sort();
    assert.equal(titles.join("|"), "A|B|C|D|E|F");
  });

  it("stops on abort signal", async () => {
    const root = document.getElementById("list");
    const ac = new AbortController();
    let scrolls = 0;
    const p = ClickScrape.lazyLoad.scrollToRevealItems(root, {
      itemSelector: "article.card",
      settleMs: 5,
      maxRounds: 50,
      wait: (ms, signal) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            },
            { once: true }
          );
        }),
      doScroll: () => {
        scrolls += 1;
        if (scrolls === 1) ac.abort();
        return 20;
      },
      signal: ac.signal,
    });
    const result = await p;
    assert.equal(result.stopped, "aborted");
    assert.ok(result.rounds <= 2);
  });

  it("revealRecipeItems no-ops for offline DOMParser-like docs", async () => {
    const { window: w2, document: d2 } = createDocument(`<!DOCTYPE html><body>
      <div id="list"><article class="card">X</article><article class="card">Y</article></div>
    </body>`);
    const CS2 = loadClickScrape(w2);
    Object.defineProperty(d2, "defaultView", { value: null, configurable: true });
    const offlineResult = await CS2.lazyLoad.revealRecipeItems(
      { rootSelector: "#list", itemSelector: "article.card" },
      d2
    );
    assert.equal(offlineResult.stopped, "offline-doc");
    assert.equal(offlineResult.itemCount, 2);
  });

  it("walkPages beforeExtract rows seed page-1 extract", async () => {
    let order = [];
    const recipe = {
      rootSelector: "#list",
      itemSelector: "article.card",
      fields: [{ name: "T", relativeSelector: ":scope .t" }],
    };
    const result = await ClickScrape.pagination.walkPages(recipe, document, {
      currentUrl: "http://127.0.0.1:8765/demo.html",
      maxPages: 1,
      beforeExtract: async () => {
        order.push("before");
        return { rows: [{ T: "Seeded" }] };
      },
      extractRows: () => {
        order.push("extract");
        return [{ T: "ShouldNotUse" }];
      },
      fetchPage: async () => null,
    });
    assert.deepEqual(order, ["before"]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].T, "Seeded");
  });
});
