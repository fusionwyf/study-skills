(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var VENDORS = {
    hljs: {
      id: "hljs",
      version: "11.12.0",
      js: {
        cdn: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js",
        local: "../assets/kit/vendor/hljs/highlight.min.js"
      }
    },
    katex: {
      id: "katex",
      version: "0.16.11",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
        local: "../assets/kit/vendor/katex/katex.min.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
        local: "../assets/kit/vendor/katex/katex.min.js"
      },
      autoRender: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
        local: "../assets/kit/vendor/katex/auto-render.min.js"
      }
    },
    mermaid: {
      id: "mermaid",
      version: "11.4.1",
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
        local: "../assets/kit/vendor/mermaid/mermaid.min.js"
      }
    },
    plotly: {
      id: "plotly",
      version: "2.35.2",
      js: {
        cdn: "https://cdn.plot.ly/plotly-2.35.2.min.js",
        local: "../assets/visualizations/vendor/plotly.js-dist-min/plotly.min.js"
      }
    },
    jsxgraph: {
      id: "jsxgraph",
      version: "1.10.1",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.10.1/distrib/jsxgraph.css",
        local: "../assets/visualizations/vendor/jsxgraph/jsxgraph.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.10.1/distrib/jsxgraphcore.js",
        local: "../assets/visualizations/vendor/jsxgraph/jsxgraphcore.js"
      }
    }
  };

  var loadingPromises = {};

  function loadScript(url, attrs) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function (e) { reject(e); });
        return;
      }
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      }
      s.onload = function () {
        s.dataset.loaded = "true";
        resolve();
      };
      s.onerror = function (e) {
        reject(new Error("Failed to load script: " + url));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('link[href="' + url + '"]');
      if (existing) return resolve();
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
      }
      link.onload = function () { resolve(); };
      link.onerror = function (e) { reject(new Error("Failed to load stylesheet: " + url)); };
      document.head.appendChild(link);
    });
  }

  function need(vendorId) {
    if (loadingPromises[vendorId]) return loadingPromises[vendorId];

    var vendor = VENDORS[vendorId];
    if (!vendor) {
      return Promise.reject(new Error("Unknown vendor id: " + vendorId));
    }

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) || "cdn";
    var useLocal = mode === "local";

    var promise;
    if (vendorId === "hljs") {
      var jsUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(jsUrl);
    } else if (vendorId === "katex") {
      var cssUrl = useLocal ? vendor.css.local : vendor.css.cdn;
      var katexJsUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      var autoRenderUrl = useLocal ? vendor.autoRender.local : vendor.autoRender.cdn;
      promise = loadStyle(cssUrl).then(function () {
        return loadScript(katexJsUrl);
      }).then(function () {
        return loadScript(autoRenderUrl);
      });
    } else if (vendorId === "mermaid") {
      var mermaidUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(mermaidUrl);
    } else if (vendorId === "plotly") {
      var plotlyUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(plotlyUrl);
    } else if (vendorId === "jsxgraph") {
      var jsxCss = useLocal ? vendor.css.local : vendor.css.cdn;
      var jsxJs = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadStyle(jsxCss).then(function () {
        return loadScript(jsxJs);
      });
    } else {
      promise = Promise.resolve();
    }

    loadingPromises[vendorId] = promise;
    return promise;
  }

  kit.need = need;
  kit.VENDORS = VENDORS;
})(typeof window !== "undefined" ? window : globalThis);
