import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createDocument, loadClickScrape } from "./helpers/load-click-scrape.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_SRC = path.join(__dirname, "..", "src", "shared", "storage.js");

function mockChrome(initial = {}) {
  const data = { ...initial };
  return {
    storage: {
      local: {
        async get(key) {
          const k = typeof key === "string" ? key : Object.keys(key)[0];
          return { [k]: data[k] };
        },
        async set(obj) {
          Object.assign(data, obj);
        },
      },
    },
    _data: data,
  };
}

function loadStorageWithChrome(chrome) {
  const sandbox = { chrome, globalThis: { chrome } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(STORAGE_SRC, "utf8"), sandbox);
  return sandbox.ClickScrape.storage;
}

describe("storage soft nudge helpers", () => {
  let ClickScrape;

  beforeEach(() => {
    const { window } = createDocument("<!DOCTYPE html><html><body></body></html>");
    ClickScrape = loadClickScrape(window);
  });

  it("shouldNudgeRecipes at 10, not before", () => {
    const { shouldNudgeRecipes } = ClickScrape.storage;
    assert.equal(shouldNudgeRecipes(0), false);
    assert.equal(shouldNudgeRecipes(9), false);
    assert.equal(shouldNudgeRecipes(10), true);
    assert.equal(shouldNudgeRecipes(11), true);
  });

  it("shouldNudgePages at 5, not before", () => {
    const { shouldNudgePages } = ClickScrape.storage;
    assert.equal(shouldNudgePages(0), false);
    assert.equal(shouldNudgePages(4), false);
    assert.equal(shouldNudgePages(5), true);
    assert.equal(shouldNudgePages(20), true);
  });

  it("nudge copy stays local — no account / phone-home language", () => {
    const recipe = ClickScrape.storage.recipeNudgeCopy(10);
    const pages = ClickScrape.storage.pageNudgeCopy(5);
    assert.equal(recipe, "That’s 10 recipes saved on this device.");
    assert.equal(pages, "That run covered 5 pages. Still all on this machine.");
    const banned = /create an account|sign in|upgrade required|cloud|phone[- ]home/i;
    assert.equal(banned.test(recipe), false);
    assert.equal(banned.test(pages), false);
  });
});

describe("storage hard recipe cap", () => {
  it("saveRecipe keeps at most 50 recipes and still saves", async () => {
    const chrome = mockChrome({ clickScrapeRecipes: [] });
    const storage = loadStorageWithChrome(chrome);
    for (let i = 0; i < 55; i++) {
      await storage.saveRecipe({ id: `r${i}`, name: `Recipe ${i}` });
    }
    const recipes = await storage.listRecipes();
    assert.equal(recipes.length, 50);
    assert.equal(recipes[0].id, "r54");
    assert.equal(storage.HARD_RECIPE_CAP, 50);
  });
});
