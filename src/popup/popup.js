const statusEl = document.getElementById("status");
const listEl = document.getElementById("recipes");
const nudgeEl = document.getElementById("nudge");

function showStatus(text) {
  statusEl.hidden = !text;
  statusEl.textContent = text || "";
}

document.getElementById("start").addEventListener("click", () => {
  showStatus("");
  chrome.runtime.sendMessage({ type: "CLICK_SCRAPE_INJECT" }, (res) => {
    if (chrome.runtime.lastError) {
      showStatus(chrome.runtime.lastError.message);
      return;
    }
    if (!res?.ok) showStatus(res?.error || "Failed to start");
    else window.close();
  });
});

function renderNudge(count) {
  if (!nudgeEl) return;
  if (ClickScrape.storage.shouldNudgeRecipes(count)) {
    nudgeEl.hidden = false;
    nudgeEl.textContent = ClickScrape.storage.recipeNudgeCopy(count);
  } else {
    nudgeEl.hidden = true;
    nudgeEl.textContent = "";
  }
}

async function renderRecipes() {
  const recipes = await ClickScrape.storage.listRecipes();
  renderNudge(recipes.length);
  if (!recipes.length) {
    listEl.innerHTML = `<li class="empty">No saved recipes yet.</li>`;
    return;
  }
  listEl.innerHTML = "";
  for (const recipe of recipes) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="meta">
        <strong></strong>
        <span></span>
      </div>
      <div class="actions">
        <button type="button" class="secondary edit">Edit</button>
        <button type="button" class="secondary run">Run</button>
        <button type="button" class="danger del">Del</button>
      </div>
    `;
    li.querySelector("strong").textContent = recipe.name;
    li.querySelector("span").textContent = recipe.pageUrl || recipe.rootSelector;
    li.querySelector(".edit").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLICK_SCRAPE_EDIT_ON_TAB", recipe }, (res) => {
        if (chrome.runtime.lastError) showStatus(chrome.runtime.lastError.message);
        else if (!res?.ok) showStatus(res?.error || "Edit failed");
        else window.close();
      });
    });
    li.querySelector(".run").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLICK_SCRAPE_RUN_ON_TAB", recipe }, (res) => {
        if (chrome.runtime.lastError) showStatus(chrome.runtime.lastError.message);
        else if (!res?.ok) showStatus(res?.error || "Run failed");
        else window.close();
      });
    });
    li.querySelector(".del").addEventListener("click", async () => {
      await ClickScrape.storage.deleteRecipe(recipe.id);
      renderRecipes();
    });
    listEl.appendChild(li);
  }
}

renderRecipes();
