import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const src = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "shared", "highlight.js"),
  "utf8"
);

function load() {
  const { window, document } = parseHTML(`<!DOCTYPE html><html><body>
    <article class="card" id="card" style="width:200px;height:120px">
      <h2 class="title" id="title">Title</h2>
      <span class="price" id="price">$5.95</span>
    </article>
    <div class="grid">
      <span class="cell" id="a">A</span>
      <span class="cell" id="b">B</span>
    </div>
  </body></html>`);
  const sandbox = { document, window, Element: window.Element, Node: window.Node };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  return { document, highlight: sandbox.ClickScrape.highlight };
}

describe("highlight helpers", () => {
  it("exposes stabilize + box geometry API", () => {
    const { highlight } = load();
    for (const name of [
      "pointInRect",
      "overlapRatio",
      "stabilizeHoverTarget",
      "boxStyleFromRect",
      "applyBoxStyle",
    ]) {
      assert.equal(typeof highlight[name], "function", name);
    }
    assert.equal(highlight.DEFAULT_STICK_PAD, 6);
  });

  it("refines into a descendant immediately", () => {
    const { document, highlight } = load();
    const card = document.getElementById("card");
    const price = document.getElementById("price");
    const next = highlight.stabilizeHoverTarget(card, price, 10, 10);
    assert.equal(next, price);
  });

  it("keeps the child while pointer stays in its box (resist parent thrash)", () => {
    const { document, highlight } = load();
    const card = document.getElementById("card");
    const price = document.getElementById("price");
    // linkedom getBoundingClientRect is often zeros — stub a child box.
    price.getBoundingClientRect = () => ({
      left: 20,
      top: 40,
      right: 80,
      bottom: 60,
      width: 60,
      height: 20,
    });
    const kept = highlight.stabilizeHoverTarget(price, card, 30, 50);
    assert.equal(kept, price);
  });

  it("allows parent when pointer leaves the child box", () => {
    const { document, highlight } = load();
    const card = document.getElementById("card");
    const price = document.getElementById("price");
    price.getBoundingClientRect = () => ({
      left: 20,
      top: 40,
      right: 80,
      bottom: 60,
      width: 60,
      height: 20,
    });
    const next = highlight.stabilizeHoverTarget(price, card, 5, 5);
    assert.equal(next, card);
  });

  it("resists one-frame sibling flips when rects heavily overlap", () => {
    const { document, highlight } = load();
    const a = document.getElementById("a");
    const b = document.getElementById("b");
    a.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 50,
      bottom: 40,
      width: 40,
      height: 30,
    });
    b.getBoundingClientRect = () => ({
      left: 12,
      top: 12,
      right: 52,
      bottom: 42,
      width: 40,
      height: 30,
    });
    const kept = highlight.stabilizeHoverTarget(a, b, 20, 20);
    assert.equal(kept, a);
  });

  it("switches siblings when pointer leaves the current box", () => {
    const { document, highlight } = load();
    const a = document.getElementById("a");
    const b = document.getElementById("b");
    a.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 50,
      bottom: 40,
      width: 40,
      height: 30,
    });
    b.getBoundingClientRect = () => ({
      left: 60,
      top: 10,
      right: 100,
      bottom: 40,
      width: 40,
      height: 30,
    });
    const next = highlight.stabilizeHoverTarget(a, b, 80, 20);
    assert.equal(next, b);
  });

  it("boxStyleFromRect expands by outline offset", () => {
    const { highlight } = load();
    const style = highlight.boxStyleFromRect(
      { left: 10, top: 20, width: 100, height: 40, right: 110, bottom: 60 },
      2
    );
    assert.equal(style.left, 8);
    assert.equal(style.top, 18);
    assert.equal(style.width, 104);
    assert.equal(style.height, 44);
  });

  it("applyBoxStyle uses translate3d and can disable motion", () => {
    const { document, highlight } = load();
    const box = document.createElement("div");
    highlight.applyBoxStyle(box, { left: 1, top: 2, width: 3, height: 4 }, { animate: false });
    assert.equal(box.style.left, "0px");
    assert.equal(box.style.top, "0px");
    assert.equal(box.style.transform, "translate3d(1px, 2px, 0)");
    assert.equal(box.style.width, "3px");
    assert.equal(box.style.height, "4px");
    assert.equal(box.classList.contains("cs-no-motion"), true);
  });
});
