// Content script: resolves effective settings for this URL and applies them
// to <html> via a data attribute + CSS variables (see dark.css).
// Re-applies live when settings change in storage.
(function (global) {
  "use strict";
  const DS = global.DS;

  function apply(settings) {
    const root = document.documentElement;
    if (!settings.enabled) {
      root.removeAttribute("data-dark-safari");
      return;
    }
    root.setAttribute("data-dark-safari", "");
    root.style.setProperty("--ds-brightness", settings.brightness / 100);
    root.style.setProperty("--ds-contrast", settings.contrast / 100);
    root.style.setProperty("--ds-sepia", settings.sepia / 100);
    root.style.setProperty("--ds-grayscale", settings.grayscale ? 1 : 0);
  }

  async function refresh() {
    const all = await DS.getAll();
    apply(DS.resolve(all, location.href));
  }

  // --- Native dark mode detection -----------------------------------------
  // If a site already renders dark (own dark theme or prefers-color-scheme),
  // flag it in autoDark so Dark Safari stays out of the way. An explicit
  // "enabled" override from the user always wins over this flag.

  function luminance(color) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color || "");
    if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  }

  // Measures the page's own colors; our root filter attribute is lifted
  // briefly because dark.css forces html background/color-scheme while on.
  function pageIsDark() {
    const root = document.documentElement;
    const wasOn = root.hasAttribute("data-dark-safari");
    if (wasOn) root.removeAttribute("data-dark-safari");
    let lum = null;
    for (const el of [document.body, root]) {
      if (el) {
        lum = luminance(getComputedStyle(el).backgroundColor);
        if (lum !== null) break;
      }
    }
    const scheme = getComputedStyle(root).colorScheme || "";
    if (wasOn) root.setAttribute("data-dark-safari", "");
    if (lum !== null) return lum < 0.4;
    // Nothing painted: dark only if the page opts into the UA's dark canvas.
    return scheme.includes("dark") && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  async function autoDetect() {
    const all = await DS.getAll();
    const host = DS.siteKey(location.href);
    const site = all.sites[host] || {};
    const page = all.advanced ? all.pages[DS.pageKey(location.href)] || {} : {};
    if ("enabled" in site || "enabled" in page || !all.global.enabled) return;
    const isDark = pageIsDark();
    if (isDark !== !!all.autoDark[host]) await DS.setAutoDark(host, isDark);
  }

  // Photographic background images would be inverted by the root filter;
  // flag them so dark.css re-inverts. Only checks url(...) backgrounds.
  function markBackgroundImages(scope) {
    for (const el of scope.querySelectorAll("div, section, header, a, span, li, td")) {
      if (el.hasAttribute("data-ds-bg-image")) continue;
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg.includes("url(") && !bg.includes("gradient")) {
        el.setAttribute("data-ds-bg-image", "");
      }
    }
  }

  function watchBackgroundImages() {
    markBackgroundImages(document);
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) markBackgroundImages(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function onReady() {
    watchBackgroundImages();
    if (window === window.top) autoDetect();
  }

  refresh();
  DS.api.storage.onChanged.addListener(refresh);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})(globalThis);
