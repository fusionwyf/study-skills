(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function renderSwitcher(container) {
    container.innerHTML = "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kit-theme-toggle";

    function updateLabel() {
      var current = (kit.theme && kit.theme.getTheme && kit.theme.getTheme()) || "course";
      btn.textContent = current === "ink" ? "☀️ 浅色主题" : "🌙 深色主题";
    }

    btn.addEventListener("click", function () {
      if (kit.theme && kit.theme.toggle) {
        kit.theme.toggle();
        updateLabel();
      }
    });

    updateLabel();
    container.appendChild(btn);

    kit.on("kit:themechange", updateLabel);
  }

  function initSwitchers() {
    if (typeof document === "undefined") return;
    var containers = document.querySelectorAll("[data-theme-switch]");
    Array.prototype.forEach.call(containers, renderSwitcher);
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.theme-switcher");
  }

  kit.themeSwitcher = {
    init: initSwitchers
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSwitchers);
    else initSwitchers();
  }
})(typeof window !== "undefined" ? window : globalThis);
