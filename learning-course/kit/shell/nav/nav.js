(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initNav() {
    if (typeof document === "undefined") return;

    var navEls = document.querySelectorAll("nav.kit-nav, [data-kit-nav]");

    // Keyboard navigation shortcuts: [ for prev, ] for next
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable)) {
        return;
      }
      if (e.key === "[" || (e.altKey && e.key === "ArrowLeft")) {
        var prev = document.querySelector('[data-nav-prev], a[rel="prev"]');
        if (prev && prev.href) prev.click();
      } else if (e.key === "]" || (e.altKey && e.key === "ArrowRight")) {
        var next = document.querySelector('[data-nav-next], a[rel="next"]');
        if (next && next.href) next.click();
      }
    });

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.nav");
    }
  }

  kit.nav = {
    init: initNav
  };

  if (kit.registerModule) {
    kit.registerModule("shell.nav", kit.nav);
  }
})(typeof window !== "undefined" ? window : globalThis);
