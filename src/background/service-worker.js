const CONTENT_FILES = [
  "src/shared/selectors.js",
  "src/shared/extract.js",
  "src/shared/export.js",
  "src/shared/storage.js",
  "src/shared/pagination.js",
  "src/shared/columns.js",
  "src/content/picker-overlay.js",
  "src/content/content.js",
];


async function injectPicker(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["src/content/highlighter.css"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_FILES,
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "CLICK_SCRAPE_DEBUG_LOG") {
    const payload = msg.payload || {};
    fetch("http://127.0.0.1:7509/ingest/6d6969b3-13c1-42c8-8eaf-0bdc9884e441", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "4676a1",
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === "CLICK_SCRAPE_INJECT") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab");
      if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
        throw new Error("Can't run on this page. Open a normal website.");
      }
      await injectPicker(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: "CLICK_SCRAPE_START" });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  if (msg?.type === "CLICK_SCRAPE_RUN_ON_TAB") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab");
      // #region agent log
      const recipe = msg.recipe || {};
      fetch("http://127.0.0.1:7509/ingest/6d6969b3-13c1-42c8-8eaf-0bdc9884e441", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "4676a1",
        },
        body: JSON.stringify({
          sessionId: "4676a1",
          runId: "post-fix",
          hypothesisId: "F",
          location: "service-worker.js:RUN_ON_TAB",
          message: "popup run recipe payload",
          data: {
            hasGroupsArray: Array.isArray(recipe.groups),
            groupsLen: Array.isArray(recipe.groups) ? recipe.groups.length : 0,
            groupFields: Array.isArray(recipe.groups)
              ? recipe.groups.map((g) => (g.fields || []).map((f) => f.name))
              : [],
            legacyFields: (recipe.fields || []).map((f) => f.name),
            name: recipe.name,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      await injectPicker(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: "CLICK_SCRAPE_RUN_RECIPE", recipe: msg.recipe });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
});
