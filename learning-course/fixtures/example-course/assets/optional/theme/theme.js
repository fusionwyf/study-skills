/*
 * Optional component: theme switcher.
 *
 * A course owner decides the themes; this file only remembers the choice and
 * applies it. It ships NO colour values — every theme is a block of
 * `--course-*` custom properties in the course's own stylesheet, so branding a
 * course stays a CSS exercise and never requires touching this runtime.
 *
 * Register themes by declaring them on window.COURSE_THEMES before this script
 * runs, or by defining `[data-theme="<name>"]` rules in CSS and listing the
 * names here:
 *
 *   <script>
 *     window.COURSE_THEMES = [
 *       {name: "default", label: "默认", surface: "light"},
 *       {name: "ink",     label: "墨色", surface: "dark"}
 *     ];
 *   </script>
 *
 * Wiring: load theme.css in <head>, this file at the end of <body>.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "course-theme";
  var document = root.document;

  function themes() {
    var list = root.COURSE_THEMES;
    return Array.isArray(list) ? list.filter(function (t) { return t && t.name; }) : [];
  }

  function preferred() {
    // Explicit choice wins, then a remembered choice, then `auto`.
    var explicit = document.documentElement.dataset.theme;
    if (explicit && explicit !== "auto") return explicit;
    try {
      var saved = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch (error) { /* private mode: fall through to auto */ }
    return "auto";
  }

  /** Resolve `auto` against the system preference without shipping a palette. */
  function resolve(name) {
    if (name !== "auto") return name;
    var prefersDark = root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches;
    var list = themes();
    var autoMatch = list.filter(function (t) {
      return (t.surface || "dark") === (prefersDark ? "dark" : "light");
    })[0];
    return autoMatch ? autoMatch.name : (list[0] ? list[0].name : "default");
  }

  function apply(name) {
    var resolved = resolve(name);
    var html = document.documentElement;
    html.dataset.theme = resolved;
    var theme = themes().filter(function (t) { return t.name === resolved; })[0];
    // A course may declare the surface directly in markup (CSS-only usage).
    // Only override it when the matched theme actually states one.
    var declared = html.getAttribute("data-theme-surface");
    var surface = (theme && theme.surface) || declared || "dark";
    html.dataset.themeSurface = surface;
    html.style.colorScheme = surface === "light" ? "light" : "dark";
    return resolved;
  }

  function remember(name) {
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, name);
    } catch (error) { /* ignore unavailable storage */ }
  }

  function buildSwitcher() {
    var list = themes();
    // A single theme needs no switcher; `auto` only makes sense with 2+.
    if (list.length < 2) return;
    var host = document.querySelector("[data-theme-switch]");
    if (!host || host.dataset.themeSwitchReady === "true") return;

    var wrapper = document.createElement("div");
    wrapper.className = "theme-switch";
    var id = "course-theme-select";
    var label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = "主题";
    var select = document.createElement("select");
    select.id = id;
    var options = list.slice();
    options.push({name: "auto", label: "跟随系统"});
    var current = preferred();
    options.forEach(function (theme) {
      var option = document.createElement("option");
      option.value = theme.name;
      option.textContent = theme.label || theme.name;
      if (theme.name === current) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      remember(select.value);
      apply(select.value);
      // Optional components (code highlighting) read this to re-skin tokens.
      root.dispatchEvent(new CustomEvent("course:themechange", {
        detail: { theme: document.documentElement.dataset.theme, surface: document.documentElement.dataset.themeSurface }
      }));
    });
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    host.appendChild(wrapper);
    host.dataset.themeSwitchReady = "true";
  }

  function init() {
    if (root.__COURSE_THEME_INIT__) return;
    root.__COURSE_THEME_INIT__ = true;
    apply(document.documentElement.dataset.theme || "auto");
    buildSwitcher();
    // Follow the system while the learner has not made an explicit choice.
    if (root.matchMedia) {
      var query = root.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () { if (preferred() === "auto") apply("auto"); };
      if (query.addEventListener) query.addEventListener("change", onChange);
      else if (query.addListener) query.addListener(onChange);
    }
    root.CourseTheme = { apply: apply, resolve: resolve, list: themes };
    root.__COURSE_THEME_READY__ = true;
  }

  // Same forgiving start as code-highlight: apply as soon as a body exists, and
  // keep the parsing listener as a fallback rather than depending on timing.
  if (document.readyState === "loading" && !document.body) document.addEventListener("DOMContentLoaded", init);
  if (document.body) init();
  document.addEventListener("DOMContentLoaded", function () {
    if (!root.__COURSE_THEME_INIT__) init();
  });
}(typeof window !== "undefined" ? window : globalThis));
