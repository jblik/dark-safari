// Background service worker: handles keyboard commands.
//   toggle-dark   — flips dark mode for the active tab's site (site override)
//   toggle-page   — flips dark mode for the active tab's exact page (page override)
//   cycle-preset  — steps the global settings through DS.PRESETS
// (_execute_action is handled by the browser itself: it opens the popup.)
// Safari loads the "scripts" array (shared modules already present);
// Chromium runs this as a service worker and needs importScripts.
if (!globalThis.DS) importScripts("shared/browser.js", "shared/settings.js");

const DS = globalThis.DS;

async function activeTabUrl() {
  const [tab] = await DS.api.tabs.query({ active: true, currentWindow: true });
  return tab && tab.url && /^https?:/.test(tab.url) ? tab.url : null;
}

async function toggleDark() {
  const url = await activeTabUrl();
  const all = await DS.getAll();
  if (!url) {
    await DS.setGlobal({ enabled: !all.global.enabled });
    return;
  }
  const effective = DS.resolve(all, url);
  await DS.setOverride("sites", DS.siteKey(url), { enabled: !effective.enabled }, DS.siteParent(all, url));
}

async function togglePage() {
  const url = await activeTabUrl();
  const all = await DS.getAll();
  if (!url) {
    await DS.setGlobal({ enabled: !all.global.enabled });
    return;
  }
  // Page overrides only take effect while the per-page ("Advanced") mode is on,
  // so opt in automatically — otherwise this command would silently do nothing.
  if (!all.advanced) await DS.api.storage.local.set({ advanced: true });
  const effective = DS.resolve(all, url);
  const siteScope = { ...DS.siteParent(all, url), ...all.sites[DS.siteKey(url)] };
  await DS.setOverride("pages", DS.pageKey(url), { enabled: !effective.enabled }, siteScope);
}

async function cyclePreset() {
  const all = await DS.getAll();
  const matches = (p) =>
    p.brightness === all.global.brightness &&
    p.contrast === all.global.contrast &&
    p.sepia === all.global.sepia &&
    p.grayscale === all.global.grayscale;
  const current = DS.PRESETS.findIndex(matches);
  const { name, ...values } = DS.PRESETS[(current + 1) % DS.PRESETS.length];
  await DS.setGlobal({ ...values, enabled: true });
}

DS.api.commands.onCommand.addListener((command) => {
  if (command === "toggle-dark") toggleDark();
  else if (command === "toggle-page") togglePage();
  else if (command === "cycle-preset") cyclePreset();
});
