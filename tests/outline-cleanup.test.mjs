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

  it("clicking the same selected field again removes that column", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const titleEl = document.querySelector("article.product .title");
    const priceEl = document.querySelector("article.product .price");
    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Title";
    pick(titleEl);
    nameInput.value = "Price";
    pick(priceEl);

    assert.ok(titleEl.classList.contains("click-scrape-selected"));
    assert.ok(document.querySelector('#cs-preview [data-cs-col="Title"]'));

    pick(titleEl);

    assert.ok(!titleEl.classList.contains("click-scrape-selected"), "Title outline cleared on toggle");
    assert.ok(priceEl.classList.contains("click-scrape-selected"), "Price outline kept");
    assert.equal(document.querySelectorAll('#cs-preview [data-cs-col="Title"]').length, 0);
    assert.ok(document.querySelector('#cs-preview [data-cs-col="Price"]'));
    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("$12.00"), "remaining Price text still retrieved");
    assert.ok(!preview.includes("Acme Notebook"), "Title text gone after deselect");
  });

  it("field-list × removes that column and its green field outline", () => {
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

    const fieldDrop = document.querySelector('#cs-fields [data-cs-drop="Title"]');
    assert.ok(fieldDrop, "field list has remove-one-field control");
    fire(fieldDrop, "click");

    assert.ok(!titleEl.classList.contains("click-scrape-selected"), "dropped field outline cleared");
    assert.ok(priceEl.classList.contains("click-scrape-selected"), "remaining field outline kept");
    assert.equal(document.querySelectorAll('#cs-fields [data-cs-drop="Title"]').length, 0);
    assert.ok(document.querySelector('#cs-fields [data-cs-drop="Price"]'));
  });

  it("dropping About this item column clears the heading's green selector", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    pick(about);
    assert.ok(about.classList.contains("click-scrape-selected"), "heading marked selected");

    const drop = document.querySelector("#cs-fields [data-cs-drop], #cs-preview [data-cs-drop]");
    assert.ok(drop, "remove-one-field control exists");
    fire(drop, "click");

    assert.ok(!about.classList.contains("click-scrape-selected"), "heading selector removed with the column");
    assert.equal(document.querySelectorAll(".click-scrape-selected").length, 0);
    assert.equal(document.querySelectorAll(".click-scrape-item").length, 0);

    pick(about);
    assert.ok(about.classList.contains("click-scrape-selected"), "heading selected again after drop");
    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Bullet one"), "About this item bullets retrieved on re-select");
    assert.equal(document.querySelectorAll(".click-scrape-item").length, 3);
  });

  it("after dropping the last column, picking About this item still starts a list", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    pick(ask);
    const drop = document.querySelector("#cs-fields [data-cs-drop], #cs-preview [data-cs-drop]");
    fire(drop, "click");

    pick(about);
    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(about.classList.contains("click-scrape-selected"), "About this item heading selected");
    assert.ok(preview.includes("Bullet one"), "About this item bullets picked up after a prior dropped list");
    assert.ok(!preview.includes("play music"), "dropped Ask Alexa list is not kept after last-column reset");
  });

  it("picking Ask Alexa after About this item appends that list to the preview", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    assert.ok(about && ask);

    pick(about);
    let preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Bullet one"), "About this item rows retrieved");
    assert.ok(!preview.includes("play music"), "Ask Alexa not in preview before second pick");

    pick(ask);
    preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Bullet one"), "About this item rows kept");
    assert.ok(preview.includes("Alexa, play music"), "Ask Alexa rows picked up");
    assert.ok(preview.includes("what's the weather"), "Ask Alexa sibling command retrieved");
  });
});
