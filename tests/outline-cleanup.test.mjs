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

  it("picking Ask Alexa after About this item appends that list instead of replacing", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    assert.ok(about && ask);

    pick(about);
    let preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Bullet one"), "About this item rows retrieved");

    pick(ask);
    preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Bullet one"), "About this item rows kept");
    assert.ok(preview.includes("play music"), "Ask Alexa rows appended");
  });

  it("picking one size swatch retrieves Small through XX-Large", () => {
    const html = loadFixture("size-swatches.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const small = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "Small"
    );
    pick(small);

    const preview = document.getElementById("cs-preview").textContent;
    for (const label of ["Small", "Medium", "Large", "X-Large", "XX-Large"]) {
      assert.ok(preview.includes(label), `${label} row retrieved after picking Small`);
    }
    assert.ok(document.querySelectorAll(".click-scrape-item").length >= 5, "every size row outlined");
  });

  it("picking Top highlights retrieves fact rows, not About this item bullets", () => {
    const html = loadFixture("top-highlights.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const heading = [...document.querySelectorAll("[role='heading']")].find(
      (h) => h.textContent.trim() === "Top highlights"
    );
    pick(heading);

    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("100% Cotton"), "Fabric type value retrieved");
    assert.ok(preview.includes("Machine Wash"), "Care instructions retrieved");
    assert.ok(preview.includes("Imported"), "Origin retrieved");
    assert.ok(preview.includes("Pull On"), "Closure type retrieved");
    assert.ok(!preview.includes("Lay-flat collar"), "About this item bullets are a different list");
  });

  it("picking a Top highlights fact label retrieves all four fact rows", () => {
    const html = loadFixture("top-highlights.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const fabric = [...document.querySelectorAll(".a-color-base")].find(
      (el) => el.textContent.trim() === "Fabric type"
    );
    pick(fabric);

    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Fabric type"));
    assert.ok(preview.includes("Care instructions"));
    assert.ok(preview.includes("Origin"));
    assert.ok(preview.includes("Closure type"));
    assert.equal(document.querySelectorAll(".click-scrape-item").length, 4);
  });

  it("picking About this item does not retrieve Top highlights facts", () => {
    const html = loadFixture("top-highlights.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "About this item");
    pick(about);

    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Lay-flat collar"), "About this item bullets retrieved");
    assert.ok(!preview.includes("Machine Wash"), "Top highlights care row must not replace About this item");
    assert.equal(document.querySelectorAll(".product-facts-detail.click-scrape-item").length, 0);
  });

  it("picking the product title does not retrieve Top highlights facts", () => {
    const html = loadFixture("top-highlights.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const title = document.querySelector("h1.product-title, h1");
    pick(title);

    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(!preview.includes("Machine Wash") || preview.includes("Gildan T-Shirt"));
    assert.equal(
      document.querySelectorAll(".product-facts-detail.click-scrape-item").length,
      0,
      "title pick must not outline Top highlights rows"
    );
  });

  it("picking About this item after the product title switches to the bullet list", () => {
    const html = loadFixture("top-highlights.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const title = document.querySelector("h1.product-title, h1");
    pick(title);
    let preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Gildan T-Shirt"), "title list locked first");

    const about = [...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "About this item");
    pick(about);
    preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("Lay-flat collar"), "About this item bullets retrieved after title");
    assert.ok(preview.includes("Soft, breathable cotton"));
    assert.ok(!preview.includes("Machine Wash") || preview.includes("Lay-flat collar"));
    assert.ok(document.querySelectorAll("li.click-scrape-item").length >= 5, "bullet rows outlined");
    assert.equal(
      document.querySelectorAll(".celwidget.click-scrape-item").length,
      0,
      "title celwidget session replaced"
    );
  });

  it("picking Size after a shorter pack-count list keeps pack rows and adds sizes", () => {
    const html = loadFixture("twister-dimensions.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const pack = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "5"
    );
    pick(pack);
    let preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("5"));
    assert.ok(preview.includes("12"), "pack-count list retrieved first");
    assert.ok(!preview.includes("XX-Large"), "sizes are a different list");

    const small = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "Small"
    );
    pick(small);
    preview = document.getElementById("cs-preview").textContent;
    for (const label of ["Small", "Medium", "Large", "X-Large", "XX-Large"]) {
      assert.ok(preview.includes(label), `${label} row retrieved after picking Size`);
    }
    assert.ok(preview.includes("12"), "pack-count values kept after picking Size");
    assert.equal(document.querySelectorAll("#inline-twister-row-size_name .click-scrape-item").length, 5);
    assert.equal(document.querySelectorAll("#inline-twister-row-number_of_items .click-scrape-item").length, 4);
  });
});
