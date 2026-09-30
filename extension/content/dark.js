// Content script: resolves effective settings for this URL and applies them
// to <html> via a data attribute + CSS variables (see dark.css).
// Re-applies live when settings change in storage.
//
// Flicker avoidance: storage reads are async, so the last resolved settings
// are mirrored into localStorage and re-applied synchronously at
// document_start — a light site never paints white before darkening, and a
// site remembered as natively dark is never inverted at all. First visits
// default to dark; autoDetect() re-decides before paint as soon as the page
// shows its own colors.
(function (global) {
  "use strict";
  const DS = global.DS;
  const CACHE_KEY = "__darkSafari";

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch (e) {
      return null;
    }
  }

  function writeCache(settings) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch (e) {
      /* sandboxed frame or storage disabled */
    }
  }

  // iOS Safari tints its top/bottom chrome and scroll-edge fades from
  // theme-color, falling back to the page background — which dark.css forces
  // to white for the inversion, hence white fades while dark mode is on.
  // A black theme-color placed first in <head> wins the tree-order
  // resolution over any site-provided one and keeps that chrome dark.
  let themeMeta = null;
  let darkOn = false;

  function updateThemeColor() {
    if (window !== window.top || !document.head) return;
    if (darkOn && !themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      themeMeta.content = "#000000";
      document.head.insertBefore(themeMeta, document.head.firstChild);
    } else if (!darkOn && themeMeta) {
      themeMeta.remove();
      themeMeta = null;
    }
  }

  function apply(settings) {
    const root = document.documentElement;
    darkOn = !!settings.enabled;
    writeCache(settings);
    if (!darkOn) {
      root.removeAttribute("data-dark-safari");
    } else {
      root.setAttribute("data-dark-safari", "");
      root.style.setProperty("--ds-brightness", settings.brightness / 100);
      root.style.setProperty("--ds-contrast", settings.contrast / 100);
      root.style.setProperty("--ds-sepia", settings.sepia / 100);
      root.style.setProperty("--ds-grayscale", settings.grayscale ? 1 : 0);
    }
    updateThemeColor();
  }

  // Native darkness detected during this load; overrides the stored autoDark
  // map in refresh() until the async DS.setAutoDark write lands, so a late
  // storage read can't briefly re-invert a page already decided to be dark.
  let localAutoDark = null;

  async function refresh() {
    const all = await DS.getAll();
    if (window === window.top && localAutoDark !== null) {
      const host = DS.siteKey(location.href);
      if (localAutoDark) all.autoDark[host] = true;
      else delete all.autoDark[host];
    }
    apply(DS.resolve(all, location.href));
  }

  function bootstrap() {
    const cached = readCache();
    apply(cached && typeof cached === "object" ? { ...DS.DEFAULTS, ...cached } : { ...DS.DEFAULTS });
    // <head> doesn't exist yet at document_start; add the theme-color meta
    // as soon as it appears rather than waiting for DOMContentLoaded.
    if (window === window.top && !document.head) {
      const mo = new MutationObserver(() => {
        if (document.head) {
          mo.disconnect();
          updateThemeColor();
        }
      });
      mo.observe(document.documentElement, { childList: true });
    }
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

  // Samples the page's own background: body first, then <html>. Our root
  // attribute is lifted for the <html> sample because dark.css forces the
  // html background while on. Returns null while nothing opaque is painted.
  function pageLuminance() {
    let lum = document.body ? luminance(getComputedStyle(document.body).backgroundColor) : null;
    if (lum === null) {
      const root = document.documentElement;
      const wasOn = root.hasAttribute("data-dark-safari");
      if (wasOn) root.removeAttribute("data-dark-safari");
      lum = luminance(getComputedStyle(root).backgroundColor);
      if (wasOn) root.setAttribute("data-dark-safari", "");
    }
    return lum;
  }

  // Nothing painted: dark only if the page opts into the UA's dark canvas.
  // (dark.css forces color-scheme while on, so the attribute is lifted.)
  function schemeSaysDark() {
    const root = document.documentElement;
    const wasOn = root.hasAttribute("data-dark-safari");
    if (wasOn) root.removeAttribute("data-dark-safari");
    const scheme = getComputedStyle(root).colorScheme || "";
    if (wasOn) root.setAttribute("data-dark-safari", "");
    return scheme.includes("dark") && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  async function autoDetect() {
    const all = await DS.getAll();
    const host = DS.siteKey(location.href);
    const site = all.sites[host] || {};
    const page = all.advanced ? all.pages[DS.pageKey(location.href)] || {} : {};
    if ("enabled" in site || "enabled" in page || !all.global.enabled) return;

    let stored = !!all.autoDark[host];
    let verdict = null;

    const act = (isDark) => {
      if (verdict === isDark) return;
      verdict = isDark;
      localAutoDark = isDark;
      if (isDark) all.autoDark[host] = true;
      else delete all.autoDark[host];
      apply(DS.resolve(all, location.href));
      if (isDark !== stored) {
        stored = isDark;
        DS.setAutoDark(host, isDark);
      }
    };

    // Sample once per animation frame while the page loads — rAF runs before
    // paint, so a natively dark page is un-inverted before it can flash as
    // inverted (light). DOMContentLoaded gets the final say, catching themes
    // applied by late scripts, matching the old single-check behavior.
    const step = () => {
      if (verdict !== null || document.readyState !== "loading") return;
      const lum = pageLuminance();
      if (lum !== null) act(lum < 0.4);
      else requestAnimationFrame(step);
    };
    const finalCheck = () => {
      const lum = pageLuminance();
      act(lum !== null ? lum < 0.4 : schemeSaysDark());
    };
    if (document.readyState === "loading") {
      step();
      document.addEventListener("DOMContentLoaded", finalCheck);
    } else {
      finalCheck();
    }
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
    updateThemeColor();
  }

  bootstrap();
  refresh();
  DS.api.storage.onChanged.addListener(refresh);
  if (window === window.top) autoDetect();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})(globalThis);
