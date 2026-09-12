const CONTENT_FILES = [
  "src/shared/selectors.js",
  "src/shared/extract.js",
  "src/shared/export.js",
  "src/shared/storage.js",
  "src/shared/pagination.js",
  "src/shared/columns.js",
  "src/shared/rows.js",
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
      await injectPicker(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: "CLICK_SCRAPE_RUN_RECIPE", recipe: msg.recipe });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
});
