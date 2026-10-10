(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var modules = {};

  kit.registerModule = function (id, mod) {
    modules[id] = mod;
    if (typeof mod.init === "function") {
      try {
        mod.init(kit);
      } catch (err) {
        console.error("Failed to init module " + id, err);
        if (kit.ready && kit.ready.markFailed) {
          kit.ready.markFailed(id, err);
        }
      }
    }
  };

  kit.getModule = function (id) {
    return modules[id];
  };

  kit.listModules = function () {
    return Object.keys(modules);
  };
})(typeof window !== "undefined" ? window : globalThis);
