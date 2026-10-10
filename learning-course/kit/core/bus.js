(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var listeners = {};

  kit.on = function (type, handler) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(handler);
    return function () {
      kit.off(type, handler);
    };
  };

  kit.off = function (type, handler) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter(function (h) { return h !== handler; });
  };

  kit.emit = function (type, detail) {
    if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(type, { detail: detail, bubbles: true }));
      } catch (e) {}
    }
    var handlers = listeners[type] ? listeners[type].slice() : [];
    handlers.forEach(function (h) {
      try { h(detail); } catch (err) { console.error("Event handler error for " + type, err); }
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
