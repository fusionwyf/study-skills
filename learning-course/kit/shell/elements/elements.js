/*
 * shell.elements — Web Components 双轨外壳 (Light DOM Custom Elements)
 *
 * 与语义 HTML + data-* 契约 100% 等价的简洁写法。自定义元素在
 * customElements.define 时同步升级既有 DOM，把简洁属性归一化为
 * 标准 data-* 结构，随后由各内容模块按原契约接管：
 *
 *   <kit-question kind="choice" question-id="q1" max-attempts="2"> … </kit-question>
 *   <kit-callout type="tip" label="重点提示" fold="open"> … </kit-callout>
 *   <kit-viz kind="chart" id="demo"> … </kit-viz>
 *   <kit-predict question-id="p1" answer="9.8" tolerance="0.5" unit="m/s"> … </kit-predict>
 *   <kit-param name="mass" min="0.5" max="5" step="0.1" value="1" unit="kg"></kit-param>
 *   <kit-island id="pendulum"> … </kit-island>
 *
 * 归一化发生在 kit.js 求值时（早于 initAll），因此静态页面无需额外处理；
 * 动态插入的节点由 connectedCallback 归一化属性，交互增强仍以整页初始化为准。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function mapAttributes(node, mapping) {
    Object.keys(mapping).forEach(function (from) {
      var to = mapping[from];
      if (node.hasAttribute(from) && !node.hasAttribute(to)) {
        node.setAttribute(to, node.getAttribute(from) || "");
      }
      node.removeAttribute(from);
    });
  }

  function addClass(node, cls) {
    var classes = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    if (classes.indexOf(cls) === -1) classes.push(cls);
    node.setAttribute("class", classes.join(" "));
  }

  var ELEMENT_SPECS = {
    "kit-question": {
      normalize: function (node) {
        mapAttributes(node, {
          "kind": "data-kind",
          "question-id": "data-question-id",
          "max-attempts": "data-max-attempts",
          "expected": "data-expected",
          "tolerance": "data-tolerance",
          "unit": "data-unit",
          "accepted": "data-accepted"
        });
        addClass(node, "question");
        if (!node.hasAttribute("data-role")) node.setAttribute("data-role", "evidence");
      }
    },
    "kit-callout": {
      normalize: function (node) {
        mapAttributes(node, { "type": "data-callout", "fold": "data-fold" });
        addClass(node, "callout");
        var label = node.getAttribute("label");
        if (label && !node.querySelector(".callout__title")) {
          var title = document.createElement("div");
          title.className = "callout__title";
          title.textContent = label;
          node.insertBefore(title, node.firstChild);
        }
        node.removeAttribute("label");
      }
    },
    "kit-viz": {
      normalize: function (node) {
        mapAttributes(node, { "kind": "data-visualization" });
        addClass(node, "visualization");
        if (!node.id) node.id = "kit-viz-" + Math.random().toString(36).slice(2, 8);
      }
    },
    "kit-predict": {
      normalize: function (node) {
        mapAttributes(node, {
          "question-id": "data-question-id",
          "answer": "data-answer",
          "tolerance": "data-tolerance",
          "unit": "data-unit"
        });
        if (!node.hasAttribute("data-question-id") && node.id) {
          node.setAttribute("data-question-id", node.id);
        }
        node.setAttribute("data-predict", "");
      }
    },
    "kit-param": {
      normalize: function (node) {
        mapAttributes(node, {
          "name": "data-param",
          "min": "data-min",
          "max": "data-max",
          "step": "data-step",
          "value": "data-value",
          "unit": "data-unit",
          "label": "data-label"
        });
      }
    },
    "kit-island": {
      normalize: function (node) {
        if (!node.id && node.hasAttribute("name")) {
          node.id = node.getAttribute("name") || "";
        }
        node.setAttribute("data-island", "");
      }
    }
  };

  function rerunModuleInit(moduleId) {
    var mod = kit.getModule && kit.getModule(moduleId);
    if (mod && typeof mod.init === "function") {
      try { mod.init(); } catch (error) { console.error("[kit] elements re-init " + moduleId + ":", error); }
    }
  }

  var REINIT_AFTER = {
    "kit-question": "learning.question",
    "kit-callout": "content.callout",
    "kit-viz": "viz.core",
    "kit-predict": "learning.predict",
    "kit-param": "learning.param",
    "kit-island": "viz.island"
  };

  function upgradeAll() {
    Object.keys(ELEMENT_SPECS).forEach(function (tag) {
      if (typeof document === "undefined") return;
      document.querySelectorAll(tag).forEach(function (node) {
        try {
          ELEMENT_SPECS[tag].normalize(node);
          node.dataset.kitElementNormalized = "true";
        } catch (error) {
          console.error("[kit] element normalize failed for <" + tag + ">:", error);
        }
      });
    });
  }

  if (typeof customElements !== "undefined" && typeof document !== "undefined") {
    Object.keys(ELEMENT_SPECS).forEach(function (tag) {
      if (customElements.get(tag)) return;
      var spec = ELEMENT_SPECS[tag];
      var Controller = function () { return Reflect.construct(HTMLElement, [], Controller); };
      Controller.prototype = Object.create(HTMLElement.prototype, {
        connectedCallback: {
          value: function () {
            if (this.dataset.kitElementNormalized === "true") return;
            try {
              spec.normalize(this);
              this.dataset.kitElementNormalized = "true";
            } catch (error) {
              console.error("[kit] element normalize failed for <" + tag + ">:", error);
            }
            if (kit.__ACTIVE_MODULES__ && kit.getModule && REINIT_AFTER[tag]) {
              rerunModuleInit(REINIT_AFTER[tag]);
            }
          }
        }
      });
      Object.defineProperty(Controller, "observedAttributes", { value: [] });
      customElements.define(tag, Controller);
    });
  }

  kit.elements = { specs: ELEMENT_SPECS, upgradeAll: upgradeAll };
  if (kit.registerModule) {
    kit.registerModule("shell.elements", {
      init: function () {
        upgradeAll();
      }
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
