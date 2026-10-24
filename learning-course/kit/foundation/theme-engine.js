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

  /*
   * 主题预设注册表。
   * scheme：页面明暗；code：代码块高亮使用的明暗（可与页面不同，例如浅色页面配深色代码块）；
   * fonts：按需加载的网页字体（fontsource 包名:字重，或完整 URL），失败时回退到 CSS 字体栈。
   */
  var THEMES = {
    course:    { label: "默认",     scheme: "light" },
    paper:     { label: "纸张",     scheme: "light" },
    ink:       { label: "深色",     scheme: "dark" },
    swiss:     { label: "瑞士网格", scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "jetbrains-mono:400,700"] },
    blueprint: { label: "工程蓝图", scheme: "dark",
                 fonts: ["noto-sans-sc:400,700", "jetbrains-mono:400,700"] },
    riso:      { label: "孔版印刷", scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "space-grotesk:500,700"] },
    brutal:    { label: "新粗野",   scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "space-grotesk:500,700", "jetbrains-mono:400,700"] },
    field:     { label: "博物志",   scheme: "light", code: "dark",
                 fonts: ["lxgw-wenkai", "jetbrains-mono:400,700"] }
  };

  function themeMeta(themeName) {
    return THEMES[themeName] || { label: themeName, scheme: "light" };
  }

  function resolveSchemeForTheme(themeName) {
    return themeMeta(themeName).scheme || "light";
  }

  var FONT_URLS = {
    "lxgw-wenkai": "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
  };

  function fontUrls(spec) {
    if (spec.indexOf("/") !== -1) return [spec];
    if (FONT_URLS[spec]) return [FONT_URLS[spec]];
    var parts = spec.split(":");
    var weights = (parts[1] || "400").split(",");
    return weights.map(function (w) {
      return "https://cdn.jsdelivr.net/npm/@fontsource/" + parts[0] + "@5/" + w.trim() + ".css";
    });
  }

  var loadedFonts = {};
  function loadThemeFonts(themeName) {
    if (typeof document === "undefined") return;
    var mode = kit.config && kit.config.fonts;
    if (mode === "system" || mode === false) return;
    (themeMeta(themeName).fonts || []).forEach(function (spec) {
      fontUrls(spec).forEach(function (url) {
        if (loadedFonts[url]) return;
        loadedFonts[url] = true;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.setAttribute("data-kit-font", themeName);
        link.onerror = function () { link.remove(); };
        document.head.appendChild(link);
      });
    });
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

      loadThemeFonts(currentTheme);
      updateHljsTheme(themeMeta(currentTheme).code || currentScheme);
    }

    kit.emit("kit:themechange", {
      theme: currentTheme,
      scheme: currentScheme
    });
  }

  function defaultTheme() {
    return (kit.config && kit.config.theme) || "course";
  }

  // 在课程默认主题与深色主题之间切换；若默认主题本身是深色，则切到 course。
  function toggleTheme() {
    var base = defaultTheme();
    var alt = resolveSchemeForTheme(base) === "dark" ? "course" : "ink";
    var next = currentTheme === base ? alt : base;
    applyTheme(next, true);
    return next;
  }

  // 可切换的主题列表：config.themes（数组）优先，否则为 [默认主题, 深色/浅色备选]。
  function availableThemes() {
    var list = kit.config && Array.isArray(kit.config.themes) ? kit.config.themes.slice() : null;
    if (!list || !list.length) {
      var base = defaultTheme();
      list = [base, resolveSchemeForTheme(base) === "dark" ? "course" : "ink"];
    }
    return list.filter(function (name, i) { return list.indexOf(name) === i; });
  }

  var themeInitialized = false;
  function initTheme() {
    if (themeInitialized) return;
    themeInitialized = true;
    var stored = null;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        stored = window.localStorage.getItem("kit_theme_" + getCourseId());
      }
    } catch (e) {}

    var base = defaultTheme();
    // 已存储的主题若不在可切换列表中（例如课程更换了预设），回到默认主题。
    var initialTheme = stored && availableThemes().indexOf(stored) !== -1 ? stored : base;

    applyTheme(initialTheme, false);

    // 仅当课程使用默认 course 主题且学习者未手动选择时，才跟随系统明暗。
    if (typeof window !== "undefined" && window.matchMedia && base === "course") {
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
    list: availableThemes,
    meta: themeMeta,
    // 课程扩展可注册自定义预设：kit.theme.register("my-theme", { label, scheme, code, fonts })
    register: function (name, meta) { THEMES[name] = meta || { label: name, scheme: "light" }; },
    init: initTheme
  };

  if (kit.registerModule) {
    kit.registerModule("foundation", kit.theme);
  }

  if (typeof document !== "undefined" && !kit.registerModule) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initTheme);
    } else {
      initTheme();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
