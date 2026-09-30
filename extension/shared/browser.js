// Normalizes the extension API namespace: Safari exposes `browser`,
// Chromium exposes `chrome`. Everything else in the codebase uses `DS.api`.
(function (global) {
  "use strict";
  const DS = global.DS || (global.DS = {});
  DS.api = global.browser || global.chrome;
})(globalThis);
