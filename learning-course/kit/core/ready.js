(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var readyModules = [];
  var failedModules = [];
  var pendingModules = new Set();
  var isGlobalReady = false;

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

  function registerPendingModule(moduleId) {
    if (readyModules.indexOf(moduleId) === -1 && failedModules.indexOf(moduleId) === -1) {
      pendingModules.add(moduleId);
    }
  }

  function checkGlobalReady() {
    if (pendingModules.size === 0 && !isGlobalReady) {
      isGlobalReady = true;
      if (typeof document !== "undefined") {
        document.documentElement.dataset.kitReady = "true";
        document.documentElement.dataset.courseReady = "true";
      }

      var payload = {
        ready: readyModules.slice(),
        failed: failedModules.slice()
      };

      kit.emit("kit:ready", payload);

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
    registerPending: registerPendingModule,
    isReady: function () { return isGlobalReady; },
    getReadyModules: function () { return readyModules.slice(); },
    getFailedModules: function () { return failedModules.slice(); }
  };
})(typeof window !== "undefined" ? window : globalThis);
