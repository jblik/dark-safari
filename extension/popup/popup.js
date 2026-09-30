// Popup: edits settings at one of three scopes (global / site / page).
// Site and page scopes write partial overrides via DS.setOverride; the
// shown values are always the effective (merged) values for that scope.
(function () {
  "use strict";
  const DS = globalThis.DS;
  const $ = (id) => document.getElementById(id);
  const SLIDERS = ["brightness", "contrast", "sepia"];

  let all = null;
  let url = null;
  let scope = "global";

  // Footer shortcut hints, built from the shortcuts actually registered (and
  // any the user has customised in Safari's settings) rather than hardcoded.
  const SHORTCUT_ORDER = ["toggle-dark", "toggle-page", "cycle-preset", "_execute_action"];
  const SHORTCUT_LABELS = {
    "_execute_action": "open",
    "toggle-dark": "toggle site",
    "toggle-page": "toggle page",
    "cycle-preset": "cycle presets"
  };

  // "Alt+Shift+D" → "⌥⇧D" (also handles Command/Ctrl/MacCtrl aliases).
  function prettyShortcut(s) {
    return s
      .replace(/Command|Cmd/g, "⌘")
      .replace(/MacCtrl|Ctrl|Control/g, "⌃")
      .replace(/Alt|Option/g, "⌥")
      .replace(/Shift/g, "⇧")
      .replace(/\+/g, "");
  }

  async function renderShortcuts() {
    const foot = $("shortcuts");
    let cmds;
    try {
      cmds = await DS.api.commands.getAll();
    } catch (e) { return; } // commands API unavailable: leave footer empty
    const byName = {};
    for (const c of cmds) byName[c.name] = c;
    const parts = SHORTCUT_ORDER
      .map((name) => byName[name])
      .filter((c) => c && c.shortcut)
      .map((c) => `${prettyShortcut(c.shortcut)} ${SHORTCUT_LABELS[c.name] || c.description || c.name}`);
    foot.textContent = parts.length ? parts.join(" · ") : "No keyboard shortcuts set";
  }

  // Effective values seen at each scope, and the parent used for overrides.
  function scopeValues() {
    if (scope === "global" || !url) return { values: all.global, parent: DS.DEFAULTS };
    const parent = DS.siteParent(all, url);
    const site = { ...parent, ...all.sites[DS.siteKey(url)] };
    if (scope === "site") return { values: site, parent };
    return { values: { ...site, ...all.pages[DS.pageKey(url)] }, parent: site };
  }

  function autoDisabled() {
    if (!url) return false;
    const site = all.sites[DS.siteKey(url)] || {};
    const page = all.advanced ? all.pages[DS.pageKey(url)] || {} : {};
    return !!all.autoDark[DS.siteKey(url)] && !("enabled" in site) && !("enabled" in page);
  }

  async function save(patch) {
    const { parent } = scopeValues();
    if (scope === "global" || !url) await DS.setGlobal(patch);
    else if (scope === "site") await DS.setOverride("sites", DS.siteKey(url), patch, parent);
    else await DS.setOverride("pages", DS.pageKey(url), patch, parent);
    all = await DS.getAll();
    render();
  }

  function render() {
    const { values } = scopeValues();
    $("enabled").checked = values.enabled;
    $("grayscale").checked = values.grayscale;
    for (const id of SLIDERS) {
      $(id).value = values[id];
      document.querySelector(`output[for="${id}"]`).textContent = `${values[id]}%`;
    }
    $("auto-note").hidden = !autoDisabled();
    $("advanced").checked = all.advanced;
    $("scope-page").hidden = !all.advanced;
    if (!all.advanced && scope === "page") scope = "site";
    for (const btn of document.querySelectorAll("#scopes button")) {
      btn.classList.toggle("active", btn.dataset.scope === scope);
    }
  }

  function wire() {
    $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
    $("grayscale").addEventListener("change", (e) => save({ grayscale: e.target.checked }));
    for (const id of SLIDERS) {
      $(id).addEventListener("input", (e) => save({ [id]: Number(e.target.value) }));
    }
    for (const btn of document.querySelectorAll("#scopes button")) {
      btn.addEventListener("click", () => { scope = btn.dataset.scope; render(); });
    }
    $("reset").addEventListener("click", async () => {
      if (scope === "global" || !url) await DS.api.storage.local.set({ global: { ...DS.DEFAULTS } });
      else if (scope === "site") await DS.clearOverride("sites", DS.siteKey(url));
      else await DS.clearOverride("pages", DS.pageKey(url));
      all = await DS.getAll();
      render();
    });
    $("advanced").addEventListener("change", async (e) => {
      await DS.api.storage.local.set({ advanced: e.target.checked });
      all = await DS.getAll();
      if (e.target.checked) scope = "page";
      render();
    });
  }

  async function init() {
    all = await DS.getAll();
    try {
      const [tab] = await DS.api.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && /^https?:/.test(tab.url)) url = tab.url;
    } catch (e) { /* no tab access: global scope only */ }
    if (!url) {
      $("scope-site").disabled = true;
      $("scope-page").disabled = true;
    } else {
      scope = "site";
    }
    wire();
    render();
    renderShortcuts();
  }

  init();
})();
