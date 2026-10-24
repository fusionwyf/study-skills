/*
 * viz.kinds.plot — Observable Plot 适配器 (opt-in)
 *
 * 现代 2D 统计/函数图表首选；Plotly 退居 3D 曲面/热图专用。
 * 配置契约（data-viz-config）：
 *   {
 *     "model": "说明该图表达什么",
 *     "domain": "数据来源与范围",
 *     "precision": "精度与单位",
 *     "plot": {           // 直接透传给 Plot.plot() 的规范（marks/axes 必须在这里声明）
 *       "marks": [ { "type": "line", "data": [...], "x": "...", "y": "..." } ]
 *     }
 *   }
 * mark 类型：line / dot / barY / ruleY / areaY / rectY / text 等官方名称；
 * 数据内联在 mark.data，或用 mark.dataKey 引用 config.datasets 中命名数组。
 * 颜色默认读取当前主题 --series-* 变量。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  var ALLOWED_MARKS = [
    "line", "lineX", "lineY", "dot", "barY", "barX", "ruleY", "ruleX",
    "areaY", "areaX", "rectY", "rectX", "text", "frame", "gridX", "gridY", "tickX", "tickY"
  ];

  function validatePlot(config) {
    core.validateCommon(config);
    if (!config.plot || typeof config.plot !== "object") {
      throw new Error("plot 需要 plot 规范对象");
    }
    var marks = config.plot.marks;
    if (!Array.isArray(marks) || !marks.length) throw new Error("plot.marks 不能为空");
    var datasets = config.datasets || {};
    marks.forEach(function (mark, index) {
      if (!mark || typeof mark !== "object") throw new Error("plot.marks[" + index + "] 必须是对象");
      var type = mark.type;
      if (!type || (ALLOWED_MARKS.indexOf(type) < 0 && typeof root.Plot === "undefined")) {
        throw new Error("plot.marks[" + index + "] 类型 " + type + " 不在允许列表: " + ALLOWED_MARKS.join("/"));
      }
      var data = mark.data != null ? mark.data : datasets[mark.dataKey];
      if (mark.dataKey && data == null) {
        throw new Error("plot.marks[" + index + "] dataKey " + mark.dataKey + " 未在 datasets 中定义");
      }
      if (data != null && !Array.isArray(data)) {
        throw new Error("plot.marks[" + index + "] data 必须是数组");
      }
    });
    return config;
  }

  function seriesColor(index) {
    var styles = getComputedStyle(document.documentElement);
    var value = styles.getPropertyValue("--series-" + ((index % 8) + 1)).trim();
    return value || undefined;
  }

  function resolveMark(mark, config, index) {
    var Plot = root.Plot;
    if (!Plot || typeof Plot[mark.type] !== "function") return null;
    var spec = Object.assign({}, mark);
    var type = spec.type;
    delete spec.type;
    var data = spec.data != null ? spec.data : (config.datasets || {})[spec.dataKey];
    if (spec.dataKey) delete spec.dataKey;
    if (data != null) {
      return Plot[type](data, spec);
    }
    return Plot[type](spec);
  }

  async function renderPlot(node, config) {
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    var Plot = root.Plot;
    if (!Plot) {
      var needFn = kit.need || (kit.loader && kit.loader.need);
      if (needFn) {
        await needFn("plot");
        Plot = root.Plot;
      }
    }
    if (!Plot) {
      var note = document.createElement("p");
      note.textContent = "Observable Plot 不可用；请核对无脚本后备。";
      host.appendChild(note);
      h.status(node, note.textContent);
      return;
    }

    var options = Object.assign({}, config.plot);
    var colorIndex = 0;
    options.marks = (options.marks || []).map(function (mark) {
      var resolved = resolveMark(mark, config, colorIndex);
      if (resolved) colorIndex += 1;
      return resolved;
    }).filter(Boolean);
    options.style = Object.assign({
      color: "var(--c-text)",
      background: "transparent",
      fontFamily: "var(--font-mono)",
      fontSize: 12
    }, options.style || {});
    options.margins = options.margins || undefined;

    var figure = Plot.plot(options);
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-label", config.model);
    figure.style.maxWidth = "100%";
    figure.style.height = "auto";
    host.appendChild(figure);
    h.status(node, "Plot 图表已渲染，共 " + options.marks.length + " 个 mark。");
    h.record(node, { kind: "plot", model: config.model, marks: (config.plot.marks || []).length });

    return {
      update: function (el, initial, snapshot) {
        var next = h.boundConfig(el, initial, snapshot);
        return renderPlot(node, next);
      },
      destroy: function () {
        h.clear(host);
      }
    };
  }

  core.registerKind("plot", { validate: validatePlot, render: renderPlot });

  if (kit.registerModule) {
    kit.registerModule("viz.kinds.plot", {
      init: function () {
        return Promise.resolve();
      }
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
