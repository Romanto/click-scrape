import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  loadFixture,
  createDocument,
  loadClickScrape,
  resolveRelative,
  assertItemRelative,
} from "./helpers/load-click-scrape.mjs";

describe("selectors", () => {
  let doc;
  let ClickScrape;

  beforeEach(() => {
    const html = loadFixture("nested-cards.html");
    const { window, document } = createDocument(html);
    ClickScrape = loadClickScrape(window);
    doc = document;
  });

  it("findListContext returns class-qualified itemSelector for nested card title click", () => {
    const titleEl = doc.querySelector(".products .title");
    assert.ok(titleEl, "fixture must include a nested title node");

    const ctx = ClickScrape.selectors.findListContext(titleEl);

    assert.ok(ctx.root, "root element required");
    assert.ok(ctx.items.length >= 2, "must detect repeating sibling items");
    assert.match(
      ctx.itemSelector,
      /article\.product|\.product/,
      "itemSelector must be a CSS selector with shared item class, not tag-only"
    );
    assert.ok(
      ctx.rootSelector,
      "rootSelector required for recipe persistence"
    );
  });

  it("relativeSelector is item-relative and resolves the same field shape on every sibling", () => {
    const titleEl = doc.querySelector(".products .title");
    const priceEl = doc.querySelector(".products .price");
    const ctx = ClickScrape.selectors.findListContext(titleEl);
    const sampleItem = ctx.items[0];

    for (const fieldEl of [titleEl, priceEl]) {
      const rel = ClickScrape.selectors.relativeSelector(sampleItem, fieldEl);
      assertItemRelative(rel);

      for (const item of ctx.items) {
        const resolved = resolveRelative(item, rel);
        assert.ok(resolved, `relativeSelector must resolve inside each item: ${rel}`);
        assert.ok(
          resolved.classList.contains("title") || resolved.classList.contains("price"),
          "resolved node must match the picked field class"
        );
      }
    }
  });

  it("queryItems honors class-qualified itemSelector under the list root", () => {
    const root = doc.querySelector(".products");
    const items = ClickScrape.selectors.queryItems(root, "article.product");

    assert.equal(items.length, 3, "fixture has three product cards");
    assert.ok(
      items.every((item) => item.matches("article.product")),
      "every matched node must satisfy article.product"
    );
  });

  it("queryItems returns empty array when class-qualified selector matches nothing", () => {
    const html = `<div class="list-root">
      <article class="decoy">Not a product</article>
      <article>Another decoy</article>
    </div>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const root = document.querySelector(".list-root");
    const items = CS.selectors.queryItems(root, "article.product");

    assert.equal(items.length, 0, "must return no items when selector matches nothing");
  });

  it("findSimilarPeers scopes site-wide classes to the local list region", () => {
    const html = loadFixture("noisy-bullets.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const span = document.querySelector("#featurebullets_feature_div .a-list-item");
    assert.ok(span);

    const scope = CS.selectors.getSimilarScopeRoot(span);
    assert.equal(scope?.id, "featurebullets_feature_div");

    const peers = CS.selectors.findSimilarPeers(span);
    assert.equal(peers.length, 2, "only other bullets in the feature list, not page-wide noise");
    assert.ok(
      peers.every((p) => scope.contains(p)),
      "peers must stay inside the scoped feature-bullets root"
    );
  });

  it("findSimilarPeers falls back to sibling li rows under ul/ol", () => {
    // Unique classes so CSS peer matching fails; only the ul/ol sibling path remains.
    const html = `<main>
      <ul id="plain-list">
        <li><span class="unique-a">Alpha</span></li>
        <li><span class="unique-b">Beta</span></li>
        <li><span class="unique-c">Gamma</span></li>
      </ul>
    </main>`;
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const span = document.querySelector("#plain-list li span");
    const peers = CS.selectors.findSimilarPeers(span);

    assert.equal(peers.length, 2);
    assert.ok(peers.every((p) => p.tagName === "LI"));
  });

  it("findListContext uses scoped peers for noisy bullet lists", () => {
    const html = loadFixture("noisy-bullets.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const span = document.querySelector("#featurebullets_feature_div .a-list-item");
    const ctx = CS.selectors.findListContext(span);

    assert.ok(ctx.items.length >= 2);
    assert.ok(
      ctx.items.every((item) => document.getElementById("featurebullets_feature_div").contains(item)),
      "list items must not include unrelated page-wide .a-list-item nodes"
    );
  });
});
