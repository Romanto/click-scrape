(() => {
  const NS = (globalThis.ClickScrape = globalThis.ClickScrape || {});
  const KEY = "clickScrapeRecipes";
  const PAGES_KEY = "clickScrapeLastRunPages";
  const PREFS_KEY = "clickScrapePrefs";
  const SOFT_RECIPE_NUDGE = 10;
  const SOFT_PAGE_NUDGE = 5;
  const HARD_RECIPE_CAP = 50;
  const DEFAULT_PREFS = {
    previewRowLimit: 200,
  };
  const PREVIEW_ROW_LIMITS = [25, 50, 100, 200, 500];

  function shouldNudgeRecipes(n) {
    return Number(n) >= SOFT_RECIPE_NUDGE;
  }

  function shouldNudgePages(n) {
    return Number(n) >= SOFT_PAGE_NUDGE;
  }

  function recipeNudgeCopy(n) {
    const count = Number(n) || 0;
    return `That’s ${count} recipes saved on this device.`;
  }

  function pageNudgeCopy(n) {
    const count = Number(n) || 0;
    return `That run covered ${count} pages. Still all on this machine.`;
  }

  function normalizePrefs(raw) {
    const prefs = { ...DEFAULT_PREFS, ...(raw && typeof raw === "object" ? raw : {}) };
    let limit = Number(prefs.previewRowLimit);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_PREFS.previewRowLimit;
    if (!PREVIEW_ROW_LIMITS.includes(limit)) {
      limit = PREVIEW_ROW_LIMITS.reduce((best, n) =>
        Math.abs(n - limit) < Math.abs(best - limit) ? n : best
      );
    }
    prefs.previewRowLimit = limit;
    return prefs;
  }

  async function listRecipes() {
    const data = await chrome.storage.local.get(KEY);
    return Array.isArray(data[KEY]) ? data[KEY] : [];
  }

  async function saveRecipe(recipe) {
    const recipes = await listRecipes();
    const idx = recipes.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) recipes[idx] = recipe;
    else recipes.unshift(recipe);
    await chrome.storage.local.set({ [KEY]: recipes.slice(0, HARD_RECIPE_CAP) });
    return recipe;
  }

  async function deleteRecipe(id) {
    const recipes = await listRecipes();
    await chrome.storage.local.set({ [KEY]: recipes.filter((r) => r.id !== id) });
  }

  async function getRecipe(id) {
    const recipes = await listRecipes();
    return recipes.find((r) => r.id === id) || null;
  }

  async function setLastRunPages(count) {
    await chrome.storage.local.set({ [PAGES_KEY]: Number(count) || 0 });
  }

  async function getLastRunPages() {
    const data = await chrome.storage.local.get(PAGES_KEY);
    return Number(data[PAGES_KEY]) || 0;
  }

  async function getPrefs() {
    const data = await chrome.storage.local.get(PREFS_KEY);
    return normalizePrefs(data[PREFS_KEY]);
  }

  async function setPrefs(partial) {
    const current = await getPrefs();
    const next = normalizePrefs({
      ...current,
      ...(partial && typeof partial === "object" ? partial : {}),
    });
    await chrome.storage.local.set({ [PREFS_KEY]: next });
    return next;
  }

  NS.storage = {
    listRecipes,
    saveRecipe,
    deleteRecipe,
    getRecipe,
    setLastRunPages,
    getLastRunPages,
    getPrefs,
    setPrefs,
    shouldNudgeRecipes,
    shouldNudgePages,
    recipeNudgeCopy,
    pageNudgeCopy,
    SOFT_RECIPE_NUDGE,
    SOFT_PAGE_NUDGE,
    HARD_RECIPE_CAP,
    DEFAULT_PREFS,
    PREVIEW_ROW_LIMITS,
    PREFS_KEY,
  };
})();
