/*
 * Optional component: official highlight.js theme, picked by course surface.
 *
 * Official stylesheets are loaded from the pinned highlight.js CDN. We do not
 * paraphrase them here — this file only decides which one applies, so the token
 * colours stay byte-identical to upstream.
 *
 * The choice follows `data-theme-surface` first (a course that returns a theme
 * switcher declares its surface explicitly), then the system preference.
 * `theme.js` calls `CourseCodeTheme.sync()` through the `course:themechange`
 * event so switching themes re-points the stylesheet immediately.
 *
 * Load after the course's theme configuration and before code-highlight.js.
 */
(function (root) {
  "use strict";

  var STYLE_ID = "course-code-theme";
  var LIGHT = "github.min.css";
  var DARK = "github-dark.min.css";

  var document = root.document;

  var THEME_CDN = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/";

  function themeUrl(surface) {
    var configured = root.COURSE_CODE_THEMES && root.COURSE_CODE_THEMES[surface];
    var file = surface === "light" ? LIGHT : DARK;
    if (!configured) return THEME_CDN + file;
    if (/^(https?:\/\/|\/|\.\.?\/)/.test(configured)) return configured;
    var name = String(configured).replace(/\.min\.css$/, "");
    return THEME_CDN + name.replace(/\.css$/, "") + ".min.css";
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
    var href = themeUrl(preferredSurface());
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    document.documentElement.style.colorScheme = preferredSurface();
    return file;
  }

  function init() {
    if (root.__COURSE_CODE_THEME_INIT__) return;
    root.__COURSE_CODE_THEME_INIT__ = true;
    sync();
    // The course theme switcher dispatches this when the surface changes.
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
