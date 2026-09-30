// Test-only stub of the WebExtension API surface Dark Safari uses.
// Lets the shared modules + content script run in a plain web page.
(function (global) {
  "use strict";
  const store = {};
  const listeners = [];

  global.browser = {
    storage: {
      local: {
        async get(keys) {
          const names = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of names) if (k in store) out[k] = structuredClone(store[k]);
          return out;
        },
        async set(items) {
          Object.assign(store, structuredClone(items));
          listeners.forEach((fn) => fn(items, "local"));
        }
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    tabs: {
      async query() {
        return [{ url: "https://example.com/articles/test" }];
      }
    }
  };
})(globalThis);
