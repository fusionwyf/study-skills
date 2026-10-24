(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function themeLabel(name) {
    var meta = kit.theme && kit.theme.meta ? kit.theme.meta(name) : null;
    return (meta && meta.label) || name;
  }

  function currentTheme() {
    return (kit.theme && kit.theme.getTheme && kit.theme.getTheme()) || "course";
  }

  // 两个主题：单按钮切换；三个及以上：下拉选择。
  function renderSwitcher(container) {
    container.innerHTML = "";
    var themes = kit.theme && kit.theme.list ? kit.theme.list() : ["course", "ink"];

    if (themes.length > 2) {
      var select = document.createElement("select");
      select.className = "kit-theme-select";
      select.setAttribute("aria-label", "切换主题");
      themes.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = themeLabel(name);
        select.appendChild(opt);
      });
      select.value = currentTheme();
      select.addEventListener("change", function () {
        if (kit.theme && kit.theme.setTheme) kit.theme.setTheme(select.value);
      });
      container.appendChild(select);
      kit.on("kit:themechange", function () { select.value = currentTheme(); });
      return;
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kit-theme-toggle";

    function updateLabel() {
      var cur = currentTheme();
      var other = themes[0] === cur ? themes[1] : themes[0];
      var dark = kit.theme && kit.theme.meta && kit.theme.meta(other).scheme === "dark";
      btn.textContent = (dark ? "🌙 " : "☀️ ") + themeLabel(other);
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
    // data-theme-switcher 为课件模板写法；data-theme-switch 为旧写法，两者等价。
    var containers = document.querySelectorAll("[data-theme-switcher], [data-theme-switch]");
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
