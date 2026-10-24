(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var modules = {};
  var initialized = {};

  function initModule(id) {
    if (initialized[id]) return Promise.resolve();
    var mod = modules[id];
    if (!mod) {
      initialized[id] = true;
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
    initialized[id] = true;
    if (typeof mod.init !== "function") {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
    var res;
    try {
      res = mod.init(kit);
    } catch (err) {
      console.error("[kit] Module " + id + " init failed:", err);
      if (kit.ready && kit.ready.markFailed) kit.ready.markFailed(id, err);
      return Promise.resolve();
    }
    if (res && typeof res.then === "function") {
      return res.then(function () {
        if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      }).catch(function (err) {
        console.error("[kit] Async module " + id + " init failed:", err);
        if (kit.ready && kit.ready.markFailed) kit.ready.markFailed(id, err);
      });
    } else {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
  }

  var allInitialized = false;

  kit.registerModule = function (id, mod) {
    modules[id] = mod;
    // Standalone fallback or dynamic registration after initAll has already run:
    if (!Array.isArray(kit.__ACTIVE_MODULES__) || allInitialized) {
      initModule(id);
    }
  };

  // Base core module lifecycle registration
  kit.registerModule("core", {
    init: function () {
      return Promise.resolve();
    }
  });

  kit.getModule = function (id) {
    return modules[id];
  };

  kit.listModules = function () {
    return Object.keys(modules);
  };

  async function initAll() {
    var order = Array.isArray(kit.__ACTIVE_MODULES__) ? kit.__ACTIVE_MODULES__.slice() : [];
    Object.keys(modules).forEach(function (id) {
      if (order.indexOf(id) === -1) {
        order.push(id);
      }
    });

    // Phase 1: core + foundation (synchronous prerequisites for everything)
    // Phase 2: shell.* (layout: sidebar, TOC, progress bar — must appear immediately)
    // Phase 3: everything else in parallel (content vendors like Mermaid/KaTeX are
    //          heavy CDN loads; they must NOT block the visible layout)
    var shellIds = [];
    var deferredIds = [];
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (id === "core" || id === "foundation") {
        await initModule(id);
      } else if (id.indexOf("shell.") === 0) {
        shellIds.push(id);
      } else {
        deferredIds.push(id);
      }
    }
    for (var j = 0; j < shellIds.length; j++) {
      await initModule(shellIds[j]);
    }
    for (var k = 0; k < deferredIds.length; k++) {
      initModule(deferredIds[k]);
    }

    allInitialized = true;
  }

  kit.initAll = initAll;

  if (typeof document !== "undefined" && !Array.isArray(kit.__ACTIVE_MODULES__)) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAll);
    } else {
      initAll();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
