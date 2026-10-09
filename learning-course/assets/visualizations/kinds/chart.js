/*
 * Kind module: chart — plots and surfaces (optional, needs Plotly).
 *
 * Uses Plotly when the vendor bundle is present and falls back to a built-in
 * SVG line/bar renderer when it is not, so a course that skips the 4.7 MB
 * download still gets a readable plot instead of a blank stage.
 *
 * Load after visualizations.js. Plotly itself is copied by
 * `install_optional.py --components chart`, not committed to the course.
 */
(function (root) {
  "use strict";

  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;

  var TRACE_TYPES = ["scatter", "bar", "surface", "heatmap"];

  function validateChart(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.traces) || !config.traces.length) throw new Error("chart 需要 traces");
    config.traces.forEach(function (trace) {
      var type = trace.type || "scatter";
      if (TRACE_TYPES.indexOf(type) === -1) throw new Error("chart 不支持 " + type);
      if (type === "bar" || type === "scatter") {
        // `null` is a legitimate gap in measured data; anything else must be finite.
        if (!h.finiteArray(trace.x) || !Array.isArray(trace.y) || trace.x.length !== trace.y.length || trace.y.some(function (v) { return v !== null && !h.finite(v); })) throw new Error("chart 的 x/y 必须为等长有限数值数组");
      } else if (!h.finiteArray(trace.x) || !h.finiteArray(trace.y) || !Array.isArray(trace.z) || trace.z.length !== trace.y.length || trace.z.some(function (row) { return !Array.isArray(row) || row.length !== trace.x.length || row.some(function (v) { return v !== null && !h.finite(v); }); })) throw new Error("chart 网格 z 的形状必须与 x/y 匹配");
    });
    return config;
  }

  /** Dependency-free fallback: axes plus a polyline or bar per trace. */
  function renderChartSvg(node, config) {
    var host = h.find(node, "[data-viz-host]"), svg = h.svgEl("svg", {viewBox: "0 0 720 360", role: "img", "aria-label": config.model});
    h.clear(host);
    host.appendChild(svg);
    if (config.traces.some(function (trace) { return trace.type === "surface" || trace.type === "heatmap"; })) {
      var note = document.createElement("p");
      note.textContent = "当前浏览器未加载三维/网格渲染器；请使用文字后备中的范围、采样网格和核对点。";
      host.appendChild(note);
      h.status(node, "网格数据已校验；交互渲染器不可用。");
      return;
    }
    var allX = [], allY = [];
    config.traces.forEach(function (t) { (t.x || []).forEach(function (v) { if (h.finite(v)) allX.push(v); }); (t.y || []).forEach(function (v) { if (h.finite(v)) allY.push(v); }); });
    var minX = Math.min.apply(Math, allX), maxX = Math.max.apply(Math, allX), minY = Math.min.apply(Math, allY), maxY = Math.max.apply(Math, allY);
    if (minX === maxX) maxX = minX + 1; if (minY === maxY) maxY = minY + 1;
    function px(x) { return 52 + (x - minX) / (maxX - minX) * 640; }
    function py(y) { return 320 - (y - minY) / (maxY - minY) * 280; }
    svg.appendChild(h.svgEl("line", {x1: 52, y1: 320, x2: 692, y2: 320, stroke: "#9aa6b5"}));
    svg.appendChild(h.svgEl("line", {x1: 52, y1: 40, x2: 52, y2: 320, stroke: "#9aa6b5"}));
    config.traces.forEach(function (trace, traceIndex) {
      var type = trace.type || "scatter", color = trace.color || ["#3157d5", "#b42318", "#157347", "#8a5a00"][traceIndex % 4];
      if (type === "bar") { trace.x.forEach(function (x, i) { if (h.finite(trace.y[i])) svg.appendChild(h.svgEl("rect", {x: px(x) - 10, y: py(trace.y[i]), width: 20, height: 320 - py(trace.y[i]), fill: color, opacity: .75})); }); return; }
      var path = "", segment = false;
      trace.x.forEach(function (x, i) { var y = trace.y[i]; if (!h.finite(x) || !h.finite(y)) { segment = false; return; } path += (segment ? " L " : " M ") + px(x).toFixed(2) + " " + py(y).toFixed(2); segment = true; });
      if (path) svg.appendChild(h.svgEl("path", {d: path, fill: "none", stroke: color, "stroke-width": 2}));
    });
    h.status(node, "静态 SVG 视图：x ∈ [" + h.fmt(minX) + ", " + h.fmt(maxX) + "]，y ∈ [" + h.fmt(minY) + ", " + h.fmt(maxY) + "]");
  }

  async function renderChart(node, config) {
    h.show(node);
    if (!root.Plotly) await h.loadVendor("plotly.js-dist-min/plotly.min.js", "Plotly");
    if (root.Plotly) {
      var host = h.find(node, "[data-viz-host]");
      await root.Plotly.newPlot(host, config.traces.map(function (t) { return Object.assign({}, t, {connectgaps: false}); }), Object.assign({margin: {t: 35, r: 25, b: 55, l: 55}, autosize: true}, config.layout || {}), {responsive: true, displaylogo: false, showSendToCloud: false});
      host.on("plotly_click", function (event) {
        var p = event.points && event.points[0];
        if (p) {
          h.status(node, "选中点：x = " + h.fmt(p.x) + (typeof p.y === "number" ? "，y = " + h.fmt(p.y) : ""));
          h.record(node, {kind: "chart", model: config.model, selected: {curve: p.curveNumber, point: p.pointNumber, x: p.x, y: p.y}});
        }
      });
    } else renderChartSvg(node, config);
    h.record(node, {kind: "chart", model: config.model});
  }

  core.registerKind("chart", {validate: validateChart, render: renderChart});
}(typeof window !== "undefined" ? window : globalThis));
