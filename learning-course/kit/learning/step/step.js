(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initSteps() {
    if (typeof document === "undefined") return;

    var buttons = document.querySelectorAll("[data-step-next]");
    buttons.forEach(function (next) {
      var scope = next.closest("[data-steps-scope]") ||
        next.closest("section, .card, .lesson") ||
        next.parentElement;
      var items = scope ? Array.prototype.slice.call(scope.querySelectorAll(".step")) : [];
      if (items.length < 2) return;

      next.addEventListener("click", function () {
        var hidden = items.findIndex(function (item) { return item.classList.contains("is-hidden"); });
        if (hidden >= 0) {
          items[hidden].classList.remove("is-hidden");
          var remaining = items.filter(function (item) { return item.classList.contains("is-hidden"); });
          if (remaining.length === 0) {
            next.disabled = true;
          }
        } else {
          next.disabled = true;
        }
      });
    });

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("learning.step");
    }
  }

  kit.step = {
    init: initSteps
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSteps);
    else initSteps();
  }
})(typeof window !== "undefined" ? window : globalThis);
