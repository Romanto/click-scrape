import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture, loadPicker } from "./helpers/load-click-scrape.mjs";

describe("outline cleanup", () => {
  it("dropping a column from the preview table clears the green selected outline", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    const titleEl = document.querySelector("article.product .title");
    assert.ok(titleEl, "fixture has title element");
    pick(titleEl);

    assert.ok(titleEl.classList.contains("click-scrape-selected"), "outline present after pick");
    assert.ok(document.querySelector("#cs-preview [data-cs-drop]"), "preview table has a drop control");
    assert.ok(document.querySelectorAll(".click-scrape-item").length > 0, "retrieved items highlighted");

    fire(document.querySelector("#cs-preview [data-cs-drop]"), "click");

    assert.equal(document.querySelectorAll("#cs-preview [data-cs-drop]").length, 0, "column removed from table");
    assert.ok(
      !titleEl.classList.contains("click-scrape-selected"),
      "green selected outline cleared after drop"
    );
    assert.equal(
      document.querySelectorAll(".click-scrape-selected").length,
      0,
      "no leftover selected outlines"
    );
    assert.equal(
      document.querySelectorAll(".click-scrape-item").length,
      0,
      "item outlines cleared when no columns remain"
    );
  });

  it("dropping one of several columns only clears that field's selected outline", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    const titleEl = document.querySelector("article.product .title");
    const priceEl = document.querySelector("article.product .price");
    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Title";
    pick(titleEl);
    nameInput.value = "Price";
    pick(priceEl);

    assert.ok(titleEl.classList.contains("click-scrape-selected"));
    assert.ok(priceEl.classList.contains("click-scrape-selected"));

    const titleDrop = document.querySelector('#cs-preview [data-cs-drop="Title"]');
    assert.ok(titleDrop, "Title drop control exists");
    fire(titleDrop, "click");

    assert.ok(!titleEl.classList.contains("click-scrape-selected"), "dropped Title outline cleared");
    assert.ok(priceEl.classList.contains("click-scrape-selected"), "remaining Price outline kept");
    assert.ok(document.querySelector('#cs-preview [data-cs-col="Price"]'), "Price column still in table");
    assert.equal(document.querySelectorAll('#cs-preview [data-cs-col="Title"]').length, 0, "Title column gone");
    assert.ok(document.querySelectorAll(".click-scrape-item").length > 0, "list items stay highlighted");
  });
});
