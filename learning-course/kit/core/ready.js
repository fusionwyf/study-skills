(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var readyModules = [];
  var failedModules = [];
  var degradedModules = [];
  var pendingModules = new Set();
  var isGlobalSettled = false;

  // Pre-register active modules if injected
  if (Array.isArray(kit.__ACTIVE_MODULES__)) {
    kit.__ACTIVE_MODULES__.forEach(function (id) {
      pendingModules.add(id);
    });
  }

  function markModuleReady(moduleId) {
    if (readyModules.indexOf(moduleId) === -1) {
      readyModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":ready", { module: moduleId });
    checkGlobalReady();
  }

  function markModuleFailed(moduleId, error) {
    if (failedModules.indexOf(moduleId) === -1) {
      failedModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":failed", { module: moduleId, error: error });
    checkGlobalReady();
  }

  function markModuleDegraded(moduleId, reason) {
    if (degradedModules.indexOf(moduleId) === -1) {
      degradedModules.push(moduleId);
    }
    if (readyModules.indexOf(moduleId) === -1) {
      readyModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":degraded", { module: moduleId, reason: reason });
    checkGlobalReady();
  }

  function registerPendingModule(moduleId) {
    if (readyModules.indexOf(moduleId) === -1 && failedModules.indexOf(moduleId) === -1) {
      pendingModules.add(moduleId);
    }
  }

  function checkGlobalReady() {
    if (pendingModules.size === 0 && !isGlobalSettled) {
      isGlobalSettled = true;
      var isAllSuccess = failedModules.length === 0;

      if (typeof document !== "undefined") {
        document.documentElement.dataset.kitStatus = "settled";
        document.documentElement.dataset.kitReady = isAllSuccess ? "true" : "false";
        document.documentElement.dataset.courseReady = isAllSuccess ? "true" : "false";
      }

      var payload = {
        ready: readyModules.slice(),
        failed: failedModules.slice(),
        degraded: degradedModules.slice(),
        success: isAllSuccess
      };

      kit.emit("kit:ready", payload);
      kit.emit("kit:settled", payload);

      // Backward compatibility shims
      if (typeof window !== "undefined") {
        root.__COURSE_MATH_READY__ = true;
        root.__LEARNKIT_READY__ = true;
        try {
          window.dispatchEvent(new CustomEvent("course-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("lk-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("viz-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("media-ready", { detail: payload }));
        } catch (e) {}
      }
    }
  }

  kit.ready = {
    markReady: markModuleReady,
    markFailed: markModuleFailed,
    markDegraded: markModuleDegraded,
    registerPending: registerPendingModule,
    isReady: function () { return isGlobalSettled && failedModules.length === 0; },
    isSettled: function () { return isGlobalSettled; },
    getStatus: function () { return isGlobalSettled ? "settled" : "pending"; },
    getReadyModules: function () { return readyModules.slice(); },
    getFailedModules: function () { return failedModules.slice(); },
    getDegradedModules: function () { return degradedModules.slice(); }
  };
})(typeof window !== "undefined" ? window : globalThis);
