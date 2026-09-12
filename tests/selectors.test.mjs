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
    assert.ok(
      scope?.id === "feature-bullets" || scope?.id === "featurebullets_feature_div",
      "scope must be the feature-bullets container, not #centerCol"
    );

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
    assert.equal(ctx.items.length, 3, "must pick the three bullets, not sibling .celwidget widgets");
    assert.ok(
      ctx.items.every((item) => document.getElementById("featurebullets_feature_div").contains(item)),
      "list items must not include unrelated page-wide .a-list-item nodes"
    );
    assert.ok(
      ctx.items.every((item) => item.tagName === "LI" || item.classList.contains("a-list-item")),
      "items must be the bullet rows, not #centerCol .celwidget blocks"
    );
  });

  it("findListContext maps About this item heading to the adjacent bullet list", () => {
    const html = loadFixture("noisy-bullets.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const heading = [...document.querySelectorAll("h1")].find(
      (h) => h.textContent.trim() === "About this item"
    );
    assert.ok(heading);

    const ctx = CS.selectors.findListContext(heading);
    assert.equal(ctx.items.length, 3);
    assert.ok(
      ctx.items.every((item) => document.getElementById("feature-bullets").contains(item)),
      "heading click must not select page-wide .celwidget siblings"
    );
    assert.ok(ctx.items.every((item) => item.tagName === "LI"));
  });

  it("findSimilarPeers on About this item heading outlines the adjacent bullets", () => {
    const html = loadFixture("noisy-bullets.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const heading = [...document.querySelectorAll("h1")].find(
      (h) => h.textContent.trim() === "About this item"
    );
    const peers = CS.selectors.findSimilarPeers(heading);
    assert.equal(peers.length, 3);
    assert.ok(peers.every((p) => p.tagName === "LI"));
  });

  it("findListContext maps Ask Alexa heading to its own list, not .celwidget siblings", () => {
    const html = loadFixture("noisy-bullets.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const heading = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    assert.ok(heading);

    const scope = CS.selectors.getSimilarScopeRoot(heading);
    assert.equal(scope?.id, "ppi-justAskAlexa_feature_div");

    const ctx = CS.selectors.findListContext(heading);
    assert.equal(ctx.items.length, 2);
    assert.ok(ctx.items.every((item) => document.getElementById("ppi-justAskAlexa_feature_div").contains(item)));
    assert.ok(ctx.items.every((item) => item.tagName === "LI"));
    assert.ok(ctx.items.some((item) => item.textContent.includes("play music")));
  });

  it("findSimilarPeers outlines sibling size swatches", () => {
    const html = loadFixture("size-swatches.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const small = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "Small"
    );
    const peers = CS.selectors.findSimilarPeers(small);
    const texts = peers.map((p) => p.textContent.replace(/\s+/g, " ").trim());
    assert.ok(peers.length >= 4, "other sizes highlighted as similar");
    assert.ok(texts.some((t) => t.includes("Medium")));
    assert.ok(texts.some((t) => t.includes("Large")));
    assert.ok(!texts.some((t) => t.trim() === "Small"), "hovered size is not in similar peers");
  });

  it("picking a size field rematches every swatch, not the unique announce id", () => {
    const html = loadFixture("size-swatches.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const small = document.getElementById("size_name_0-announce");
    const ctx = CS.selectors.findListContext(small);
    assert.equal(ctx.items.length, 5, "size swatches are one list");
    const rel = CS.selectors.relativeSelector(ctx.items[0], small);
    assertItemRelative(rel);
    assert.ok(!/#size_name_\d/.test(rel), `field selector must rematch siblings, got ${rel}`);

    const labels = ctx.items.map((item) => {
      const el = resolveRelative(item, rel);
      return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
    });
    const expected = ["Small", "Medium", "Large", "X-Large", "XX-Large"];
    assert.equal(labels.length, expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      assert.equal(labels[i], expected[i], `row ${i} should be ${expected[i]}`);
    }
  });

  it("findListContext maps Top highlights heading to product-fact rows, not About this item bullets", () => {
    const html = loadFixture("top-highlights.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const heading = [...document.querySelectorAll("[role='heading']")].find(
      (h) => h.textContent.trim() === "Top highlights"
    );
    assert.ok(heading);

    const ctx = CS.selectors.findListContext(heading);
    assert.equal(ctx.items.length, 4);
    assert.ok(ctx.items.every((item) => item.classList.contains("product-facts-detail")));
    const texts = ctx.items.map((item) => item.textContent.replace(/\s+/g, " ").trim());
    assert.ok(texts.some((t) => t.includes("100% Cotton")));
    assert.ok(!texts.some((t) => t.includes("Lay-flat collar")));
  });

  it("findListContext maps a Top highlights fact label to the four fact rows", () => {
    const html = loadFixture("top-highlights.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const fabric = [...document.querySelectorAll(".a-color-base")].find(
      (el) => el.textContent.trim() === "Fabric type"
    );
    const ctx = CS.selectors.findListContext(fabric);
    assert.equal(ctx.items.length, 4);
    assert.ok(ctx.items.every((item) => item.classList.contains("product-facts-detail")));
    assert.ok(
      ctx.items.every((item) => document.getElementById("topHighlight").contains(item)),
      "must not select page-wide .celwidget siblings"
    );
  });

  it("findListContext on the product title does not steal Top highlights facts", () => {
    const html = loadFixture("top-highlights.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const title = [...document.querySelectorAll("h1, h1 span")].find((el) =>
      el.textContent.trim().includes("Gildan T-Shirt")
    );
    const ctx = CS.selectors.findListContext(title);
    const allFacts =
      ctx.items.length >= 2 && ctx.items.every((item) => item.classList?.contains("product-facts-detail"));
    assert.equal(allFacts, false, "title click must not retrieve Top highlights rows");
  });

  it("findListContext on About this item still maps to bullets when Top highlights is present", () => {
    const html = loadFixture("top-highlights.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const about = [...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "About this item");
    const ctx = CS.selectors.findListContext(about);
    assert.ok(ctx.items.every((item) => item.tagName === "LI"));
    assert.ok(ctx.items.some((item) => item.textContent.includes("Lay-flat collar")));
    assert.ok(!ctx.items.some((item) => item.classList.contains("product-facts-detail")));
  });

  it("findListContext keeps pack-count and size swatches as separate lists", () => {
    const html = loadFixture("twister-dimensions.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const small = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "Small"
    );
    const pack = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "6"
    );
    const sizeCtx = CS.selectors.findListContext(small);
    const packCtx = CS.selectors.findListContext(pack);
    const sizeTexts = sizeCtx.items.map((item) => item.textContent.replace(/\s+/g, " ").trim());
    const packTexts = packCtx.items.map((item) => item.textContent.replace(/\s+/g, " ").trim());
    assert.equal(sizeCtx.items.length, 5);
    assert.ok(sizeTexts.includes("Small") && sizeTexts.includes("XX-Large"));
    assert.ok(!sizeTexts.some((t) => t === "12" || t === "6"));
    assert.equal(packCtx.items.length, 4);
    assert.ok(packTexts.some((t) => t === "5") && packTexts.some((t) => t === "12"));
    assert.ok(!packTexts.some((t) => t.includes("Small") || t.includes("Medium")));
  });

  it("findListContext on PDP price does not fill empty .celwidget rows", () => {
    const html = loadFixture("price-discount.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    const price = document.querySelector(".a-price-whole");
    const discount = document.querySelector(".savingsPercentage");
    const ctx = CS.selectors.findListContext(price);
    assert.equal(ctx.items.length, 1, "singleton price block, not page-wide .celwidget peers");
    assert.ok(
      ctx.items.every((item) => !item.classList.contains("celwidget") || item.id === "apex_desktop" || item.id === "corePrice_desktop" || item.contains(price)),
      "must not use unrelated empty celwidgets as rows"
    );
    const item = ctx.items.find((i) => i.contains(price));
    assert.ok(item);
    const fields = [
      { name: "Price", relativeSelector: CS.selectors.relativeSelector(item, price) },
      { name: "Discount%", relativeSelector: CS.selectors.relativeSelector(item, discount) },
    ];
    const rows = CS.extract.retrieveRowsFromItems(ctx.items, fields);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].Price, "20");
    assert.equal(rows[0]["Discount%"], "-9%");
  });

  it("cssPath skips duplicate Amazon ids so Size recipes rematch Size not Color", () => {
    const html = loadFixture("twister-duplicate-ids.html");
    const { window, document } = createDocument(html);
    const CS = loadClickScrape(window);
    assert.equal(document.querySelectorAll("#tp-inline-twister-dim-values-container").length, 2);
    const small = document.querySelector("#size_name_0-announce");
    const ctx = CS.selectors.findListContext(small);
    assert.match(ctx.rootSelector, /inline-twister-expander-content-size_name/);
    assert.doesNotMatch(
      ctx.rootSelector,
      /^div#tp-inline-twister-dim-values-container\b/,
      "must not stop at duplicated twister container id"
    );
    const item = ctx.items.find((i) => i === small || i.contains(small));
    const recipe = {
      rootSelector: ctx.rootSelector,
      itemSelector: ctx.itemSelector,
      fields: [{ name: "Size", relativeSelector: CS.selectors.relativeSelector(item, small) }],
    };
    const sizes = CS.extract.retrieve(recipe).rows.map((r) => String(r.Size || "").replace(/\s+/g, " ").trim());
    assert.equal(sizes.join("|"), "Small|Medium|Large|X-Large|XX-Large");
    assert.ok(!sizes.includes("Red") && !sizes.includes("Blue"));
  });

  it("stepFieldTarget broadens from title span toward the card item", () => {
    const titleEl = doc.querySelector("article.product .title");
    const ctx = ClickScrape.selectors.findListContext(titleEl);
    const item = ctx.items.find((i) => i.contains(titleEl));
    assert.ok(item);

    const broader = ClickScrape.selectors.stepFieldTarget(item, titleEl, "broader");
    assert.ok(broader);
    assert.equal(broader, titleEl.parentElement);
    assert.ok(item.contains(broader) || broader === item);

    const info = ClickScrape.selectors.fieldTargetStepInfo(item, titleEl);
    assert.equal(info.canBroader, true);
    assert.equal(info.canNarrower, false, "title span is a leaf");
  });

  it("stepFieldTarget narrows from title-wrap into the title span", () => {
    const wrap = doc.querySelector("article.product .title-wrap");
    const titleEl = doc.querySelector("article.product .title");
    const ctx = ClickScrape.selectors.findListContext(wrap);
    const item = ctx.items.find((i) => i.contains(wrap));
    assert.ok(item && titleEl);

    const narrower = ClickScrape.selectors.stepFieldTarget(item, wrap, "narrower");
    assert.equal(narrower, titleEl);

    const atItem = ClickScrape.selectors.stepFieldTarget(item, item, "broader");
    assert.equal(atItem, null, "cannot broaden past the list item");

    const info = ClickScrape.selectors.fieldTargetStepInfo(item, item);
    assert.equal(info.canBroader, false);
    assert.equal(info.canNarrower, true);
  });

  it("relativeSelector stays item-relative after a broader step", () => {
    const titleEl = doc.querySelector("article.product .title");
    const ctx = ClickScrape.selectors.findListContext(titleEl);
    const item = ctx.items.find((i) => i.contains(titleEl));
    const broader = ClickScrape.selectors.stepFieldTarget(item, titleEl, -1);
    const rel = ClickScrape.selectors.relativeSelector(item, broader);
    assertItemRelative(rel);
    assert.equal(resolveRelative(item, rel), broader);
  });
});
