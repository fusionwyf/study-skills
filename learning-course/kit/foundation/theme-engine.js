(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var currentTheme = "course";
  var currentScheme = "light";

  function getCourseId() {
    if (typeof document === "undefined") return "default";
    var lesson = document.querySelector(".lesson, [data-course-id]");
    return (lesson && lesson.dataset.courseId) || "default";
  }

  function getSystemScheme() {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  function resolveSchemeForTheme(themeName) {
    if (themeName === "ink") return "dark";
    if (themeName === "paper") return "light";
    if (themeName === "course") return "light";
    return "light";
  }

  function updateHljsTheme(scheme) {
    if (typeof document === "undefined") return;
    var codeThemes = (kit.config && kit.config.code && kit.config.code.themes) || {
      light: "github",
      dark: "github-dark"
    };

    var themeName = scheme === "dark" ? (codeThemes.dark || "github-dark") : (codeThemes.light || "github");
    var isUrl = themeName.indexOf("/") !== -1 || themeName.indexOf(".css") !== -1;
    var isLocal = (kit.config && (kit.config.vendor_mode === "local" || (kit.config.vendor && kit.config.vendor.mode === "local")));
    var targetUrl = isUrl ? themeName : (isLocal ? "../assets/kit/vendor/hljs/styles/" + themeName + ".min.css" : "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/" + themeName + ".min.css");

    var link = document.getElementById("kit-hljs-theme");
    if (!link) {
      link = document.createElement("link");
      link.id = "kit-hljs-theme";
      link.rel = "stylesheet";
      link.href = targetUrl;
      document.head.appendChild(link);
    } else if (link.getAttribute("href") !== targetUrl) {
      // Create new link to preload before replacing to avoid flicker
      var nextLink = document.createElement("link");
      nextLink.rel = "stylesheet";
      nextLink.href = targetUrl;
      nextLink.onload = function () {
        link.remove();
        nextLink.id = "kit-hljs-theme";
      };
      nextLink.onerror = function () {
        nextLink.remove();
      };
      document.head.appendChild(nextLink);
    }
  }

  function applyTheme(themeName, persist) {
    currentTheme = themeName;
    currentScheme = resolveSchemeForTheme(themeName);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = currentTheme;
      document.documentElement.dataset.scheme = currentScheme;
      // Legacy compatibility
      document.documentElement.dataset.themeSurface = currentScheme;

      if (persist && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("kit_theme_" + getCourseId(), currentTheme);
        } catch (e) {}
      }

      updateHljsTheme(currentScheme);
    }

    kit.emit("kit:themechange", {
      theme: currentTheme,
      scheme: currentScheme
    });
  }

  function toggleTheme() {
    var next = currentTheme === "ink" ? "course" : "ink";
    applyTheme(next, true);
    return next;
  }

  function initTheme() {
    var stored = null;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        stored = window.localStorage.getItem("kit_theme_" + getCourseId());
      }
    } catch (e) {}

    var defaultTheme = (kit.config && kit.config.theme) || "course";
    var initialTheme = stored || defaultTheme;

    applyTheme(initialTheme, false);

    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
        if (!stored) {
          applyTheme(e.matches ? "ink" : "course", false);
        }
      });
    }

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("foundation");
    }
  }

  kit.theme = {
    getTheme: function () { return currentTheme; },
    getScheme: function () { return currentScheme; },
    setTheme: function (themeName) { applyTheme(themeName, true); },
    toggle: toggleTheme,
    init: initTheme
  };

  if (kit.registerModule) {
    kit.registerModule("foundation", kit.theme);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initTheme);
    } else {
      initTheme();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
