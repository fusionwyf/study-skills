/*
 * Optional component: official highlight.js theme, picked by course surface.
 *
 * highlight.js publishes 516 ready-made stylesheets. We do not paraphrase any
 * of them here — this file only decides *which* one applies, so the token
 * colours stay byte-identical to upstream.
 *
 * The choice follows `data-theme-surface` first (a course that returns a theme
 * switcher declares its surface explicitly), then the system preference.
 * `theme.js` calls `CourseCodeTheme.sync()` through the `course:themechange`
 * event so switching themes re-points the stylesheet immediately.
 *
 * Load this AFTER course.css and BEFORE code-highlight.css.
 */
(function (root) {
  "use strict";

  var STYLE_ID = "course-code-theme";
  var LIGHT = "github.min.css";
  var DARK = "github-dark.min.css";

  var document = root.document;

  /** Resolve the directory this script lives in, so the theme sits beside it. */
  function baseDir() {
    var self = document.currentScript;
    if (self && self.src) return self.src.replace(/[^/]*$/, "");
    var scripts = document.querySelectorAll("script[src]");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/code-highlight-theme\.js$/.test(scripts[i].getAttribute("src") || "")) {
        return scripts[i].src.replace(/[^/]*$/, "");
      }
    }
    return "";
  }

  function preferredSurface() {
    var html = document.documentElement;
    var declared = html.getAttribute("data-theme-surface");
    if (declared) return declared === "light" ? "light" : "dark";
    var dark = root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches;
    return dark ? "dark" : "light";
  }

  /** Point the single theme <link> at the stylesheet matching the surface. */
  function sync() {
    var file = preferredSurface() === "light" ? LIGHT : DARK;
    var link = document.getElementById(STYLE_ID);
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = STYLE_ID;
      document.head.appendChild(link);
    }
    var href = baseDir() + file;
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    document.documentElement.style.colorScheme = preferredSurface();
    return file;
  }

  function init() {
    if (root.__COURSE_CODE_THEME_INIT__) return;
    root.__COURSE_CODE_THEME_INIT__ = true;
    sync();
    // code-highlight.js dispatches this once the engine has coloured the page.
    root.addEventListener("course:themechange", sync);
    if (root.matchMedia) {
      var query = root.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        // An explicit declaration always wins over the system preference.
        if (!document.documentElement.getAttribute("data-theme-surface")) sync();
      };
      if (query.addEventListener) query.addEventListener("change", onChange);
      else if (query.addListener) query.addListener(onChange);
    }
    root.CourseCodeTheme = { sync: sync, surface: preferredSurface };
  }

  // Same forgiving start as the other optional components.
  if (document.readyState === "loading" && !document.body) document.addEventListener("DOMContentLoaded", init);
  if (document.body) init();
  document.addEventListener("DOMContentLoaded", function () {
    if (!root.__COURSE_CODE_THEME_INIT__) init();
  });
}(typeof window !== "undefined" ? window : globalThis));
