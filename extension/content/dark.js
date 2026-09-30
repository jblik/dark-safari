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

  refresh();
  DS.api.storage.onChanged.addListener(refresh);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchBackgroundImages);
  } else {
    watchBackgroundImages();
  }
})(globalThis);
