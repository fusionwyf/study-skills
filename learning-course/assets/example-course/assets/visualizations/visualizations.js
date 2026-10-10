/*
 * LearnKit visualisation core.
 *
 * This file owns the contract every visualisation kind shares: the registry,
 * the lifecycle, the container wiring, and the fallback path. It renders
 * nothing by itself — each kind lives in its own file under `kinds/` and
 * registers itself here through `registerKind`, so a course loads only the
 * kinds it actually uses.
 *
 * That split is the whole point, and it follows the two tiers a course cares
 * about:
 *
 *   universal  `kinds/list.js` (relation · timeline · process),
 *              `kinds/sequence.js`, `kinds/table.js` — plain HTML/SVG, no
 *              vendor library, copied into every new course by init_course.py.
 *   optional   `kinds/chart.js` (4.7 MB Plotly), `kinds/spatial.js` (JSXGraph)
 *              — installed only when a course asks for them, because one file
 *              for all seven kinds would force every course to carry the heavy
 *              two.
 *
 * Load order: this file first, then the modules for the kinds you use.
 * Container contract (unchanged, see references/render.md):
 *   [data-visualization="<kind>"] + [data-viz-config] + [data-viz-host]
 *   + [data-viz-status] + [data-viz-fallback]
 */
(function (root) {
  "use strict";

  var adapters = {};
  var document = root.document;
  var moduleBase = document && document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/[^/]*$/, "") : null;
  var assetPromises = {};

  /* --- Shared numeric and DOM helpers used by every kind ---------------- */

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function finiteArray(values) { return Array.isArray(values) && values.length > 0 && values.every(finite); }
  function find(node, selector) { return node.querySelector(selector); }
  function fmt(value) { return finite(value) ? Number(value.toPrecision(8)).toString() : String(value); }
  function escape(value) { return String(value).replace(/[&<>"]/g, function (ch) { return {"&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;"}[ch]; }); }
  function record(node, state) { node.dataset.visualState = JSON.stringify(state); }
  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function status(node, text) { var target = find(node, "[data-viz-status]"); if (target) target.textContent = text; }
  function show(node) { var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"); if (host) host.hidden = false; if (controls) controls.hidden = false; }

  function loadAsset(relative, globalName, stylesheet) {
    if (globalName && root[globalName]) return Promise.resolve(true);
    if (!document || !moduleBase) return Promise.resolve(false);
    if (assetPromises[relative]) return assetPromises[relative];
    assetPromises[relative] = new Promise(function (resolve) {
      var url;
      try { url = new URL(relative, moduleBase).href; }
      catch (error) { url = moduleBase + relative; }
      if (stylesheet) {
        var link = document.createElement("link");
        link.rel = "stylesheet"; link.href = url;
        link.onload = function () { resolve(true); };
        link.onerror = function () { resolve(false); };
        (document.head || document.documentElement).appendChild(link);
        return;
      }
      var script = document.createElement("script");
      script.src = url; script.async = false;
      script.onload = function () { resolve(!globalName || !!root[globalName]); };
      script.onerror = function () { resolve(false); };
      (document.head || document.documentElement).appendChild(script);
    });
    return assetPromises[relative];
  }

  /* --- Registry --------------------------------------------------------- */

  function registerKind(name, adapter) {
    if (!name || !adapter || typeof adapter.validate !== "function" || typeof adapter.render !== "function") throw new Error("registerKind 需要 validate 和 render");
    adapters[name] = adapter;
  }

  /** Reject a config that does not describe itself, before any rendering. */
  function validateCommon(config) {
    if (!config || typeof config !== "object") throw new Error("可视化配置必须是对象");
    ["model", "domain", "precision"].forEach(function (key) {
      if (typeof config[key] !== "string" || !config[key].trim()) throw new Error("配置需要非空 " + key + " 说明");
    });
    return config;
  }

  function validateConfig(kind, config) {
    var adapter = adapters[kind];
    if (!adapter) throw new Error("未知可视化类型：" + kind);
    return adapter.validate(config);
  }

  /* --- Public surface --------------------------------------------------- */

  var api = {
    validateCommon: validateCommon,
    validateConfig: validateConfig,
    registerKind: registerKind,
    adapters: adapters,
    // Helpers a kind module needs. Exposed so modules stay small and the
    // DOM/numeric conventions live in exactly one place.
    helpers: {
      finite: finite, finiteArray: finiteArray, find: find, fmt: fmt, escape: escape,
      boundConfig: function (node, config, snapshot) {
        var derived = snapshot && snapshot.derived || {};
        var value = derived.visualizations && derived.visualizations[node.id] || derived.visualization;
        return value ? Object.assign({}, config, value) : config;
      },
      record: record, svgEl: svgEl, clear: clear, status: status, show: show,
      loadVendor: function (relative, globalName) { return loadAsset("vendor/" + relative, globalName, false); },
      loadStylesheet: function (relative) { return loadAsset("vendor/" + relative, null, true); }
    },
    /** Which kinds are actually loaded — used by tests and by course.js. */
    loaded: function () { return Object.keys(adapters).sort(); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!document) return;
  root.CourseVisualizations = api;

  async function init() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-visualization]"));
    await Promise.all(nodes.map(async function (node) {
      try {
        var configNode = find(node, "[data-viz-config]");
        if (!configNode) throw new Error("缺少 data-viz-config");
        var kind = node.dataset.visualization, config = validateConfig(kind, JSON.parse(configNode.textContent));
        var sourceStore = null;
        if (node.dataset.vizSource) {
          var source = document.querySelector(node.dataset.vizSource);
          sourceStore = source && source.__learnkitStore;
          if (!sourceStore) throw new Error("data-viz-source 未找到 LearnKit 状态源：" + node.dataset.vizSource);
        }
        var instance = await adapters[kind].render(node, config, {sourceStore: sourceStore});
        var instanceUpdate = instance && typeof instance.update === "function" ? instance.update : adapters[kind].update;
        if (sourceStore && typeof instanceUpdate !== "function") throw new Error("此适配器不支持 data-viz-source 动态更新");
        if (sourceStore) {
          var revision = 0;
          var update = function (snapshot) {
            var current = ++revision;
            function failed(error) {
              if (current !== revision) return;
              node.dataset.vizReady = "failed";
              var host = find(node, "[data-viz-host]"); if (host) host.hidden = true;
              status(node, error.message);
            }
            try {
              var result = instanceUpdate(node, config, snapshot, instance);
              if (result && typeof result.then === "function") {
                node.dataset.vizReady = "pending";
                return Promise.resolve(result).then(function () {
                  if (current === revision) node.dataset.vizReady = "true";
                }, failed);
              }
              node.dataset.vizReady = "true";
            } catch (error) { failed(error); }
          };
          node.__vizUnsubscribe = sourceStore.subscribe(update);
          await update(sourceStore.snapshot());
        }
        if ((sourceStore || instance && typeof instance.destroy === "function") && root.addEventListener) {
          node.__vizDestroy = function () {
            if (node.__vizUnsubscribe) node.__vizUnsubscribe();
            if (instance && instance.destroy) instance.destroy();
          };
          root.addEventListener("pagehide", node.__vizDestroy, {once: true});
        }
        if (node.dataset.vizReady !== "failed") node.dataset.vizReady = "true";
      } catch (error) {
        // A missing kind module and a malformed config both land here; either
        // way the readable fallback stays on screen instead of a blank stage.
        node.dataset.vizReady = "failed";
        var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"); if (host) host.hidden = true; if (controls) controls.hidden = true;
        status(node, error.message);
      }
    }));
    root.__COURSE_VISUALIZATIONS_READY__ = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}(typeof window !== "undefined" ? window : globalThis));
