(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var TITLES = {
    note: "注意",
    info: "说明",
    tip: "提示",
    warning: "警告",
    danger: "危险"
  };

  function enhanceCallout(el) {
    var type = el.dataset.callout || "note";
    if (!el.querySelector(".callout__title")) {
      var title = document.createElement("div");
      title.className = "callout__title";
      title.textContent = TITLES[type] || type.toUpperCase();
      el.insertBefore(title, el.firstChild);
    }
  }

  function init() {
    if (typeof document === "undefined") return;
    var callouts = document.querySelectorAll(".callout, aside[data-callout]");
    Array.prototype.forEach.call(callouts, enhanceCallout);
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.callout");
  }

  kit.callout = {
    init: init
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
