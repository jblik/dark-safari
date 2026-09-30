// Settings model shared by content script, background and popup.
//
// Storage layout (browser.storage.local):
//   global:   full settings object
//   sites:    { host: partial settings }          — per-website overrides
//   pages:    { host+path: partial settings }     — per-page overrides (Advanced)
//   advanced: bool                                — per-page granularity opt-in
//
// Effective settings for a URL = global ⊕ sites[host] ⊕ (advanced ? pages[key] : {})
(function (global) {
  "use strict";
  const DS = global.DS || (global.DS = {});

  DS.DEFAULTS = Object.freeze({
    enabled: true,
    brightness: 100, // percent, 50–150
    contrast: 100,   // percent, 50–150
    sepia: 0,        // percent, 0–100 ("warmth")
    grayscale: false
  });

  DS.PRESETS = Object.freeze([
    { name: "Default", brightness: 100, contrast: 100, sepia: 0, grayscale: false },
    { name: "Soft", brightness: 90, contrast: 95, sepia: 10, grayscale: false },
    { name: "Warm", brightness: 95, contrast: 100, sepia: 40, grayscale: false },
    { name: "High contrast", brightness: 100, contrast: 125, sepia: 0, grayscale: false }
  ]);

  DS.siteKey = (url) => new URL(url).hostname;
  DS.pageKey = (url) => {
    const u = new URL(url);
    return u.hostname + u.pathname;
  };

  DS.getAll = async function () {
    const data = await DS.api.storage.local.get(["global", "sites", "pages", "advanced"]);
    return {
      global: { ...DS.DEFAULTS, ...data.global },
      sites: data.sites || {},
      pages: data.pages || {},
      advanced: !!data.advanced
    };
  };

  // Effective settings for a URL, merging global → site → page scopes.
  DS.resolve = function (all, url) {
    let merged = { ...all.global, ...all.sites[DS.siteKey(url)] };
    if (all.advanced) merged = { ...merged, ...all.pages[DS.pageKey(url)] };
    return merged;
  };

  // Writes a partial override into "sites" or "pages" for the given key.
  // Values equal to the parent scope are dropped; empty overrides are removed.
  DS.setOverride = async function (mapName, key, patch, parent) {
    const data = await DS.api.storage.local.get(mapName);
    const map = data[mapName] || {};
    const entry = { ...map[key], ...patch };
    for (const k of Object.keys(entry)) {
      if (entry[k] === parent[k]) delete entry[k];
    }
    if (Object.keys(entry).length) map[key] = entry;
    else delete map[key];
    await DS.api.storage.local.set({ [mapName]: map });
  };

  DS.setGlobal = async function (patch) {
    const all = await DS.getAll();
    await DS.api.storage.local.set({ global: { ...all.global, ...patch } });
  };
})(globalThis);
