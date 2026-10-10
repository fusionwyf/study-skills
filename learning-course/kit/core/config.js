(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var defaults = {
    theme: "course",
    scheme: "auto",
    code: {
      themes: {
        light: "github",
        dark: "github-dark"
      }
    },
    math: {
      macros: {},
      trust: false,
      strict: "warn",
      throwOnError: false
    },
    toc: {
      depth: 2
    },
    vendor: {
      mode: "cdn"
    },
    question: {
      print: "review"
    }
  };

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== "object") target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  function readConfig() {
    var cfg = JSON.parse(JSON.stringify(defaults));

    if (typeof document !== "undefined") {
      var script = document.getElementById("kit-config");
      if (script && script.textContent) {
        try {
          var parsed = JSON.parse(script.textContent);
          deepMerge(cfg, parsed);
        } catch (e) {
          console.warn("[kit] Failed to parse #kit-config JSON", e);
        }
      }
    }

    // Legacy globals compatibility
    if (root.COURSE_THEMES) {
      console.warn("[kit] window.COURSE_THEMES is deprecated. Use assets/course/config.json or #kit-config.");
      if (Array.isArray(root.COURSE_THEMES) && root.COURSE_THEMES.length) {
        cfg.themes = root.COURSE_THEMES;
      }
    }
    if (root.COURSE_CODE_THEMES) {
      console.warn("[kit] window.COURSE_CODE_THEMES is deprecated. Use config.code.themes in config.json.");
      deepMerge(cfg.code.themes, root.COURSE_CODE_THEMES);
    }
    if (root.COURSE_MATH_OPTIONS) {
      console.warn("[kit] window.COURSE_MATH_OPTIONS is deprecated. Use config.math in config.json.");
      deepMerge(cfg.math, root.COURSE_MATH_OPTIONS);
    }

    return cfg;
  }

  kit.config = readConfig();
  kit.getConfig = readConfig;
})(typeof window !== "undefined" ? window : globalThis);
