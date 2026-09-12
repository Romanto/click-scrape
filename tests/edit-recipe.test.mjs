import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture, loadPicker } from "./helpers/load-click-scrape.mjs";

async function flush() {
  await new Promise((r) => setImmediate(r));
}

describe("editable saved recipes", () => {
  it("Start picking auto-detects lists without a New list control", () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick } = loadPicker(html);

    startPicker();
    assert.equal(document.querySelector("#cs-new-list"), null);
    assert.equal(document.querySelector("#cs-edit-recipe")?.hidden, true);
    assert.equal(document.querySelector("#cs-save").textContent, "Save recipe");

    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    pick(about);
    pick(ask);
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 2);
  });

  it("edit preserves groups and Update overwrites same id after dropping a table", async () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire, send, getStore } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    assert.ok(about && ask);
    pick(about);
    pick(ask);
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 2);

    fire(document.querySelector("#cs-save"), "click");
    await flush();

    const recipes = getStore().clickScrapeRecipes;
    assert.equal(recipes?.length, 1);
    assert.equal(recipes[0].id, "test-id");
    assert.equal(recipes[0].groups.length, 2);
    const savedName = recipes[0].name;
    const savedCreatedAt = recipes[0].createdAt;

    fire(document.querySelector("#cs-stop"), "click");
    assert.equal(document.getElementById("click-scrape-overlay"), null);

    send("CLICK_SCRAPE_EDIT_RECIPE", { recipe: recipes[0] });
    await flush();

    assert.ok(document.getElementById("click-scrape-overlay"), "edit opens overlay");
    assert.equal(document.querySelector("#cs-save").textContent, "Update recipe");
    assert.equal(document.querySelector("#cs-edit-recipe")?.hidden, true, "already editing");
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 2);

    const askDrop = document.querySelector('#cs-preview .cs-preview-table[data-cs-group="1"] [data-cs-drop]');
    assert.ok(askDrop, "second table has a column drop control");
    fire(askDrop, "click");
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 1);

    fire(document.querySelector("#cs-save"), "click");
    await flush();

    const after = getStore().clickScrapeRecipes;
    assert.equal(after.length, 1, "upsert replaces in place");
    assert.equal(after[0].id, "test-id", "Save reuses editing recipe id");
    assert.equal(after[0].name, savedName, "name preserved on update");
    assert.equal(after[0].createdAt, savedCreatedAt, "createdAt preserved on update");
    assert.equal(after[0].groups.length, 1);
  });

  it("Run then Edit recipe lets the user add a field and Update", async () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire, send, getStore } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    pick(about);
    fire(document.querySelector("#cs-save"), "click");
    await flush();
    const recipe = getStore().clickScrapeRecipes[0];
    fire(document.querySelector("#cs-stop"), "click");

    send("CLICK_SCRAPE_RUN_RECIPE", { recipe });
    await flush();

    assert.equal(document.querySelector("#cs-save").textContent, "Update recipe");
    assert.equal(document.querySelector("#cs-edit-recipe")?.hidden, false, "Edit recipe after Run");
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 1);

    fire(document.querySelector("#cs-edit-recipe"), "click");
    assert.equal(document.querySelector("#cs-edit-recipe")?.hidden, true);

    document.getElementById("cs-field-name").value = "Ask";
    pick(ask);
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 2);

    fire(document.querySelector("#cs-save"), "click");
    await flush();
    const after = getStore().clickScrapeRecipes[0];
    assert.equal(after.id, recipe.id);
    assert.equal(after.groups.length, 2);
  });

  it("while editing, picking another list adds a table", async () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire, send, getStore } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    pick(about);
    fire(document.querySelector("#cs-save"), "click");
    await flush();
    const recipe = getStore().clickScrapeRecipes[0];
    fire(document.querySelector("#cs-stop"), "click");

    send("CLICK_SCRAPE_EDIT_RECIPE", { recipe });
    await flush();
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 1);

    pick(ask);
    assert.equal(document.querySelectorAll("#cs-preview .cs-preview-table").length, 2);
    assert.ok(document.getElementById("cs-preview").textContent.includes("play music"));
  });

  it("renaming a table persists on Update and rematches on Edit", async () => {
    const html = loadFixture("noisy-bullets.html");
    const { document, startPicker, pick, fire, send, getStore } = loadPicker(html);

    startPicker();
    const about = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "About this item");
    const ask = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Ask Alexa");
    pick(about);
    pick(ask);
    assert.equal(document.querySelectorAll(".cs-table-label").length, 2);
    assert.equal(document.querySelectorAll(".cs-table-label")[0].textContent, "Table 1");

    const label = document.querySelector('.cs-preview-table[data-cs-group="0"] [data-cs-rename-table]');
    assert.ok(label);
    fire(label, "click");
    const input = label.querySelector("input");
    assert.ok(input);
    input.value = "About bullets";
    input.dispatchEvent(new document.defaultView.Event("blur", { bubbles: true }));
    assert.equal(
      document.querySelector('.cs-preview-table[data-cs-group="0"] .cs-table-label').textContent,
      "About bullets"
    );

    fire(document.querySelector("#cs-save"), "click");
    await flush();
    const saved = getStore().clickScrapeRecipes[0];
    assert.equal(saved.groups[0].name, "About bullets");
    assert.equal(saved.groups[1].name, undefined);

    fire(document.querySelector("#cs-stop"), "click");
    send("CLICK_SCRAPE_EDIT_RECIPE", { recipe: saved });
    await flush();
    assert.equal(
      document.querySelector('.cs-preview-table[data-cs-group="0"] .cs-table-label').textContent,
      "About bullets"
    );
    assert.equal(
      document.querySelector('.cs-preview-table[data-cs-group="1"] .cs-table-label').textContent,
      "Table 2"
    );
  });
});
