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

describe("storage user prefs", () => {
  it("getPrefs returns defaults and setPrefs persists previewRowLimit", async () => {
    const chrome = mockChrome({});
    const storage = loadStorageWithChrome(chrome);
    const initial = await storage.getPrefs();
    assert.equal(initial.previewRowLimit, 200);
    const next = await storage.setPrefs({ previewRowLimit: 50 });
    assert.equal(next.previewRowLimit, 50);
    assert.equal((await storage.getPrefs()).previewRowLimit, 50);
  });

  it("normalizePrefs snaps invalid limits to nearest allowed value", async () => {
    const chrome = mockChrome({
      clickScrapePrefs: { previewRowLimit: 87 },
    });
    const storage = loadStorageWithChrome(chrome);
    const prefs = await storage.getPrefs();
    assert.ok(storage.PREVIEW_ROW_LIMITS.includes(prefs.previewRowLimit));
    assert.equal(prefs.previewRowLimit, 100);
  });
});
