import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture, loadPicker } from "./helpers/load-click-scrape.mjs";

describe("preview column order (e2e Title→Price)", () => {
  it("Title then Price produces single table with correct cell values under headers", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();

    // Name the first field "Title" and pick span.title
    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Title";
    const titleEl = document.querySelector("article.product span.title");
    assert.ok(titleEl, "fixture has span.title element");
    pick(titleEl);

    // Name the second field "Price" and pick span.price on the same cards
    nameInput.value = "Price";
    const priceEl = document.querySelector("article.product span.price");
    assert.ok(priceEl, "fixture has span.price element");
    pick(priceEl);

    // Assert single preview table (not two sibling tables from mis-clicks)
    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 1, "should have exactly one preview table");

    // Assert preview headers are Title|Price in order
    const headers = [...document.querySelectorAll("#cs-preview thead th .cs-th-name")].map((span) =>
      span.textContent.trim()
    );
    assert.deepEqual(
      headers,
      ["Title", "Price"],
      "headers should be Title, Price in order"
    );

    // Assert cell values: Title column has titles, Price column has prices (not swapped)
    const rows = document.querySelectorAll("#cs-preview tbody tr");
    assert.ok(rows.length >= 3, "should have at least 3 data rows");

    // Row 0: Acme Notebook | $12.00
    const row0Cells = [...rows[0].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row0Cells[0], "Acme Notebook", "first row Title cell should be 'Acme Notebook'");
    assert.equal(row0Cells[1], "$12.00", "first row Price cell should be '$12.00'");

    // Row 1: Bright Lamp | $34.50
    const row1Cells = [...rows[1].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row1Cells[0], "Bright Lamp", "second row Title cell should be 'Bright Lamp'");
    assert.equal(row1Cells[1], "$34.50", "second row Price cell should be '$34.50'");

    // Row 2: USB-C Hub | $29.99
    const row2Cells = [...rows[2].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row2Cells[0], "USB-C Hub", "third row Title cell should be 'USB-C Hub'");
    assert.equal(row2Cells[1], "$29.99", "third row Price cell should be '$29.99'");
  });

  it("Price then Title produces correct cell values in Price|Title order", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();

    // Pick Price first
    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Price";
    const priceEl = document.querySelector("article.product span.price");
    pick(priceEl);

    // Pick Title second
    nameInput.value = "Title";
    const titleEl = document.querySelector("article.product span.title");
    pick(titleEl);

    // Single table
    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 1, "should have exactly one preview table");

    // Headers in Price|Title order
    const headers = [...document.querySelectorAll("#cs-preview thead th .cs-th-name")].map((span) =>
      span.textContent.trim()
    );
    assert.deepEqual(
      headers,
      ["Price", "Title"],
      "headers should be Price, Title in order"
    );

    // Cell values: Price column has prices, Title column has titles
    const rows = document.querySelectorAll("#cs-preview tbody tr");
    const row0Cells = [...rows[0].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row0Cells[0], "$12.00", "first row Price cell should be '$12.00'");
    assert.equal(row0Cells[1], "Acme Notebook", "first row Title cell should be 'Acme Notebook'");
  });

  it("Title + Price + Meta produces three columns with correct alignment", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();

    const nameInput = document.getElementById("cs-field-name");
    
    nameInput.value = "Title";
    pick(document.querySelector("article.product span.title"));

    nameInput.value = "Price";
    pick(document.querySelector("article.product span.price"));

    nameInput.value = "Category";
    pick(document.querySelector("article.product span.meta"));

    // Single table with three columns
    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 1);

    const headers = [...document.querySelectorAll("#cs-preview thead th .cs-th-name")].map((span) =>
      span.textContent.trim()
    );
    assert.deepEqual(
      headers,
      ["Title", "Price", "Category"],
      "headers should be Title, Price, Category in order"
    );

    // Validate first row has correct values in all three columns
    const row0Cells = [...document.querySelectorAll("#cs-preview tbody tr")[0].querySelectorAll("td.cs-cell")].map(
      (td) => td.textContent.trim()
    );
    assert.equal(row0Cells[0], "Acme Notebook");
    assert.equal(row0Cells[1], "$12.00");
    assert.equal(row0Cells[2], "Stationery");
  });

  it("picking from different card indices produces aligned columns", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();

    const nameInput = document.getElementById("cs-field-name");

    // Pick Title from first card
    nameInput.value = "Title";
    const titleEl = document.querySelector("article.product:nth-child(1) span.title");
    pick(titleEl);

    // Pick Price from second card (different item, but same list)
    nameInput.value = "Price";
    const priceEl = document.querySelector("article.product:nth-child(2) span.price");
    pick(priceEl);

    // Single table
    const tables = document.querySelectorAll("#cs-preview .cs-preview-table");
    assert.equal(tables.length, 1);

    // All three products should have both Title and Price filled
    const rows = document.querySelectorAll("#cs-preview tbody tr");
    assert.ok(rows.length >= 3, "should extract all three product rows");

    const row0Cells = [...rows[0].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row0Cells[0], "Acme Notebook");
    assert.equal(row0Cells[1], "$12.00");

    const row1Cells = [...rows[1].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row1Cells[0], "Bright Lamp");
    assert.equal(row1Cells[1], "$34.50");

    const row2Cells = [...rows[2].querySelectorAll("td.cs-cell")].map((td) => td.textContent.trim());
    assert.equal(row2Cells[0], "USB-C Hub");
    assert.equal(row2Cells[1], "$29.99");
  });

  it("column drop then re-pick maintains correct column order", () => {
    const html = loadFixture("nested-cards.html");
    const { document, startPicker, pick, fire } = loadPicker(html);

    startPicker();

    const nameInput = document.getElementById("cs-field-name");
    nameInput.value = "Title";
    pick(document.querySelector("article.product span.title"));

    nameInput.value = "Price";
    pick(document.querySelector("article.product span.price"));

    // Drop Title column
    const titleDrop = document.querySelector('#cs-preview [data-cs-drop="Title"]');
    assert.ok(titleDrop);
    fire(titleDrop, "click");

    // Only Price column remains
    let headers = [...document.querySelectorAll("#cs-preview thead th .cs-th-name")].map((span) =>
      span.textContent.trim()
    );
    assert.deepEqual(headers, ["Price"]);

    // Re-add Title
    nameInput.value = "Title";
    pick(document.querySelector("article.product span.title"));

    // Now headers should be Price, Title (Title added after Price)
    headers = [...document.querySelectorAll("#cs-preview thead th .cs-th-name")].map((span) =>
      span.textContent.trim()
    );
    assert.deepEqual(headers, ["Price", "Title"]);

    // Cell values should align with headers
    const row0Cells = [...document.querySelectorAll("#cs-preview tbody tr")[0].querySelectorAll("td.cs-cell")].map(
      (td) => td.textContent.trim()
    );
    assert.equal(row0Cells[0], "$12.00", "first column should be Price value");
    assert.equal(row0Cells[1], "Acme Notebook", "second column should be Title value");
  });
});
