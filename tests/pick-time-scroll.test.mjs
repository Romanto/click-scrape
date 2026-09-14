import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture, loadPicker } from "./helpers/load-click-scrape.mjs";

async function flush(predicate, timeoutMs = 4000) {
  const start = Date.now();
  for (;;) {
    await new Promise((r) => setImmediate(r));
    if (typeof predicate === "function") {
      if (predicate()) return;
    } else {
      return;
    }
    if (Date.now() - start > timeoutMs) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("pick-time lazy scroll", () => {
  it("after pick, expandGroupByScrolling grows preview rows via scrapeRecipeWhileScrolling", async () => {
    const html = loadFixture("lazy-feed.html");
    const { document, startPicker, pick, sandbox } = loadPicker(html);

    const CS = sandbox.ClickScrape;
    assert.ok(CS?.lazyLoad?.scrapeRecipeWhileScrolling);

    let scrapeCalls = 0;
    CS.lazyLoad.scrapeRecipeWhileScrolling = async (recipe, doc, opts) => {
      scrapeCalls += 1;
      const feed = doc.querySelector("#feed");
      for (let i = 5; i < 12; i += 1) {
        const art = doc.createElement("article");
        art.className = "card product";
        art.innerHTML = `<div class="title">Lazy Item ${i + 1}</div><div class="price">$${10 + i}.00</div>`;
        feed.appendChild(art);
      }
      const rows = CS.extract.extractRows(recipe, doc);
      opts?.onProgress?.({ rows, rounds: 1, columns: opts.columns });
      return { rows, rounds: 1, stopped: "stable" };
    };

    startPicker();
    const title = document.querySelector("#feed .title");
    assert.ok(title);
    pick(title);

    await flush(() => {
      const rows = document.querySelectorAll("#cs-preview tbody tr").length;
      return scrapeCalls >= 1 && rows >= 7;
    });

    assert.ok(scrapeCalls >= 1, "pick-time scroll should invoke scrapeRecipeWhileScrolling");
    const previewRows = document.querySelectorAll("#cs-preview tbody tr").length;
    assert.ok(previewRows >= 7, `expected expanded preview, got ${previewRows}`);
  });
});
