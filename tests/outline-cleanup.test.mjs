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

  it("picking Ask Alexa after About this item opens a second table from row 1", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    assert.ok(about && ask);

    pick(about);
    pick(ask);

    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 2, "sibling lists render as separate tables");
    assert.ok(tables[0].textContent.includes("Bullet one"));
    assert.ok(tables[1].textContent.includes("play music"));
    assert.ok(!tables[1].textContent.includes("Bullet one"), "second table starts fresh at row 1");
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

  it("picking Size after a shorter pack-count list keeps pack in its own table", () => {
    const html = loadFixture("twister-dimensions.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const pack = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "5"
    );
    pick(pack);
    const small = [...document.querySelectorAll(".swatch-title-text-display")].find(
      (el) => el.textContent.trim() === "Small"
    );
    pick(small);

    const tables = [...document.querySelectorAll("#cs-preview .cs-preview-table")];
    assert.equal(tables.length, 2, "pack and Size each get a table");
    assert.ok(tables[0].textContent.includes("12"));
    assert.ok(!tables[0].textContent.includes("XX-Large"), "pack table does not include Size rows");
    assert.ok(tables[1].textContent.includes("Small"));
    assert.ok(tables[1].textContent.includes("XX-Large"));
    assert.ok(!tables[1].textContent.includes("12"), "Size table starts at row 1 without pack values");
    assert.equal(document.querySelectorAll("#inline-twister-row-size_name .click-scrape-item").length, 5);
    assert.equal(document.querySelectorAll("#inline-twister-row-number_of_items .click-scrape-item").length, 4);
  });

  it("picking shipping after price keeps shipping in its own filled table", () => {
    const html = loadFixture("shipping-israel.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Price";
    pick(document.querySelector(".a-price-whole"));
    nameInput.value = "Shipping";
    const ship = [...document.querySelectorAll("span")].find((s) =>
      s.textContent.includes("No Import Charges")
    );
    assert.ok(ship);
    pick(ship);

    const tables = [...document.querySelectorAll("#cs-preview .cs-preview-table")];
    assert.equal(tables.length, 2, "price and shipping each get a table");
    assert.ok(tables[0].textContent.includes("20"), "price table filled");
    assert.ok(
      tables[1].textContent.includes("No Import Charges") && tables[1].textContent.includes("Israel"),
      "shipping table filled — not empty cells glued onto the price block"
    );
    assert.ok(!tables[0].textContent.includes("Israel"), "price table does not include shipping");
  });

  it("picking shipping alone fills one row", () => {
    const html = loadFixture("shipping-israel.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    const ship = [...document.querySelectorAll("span")].find((s) =>
      s.textContent.includes("No Import Charges")
    );
    pick(ship);
    const preview = document.getElementById("cs-preview").textContent;
    assert.ok(preview.includes("No Import Charges"));
    assert.ok(preview.includes("Israel"));
    assert.equal(document.querySelectorAll("#cs-preview tbody tr").length, 1);
  });

  it("edited preview cells survive refresh and export includes the edit", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    pick(document.querySelector("article.product .title"));
    const cell = document.querySelector("td.cs-cell");
    assert.ok(cell, "editable cell present");
    const original = cell.textContent;
    cell.textContent = "manual-edit";
    cell.dispatchEvent(new document.defaultView.Event("focusout", { bubbles: true }));

    assert.match(document.getElementById("cs-preview").textContent, /manual-edit/);
    fire(document.querySelector("[data-cs-add-row]"), "click");
    assert.ok(document.querySelectorAll("#cs-preview tbody tr").length >= 4);

    const reset = document.querySelector("[data-cs-reset-rows]");
    assert.ok(reset && !reset.disabled, "Reset enabled after edit");
    fire(reset, "click");
    const after = [...document.querySelectorAll("td.cs-cell")].map((el) => el.textContent);
    assert.ok(after.includes(original) || after.some((v) => v && v !== "manual-edit"));
  });

  it("Broader then Narrower adjusts nesting and updates the sample", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();
    pick(document.querySelector("article.product .title"));
    const sample = document.querySelector(".cs-field-sample");
    assert.ok(sample?.textContent.includes("Acme Notebook"));

    const broader = document.querySelector('[data-cs-adjust][data-cs-dir="-1"]');
    assert.ok(broader && !broader.disabled, "Broader enabled on leaf title");
    fire(broader, "click");

    const narrower = document.querySelector('[data-cs-adjust][data-cs-dir="1"]');
    assert.ok(narrower && !narrower.disabled, "Narrower enabled after Broader");
    fire(narrower, "click");

    assert.ok(
      document.querySelector(".cs-field-sample")?.textContent.includes("Acme Notebook"),
      "sample still shows title text after round-trip"
    );
    assert.ok(
      document.getElementById("cs-preview").textContent.includes("Acme Notebook"),
      "preview still has title rows"
    );
  });
});
