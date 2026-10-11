(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var DEFAULT_VENDORS = {
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
      version: "4.1.2",
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.1.2/plotly.min.js",
        local: "../assets/kit/vendor/plotly.js-dist-min/plotly.min.js"
      }
    },
    jsxgraph: {
      id: "jsxgraph",
      version: "1.14.0",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraph.css",
        local: "../assets/kit/vendor/jsxgraph/jsxgraph.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraphcore.js",
        local: "../assets/kit/vendor/jsxgraph/jsxgraphcore.js"
      }
    }
  };

  var loadingPromises = {};

  function loadScript(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function (e) {
          reject(new Error("Failed to load script: " + url));
        });
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
        var msg = isLocal
          ? "Failed to load local vendor script: " + url + ". External network fallback is prohibited in local mode."
          : "Failed to load vendor script: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs, isLocal) {
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
      link.onerror = function (e) {
        var msg = isLocal
          ? "Failed to load local vendor stylesheet: " + url + ". External network fallback is prohibited in local mode."
          : "Failed to load stylesheet: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(link);
    });
  }

  function need(vendorId) {
    if (loadingPromises[vendorId]) return loadingPromises[vendorId];

    var vendorsRegistry = kit.VENDORS || DEFAULT_VENDORS;
    var vendor = vendorsRegistry[vendorId] || DEFAULT_VENDORS[vendorId];
    if (!vendor) {
      return Promise.reject(new Error("Unknown vendor id: " + vendorId));
    }

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) || "cdn";
    var useLocal = mode === "local";

    var promise;
    if (vendorId === "hljs") {
      var jsUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(jsUrl, null, useLocal);
    } else if (vendorId === "katex") {
      var cssUrl = useLocal ? (vendor.css && vendor.css.local) : (vendor.css && vendor.css.cdn);
      var katexJsUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      var autoRenderUrl = useLocal ? (vendor.autoRender && vendor.autoRender.local) : (vendor.autoRender && vendor.autoRender.cdn);
      promise = loadStyle(cssUrl, null, useLocal).then(function () {
        return loadScript(katexJsUrl, null, useLocal);
      }).then(function () {
        if (autoRenderUrl) {
          return loadScript(autoRenderUrl, null, useLocal);
        }
      });
    } else if (vendorId === "mermaid") {
      var mermaidUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(mermaidUrl, null, useLocal);
    } else if (vendorId === "plotly") {
      var plotlyUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(plotlyUrl, null, useLocal);
    } else if (vendorId === "jsxgraph") {
      var jsxCss = useLocal ? (vendor.css && vendor.css.local) : (vendor.css && vendor.css.cdn);
      var jsxJs = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadStyle(jsxCss, null, useLocal).then(function () {
        return loadScript(jsxJs, null, useLocal);
      });
    } else {
      promise = Promise.resolve();
    }

    loadingPromises[vendorId] = promise;
    return promise;
  }

  kit.need = need;
  kit.loader = { need: need };
  kit.VENDORS = kit.VENDORS || DEFAULT_VENDORS;
})(typeof window !== "undefined" ? window : globalThis);
