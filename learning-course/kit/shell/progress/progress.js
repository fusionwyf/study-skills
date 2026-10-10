(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initProgress() {
    if (typeof document === "undefined") return;

    var bar = document.createElement("div");
    bar.className = "kit-progress-bar";
    document.body.appendChild(bar);

    function update() {
      var scroll = window.scrollY || document.documentElement.scrollTop;
      var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (height > 0) {
        var pct = Math.min(100, Math.max(0, (scroll / height) * 100));
        bar.style.width = pct + "%";
      }
    }

    var onScroll = kit.util ? kit.util.throttleRAF(update) : update;
    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.progress");
  }

  kit.progress = {
    init: initProgress
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProgress);
    else initProgress();
  }
})(typeof window !== "undefined" ? window : globalThis);
