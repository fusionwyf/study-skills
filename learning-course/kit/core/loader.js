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
    plot: {
      id: "plot",
      version: "0.6.16",
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js",
        local: "../assets/kit/vendor/observable-plot/plot.umd.min.js"
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

  function resolveVendorUrl(url, isLocal) {
    if (!url) return null;
    if (!isLocal) return url;
    if (typeof document !== "undefined") {
      var kitScript = document.querySelector('script[src*="kit.js"]');
      if (kitScript) {
        var src = kitScript.getAttribute("src") || "";
        var match = src.match(/^(.*?)kit\.js/);
        if (match) {
          var kitDir = match[1];
          var vendorRel = url.replace(/^(\.\.\/)+assets\/kit\//, "").replace(/^assets\/kit\//, "");
          return kitDir + vendorRel;
        }
      }
    }
    return url;
  }

  function loadScript(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("jsdom") >= 0) {
      return Promise.reject(new Error("External script loading is not supported in JSDOM: " + url));
    }
    return new Promise(function (resolve, reject) {
      var timer = null;
      if (typeof setTimeout === "function") {
        timer = setTimeout(function () {
          reject(new Error("Timeout loading script: " + url));
        }, isLocal ? 10000 : 30000);
      }
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") {
          if (timer) clearTimeout(timer);
          return resolve();
        }
        existing.addEventListener("load", function () {
          if (timer) clearTimeout(timer);
          resolve();
        });
        existing.addEventListener("error", function (e) {
          if (timer) clearTimeout(timer);
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
        if (timer) clearTimeout(timer);
        s.dataset.loaded = "true";
        resolve();
      };
      s.onerror = function (e) {
        if (timer) clearTimeout(timer);
        var msg = isLocal
          ? "Failed to load local vendor script: " + url
          : "Failed to load vendor script: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("jsdom") >= 0) {
      return Promise.reject(new Error("External stylesheet loading is not supported in JSDOM: " + url));
    }
    return new Promise(function (resolve, reject) {
      var timer = null;
      if (typeof setTimeout === "function") {
        timer = setTimeout(function () {
          reject(new Error("Timeout loading stylesheet: " + url));
        }, isLocal ? 10000 : 30000);
      }
      var existing = document.querySelector('link[href="' + url + '"]');
      if (existing) {
        if (timer) clearTimeout(timer);
        return resolve();
      }
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
      }
      link.onload = function () {
        if (timer) clearTimeout(timer);
        resolve();
      };
      link.onerror = function (e) {
        if (timer) clearTimeout(timer);
        var msg = isLocal
          ? "Failed to load local vendor stylesheet: " + url
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

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) ||
               (kit.config && kit.config.vendor_mode) || "cdn";
    // Only vendors with actual local distribution packages should use local mode
    var localPackages = ["plotly", "jsxgraph"];
    var useLocal = (mode === "local") && (localPackages.indexOf(vendorId) >= 0);

    function getUrl(item) {
      if (!item) return null;
      if (typeof item === "string") return item;
      var raw = useLocal ? item.local : item.cdn;
      return resolveVendorUrl(raw, useLocal);
    }

    var styles = vendor.css ? (Array.isArray(vendor.css) ? vendor.css : [vendor.css]) : [];
    var scripts = vendor.js ? (Array.isArray(vendor.js) ? vendor.js : [vendor.js]) : [];
    if (vendor.autoRender) scripts.push(vendor.autoRender);

    var promise = Promise.all(styles.map(function (s) {
      var primaryUrl = getUrl(s);
      if (!primaryUrl) return Promise.resolve();
      return loadStyle(primaryUrl, null, useLocal).catch(function (err) {
        if (useLocal && s.cdn) {
          return loadStyle(s.cdn, null, false);
        }
        if (!useLocal && s.local) {
          var fallbackLocal = resolveVendorUrl(s.local, true);
          return loadStyle(fallbackLocal, null, true);
        }
        throw err;
      });
    })).then(function () {
      return scripts.reduce(function (seq, sc) {
        return seq.then(function () {
          var primaryUrl = getUrl(sc);
          if (!primaryUrl) return Promise.resolve();
          return loadScript(primaryUrl, null, useLocal).catch(function (err) {
            // Dual-fallback: if cdn failed, try local; if local failed, try cdn
            if (useLocal && sc.cdn) {
              return loadScript(sc.cdn, null, false);
            }
            if (!useLocal && sc.local) {
              var fallbackLocal = resolveVendorUrl(sc.local, true);
              return loadScript(fallbackLocal, null, true);
            }
            throw err;
          });
        });
      }, Promise.resolve());
    });

    loadingPromises[vendorId] = promise;
    return promise;
  }

  kit.need = need;
  kit.loader = { need: need };
  kit.VENDORS = kit.VENDORS || DEFAULT_VENDORS;
})(typeof window !== "undefined" ? window : globalThis);
