/* LearnKit visual adapters (L3). JSON configs describe data; adapters never eval code. */
(function (root) {
  "use strict";

  var adapters = {};
  var document = root.document;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function finiteArray(values) { return Array.isArray(values) && values.length > 0 && values.every(finite); }
  function find(node, selector) { return node.querySelector(selector); }
  function fmt(value) { return finite(value) ? Number(value.toPrecision(8)).toString() : String(value); }
  function escape(value) { return String(value).replace(/[&<>\"]/g, function (ch) { return {"&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;"}[ch]; }); }
  function record(node, state) { node.dataset.visualState = JSON.stringify(state); }
  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function vectorImage(matrix, vector) {
    return matrix.map(function (row) { return row[0] * vector[0] + row[1] * vector[1]; });
  }

  function selectionSortTrace(input) {
    if (!Array.isArray(input) || input.length < 2 || input.length > 32 || !input.every(finite)) throw new Error("序列输入需为 2–32 个有限数值");
    var values = input.slice(), states = [], comparisons = 0, swaps = 0;
    function save(line, message, active, sorted) { states.push({values: values.slice(), line: line, message: message, active: active, sorted: sorted, comparisons: comparisons, swaps: swaps}); }
    save(0, "初始序列；先预测第一轮会确定哪个位置。", [], 0);
    for (var i = 0; i < values.length - 1; i++) {
      var min = i;
      save(1, "设定当前位置 i = " + i + "，候选位置 min = " + min, [i], i);
      for (var j = i + 1; j < values.length; j++) {
        comparisons++;
        var smaller = values[j] < values[min];
        save(2, "比较位置 " + j + " 与候选位置 " + min + "；结果为 " + smaller, [j, min], i);
        if (smaller) { min = j; save(3, "候选位置更新为 " + min, [min], i); }
      }
      if (min !== i) { var temp = values[i]; values[i] = values[min]; values[min] = temp; swaps++; }
      save(4, "本轮结束；前 " + (i + 1) + " 个元素已就位。", [i, min], i + 1);
    }
    save(5, "完成。比较 " + comparisons + " 次，交换 " + swaps + " 次。", [], values.length);
    return states;
  }

  function validateCommon(config) {
    if (!config || typeof config !== "object") throw new Error("可视化配置必须是对象");
    ["model", "domain", "precision"].forEach(function (key) {
      if (typeof config[key] !== "string" || !config[key].trim()) throw new Error("配置需要非空 " + key + " 说明");
    });
    return config;
  }
  function validateChart(config) {
    validateCommon(config);
    if (!Array.isArray(config.traces) || !config.traces.length) throw new Error("chart 需要 traces");
    config.traces.forEach(function (trace) {
      var type = trace.type || "scatter";
      if (!["scatter", "bar", "surface", "heatmap"].includes(type)) throw new Error("chart 不支持 " + type);
      if (type === "bar" || type === "scatter") {
        if (!finiteArray(trace.x) || !Array.isArray(trace.y) || trace.x.length !== trace.y.length || trace.y.some(function (v) { return v !== null && !finite(v); })) throw new Error("chart 的 x/y 必须为等长有限数值数组");
      } else if (!finiteArray(trace.x) || !finiteArray(trace.y) || !Array.isArray(trace.z) || trace.z.length !== trace.y.length || trace.z.some(function (row) { return !Array.isArray(row) || row.length !== trace.x.length || row.some(function (v) { return v !== null && !finite(v); }); })) throw new Error("chart 网格 z 的形状必须与 x/y 匹配");
    });
    return config;
  }
  function validateRelation(config) {
    validateCommon(config);
    if (!Array.isArray(config.nodes) || !config.nodes.length) throw new Error("relation 需要 nodes");
    if (config.edges && (!Array.isArray(config.edges) || config.edges.some(function (e) { return !e || !e.from || !e.to; }))) throw new Error("relation edges 需要 from/to");
    return config;
  }
  function validateTimeline(config) { validateCommon(config); if (!Array.isArray(config.events) || !config.events.length) throw new Error("timeline 需要 events"); return config; }
  function validateProcess(config) { validateCommon(config); if (!Array.isArray(config.nodes) || !config.nodes.length) throw new Error("process 需要 nodes"); return config; }
  function validateSpatial(config) {
    validateCommon(config);
    if (config.matrix && (!Array.isArray(config.matrix) || config.matrix.length !== 2 || config.matrix.some(function (r) { return !Array.isArray(r) || r.length !== 2 || !r.every(finite); }))) throw new Error("spatial matrix 必须为 2×2 有限数值");
    if (config.vector && (!Array.isArray(config.vector) || config.vector.length !== 2 || !config.vector.every(finite))) throw new Error("spatial vector 必须为二维有限数值");
    if (config.matrix && config.vector) {
      // Finite inputs can still overflow: a huge matrix would render Infinity
      // coordinates, so the projection must stay finite too.
      var image = vectorImage(config.matrix, config.vector);
      if (!image.every(finite)) throw new Error("spatial matrix 与 vector 的乘积必须为有限数值");
    }
    if (!config.matrix && (!Array.isArray(config.shapes) || !config.shapes.length)) throw new Error("spatial 需要 matrix/vector 或 shapes");
    return config;
  }
  function validateSequence(config) {
    validateCommon(config);
    if (!Array.isArray(config.steps) && !Array.isArray(config.input)) throw new Error("sequence 需要 steps 或 input");
    if (config.input) selectionSortTrace(config.input);
    if (config.steps && (!config.steps.length || config.steps.some(function (step) { return !step || typeof step !== "object" || !(step.title || step.summary || step.message); }))) throw new Error("sequence 每个 step 需要 title、summary 或 message");
    return config;
  }
  function validateTable(config) { validateCommon(config); if (!Array.isArray(config.columns) || !Array.isArray(config.rows)) throw new Error("table 需要 columns 与 rows"); return config; }
  function registerKind(name, adapter) {
    if (!name || !adapter || typeof adapter.validate !== "function" || typeof adapter.render !== "function") throw new Error("registerKind 需要 validate 和 render");
    adapters[name] = adapter;
  }
  function validateConfig(kind, config) {
    var adapter = adapters[kind];
    if (!adapter) throw new Error("未知可视化类型：" + kind);
    return adapter.validate(config);
  }
  function status(node, text) { var target = find(node, "[data-viz-status]"); if (target) target.textContent = text; }
  function show(node) { var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"); if (host) host.hidden = false; if (controls) controls.hidden = false; }

  function renderChartSvg(node, config) {
    var host = find(node, "[data-viz-host]"), svg = svgEl("svg", {viewBox: "0 0 720 360", role: "img", "aria-label": config.model});
    clear(host); host.appendChild(svg);
    if (config.traces.some(function (trace) { return ["surface", "heatmap"].includes(trace.type); })) {
      var note = document.createElement("p");
      note.textContent = "当前浏览器未加载三维/网格渲染器；请使用文字后备中的范围、采样网格和核对点。";
      host.appendChild(note);
      status(node, "网格数据已校验；交互渲染器不可用。");
      return;
    }
    var allX = [], allY = [];
    config.traces.forEach(function (t) { (t.x || []).forEach(function (v) { if (finite(v)) allX.push(v); }); (t.y || []).forEach(function (v) { if (finite(v)) allY.push(v); }); });
    var minX = Math.min.apply(Math, allX), maxX = Math.max.apply(Math, allX), minY = Math.min.apply(Math, allY), maxY = Math.max.apply(Math, allY);
    if (minX === maxX) maxX = minX + 1; if (minY === maxY) maxY = minY + 1;
    function px(x) { return 52 + (x - minX) / (maxX - minX) * 640; }
    function py(y) { return 320 - (y - minY) / (maxY - minY) * 280; }
    svg.appendChild(svgEl("line", {x1: 52, y1: 320, x2: 692, y2: 320, stroke: "#9aa6b5"}));
    svg.appendChild(svgEl("line", {x1: 52, y1: 40, x2: 52, y2: 320, stroke: "#9aa6b5"}));
    config.traces.forEach(function (trace, traceIndex) {
      var type = trace.type || "scatter", color = trace.color || ["#3157d5", "#b42318", "#157347", "#8a5a00"][traceIndex % 4];
      if (type === "bar") { trace.x.forEach(function (x, i) { if (finite(trace.y[i])) svg.appendChild(svgEl("rect", {x: px(x) - 10, y: py(trace.y[i]), width: 20, height: 320 - py(trace.y[i]), fill: color, opacity: .75})); }); return; }
      var path = "", segment = false;
      trace.x.forEach(function (x, i) { var y = trace.y[i]; if (!finite(x) || !finite(y)) { segment = false; return; } path += (segment ? " L " : " M ") + px(x).toFixed(2) + " " + py(y).toFixed(2); segment = true; });
      if (path) svg.appendChild(svgEl("path", {d: path, fill: "none", stroke: color, "stroke-width": 2}));
    });
    status(node, "静态 SVG 视图：x ∈ [" + fmt(minX) + ", " + fmt(maxX) + "]，y ∈ [" + fmt(minY) + ", " + fmt(maxY) + "]");
  }
  async function renderChart(node, config) {
    show(node);
    if (root.Plotly) {
      var host = find(node, "[data-viz-host]");
      await root.Plotly.newPlot(host, config.traces.map(function (t) { return Object.assign({}, t, {connectgaps: false}); }), Object.assign({margin: {t: 35, r: 25, b: 55, l: 55}, autosize: true}, config.layout || {}), {responsive: true, displaylogo: false, showSendToCloud: false});
      host.on("plotly_click", function (event) { var p = event.points && event.points[0]; if (p) status(node, "选中点：x = " + fmt(p.x) + (typeof p.y === "number" ? "，y = " + fmt(p.y) : "")); });
    } else renderChartSvg(node, config);
    record(node, {kind: "chart", model: config.model});
  }
  function renderList(node, config, kind) {
    show(node); var host = find(node, "[data-viz-host]"), list = document.createElement("ol"); clear(host); list.className = "viz-list";
    var items = kind === "timeline" ? config.events : config.nodes;
    items.forEach(function (item, index) { var li = document.createElement("li"); li.dataset.index = index; li.innerHTML = "<strong>" + escape(item.title || item.label || item.name || (item.id || index + 1)) + "</strong>" + (item.description || item.summary ? "<p>" + escape(item.description || item.summary) + "</p>" : ""); li.addEventListener("click", function () { status(node, (item.title || item.label || item.name || item.id) + (item.date ? " · " + item.date : "")); }); list.appendChild(li); }); host.appendChild(list); status(node, "共 " + items.length + " 项；选择一项查看说明。"); record(node, {kind: kind, selected: null});
  }
  function renderTable(node, config) {
    show(node); var host = find(node, "[data-viz-host]"), table = document.createElement("table"); clear(host); table.className = "viz-table";
    var head = document.createElement("tr"); config.columns.forEach(function (column) { var th = document.createElement("th"); th.scope = "col"; th.textContent = column.label || column.name || column; head.appendChild(th); }); table.appendChild(head);
    config.rows.forEach(function (row) { var tr = document.createElement("tr"); config.columns.forEach(function (column) { var td = document.createElement("td"), key = column.key || column; td.textContent = row[key] == null ? "" : row[key]; tr.appendChild(td); }); table.appendChild(tr); }); host.appendChild(table); status(node, "表格 " + config.rows.length + " 行"); record(node, {kind: "table", rows: config.rows.length});
  }
  function renderSpatial(node, config) {
    show(node);
    if (config.matrix && config.vector && root.JXG) {
      var host = find(node, "[data-viz-host]"), output = vectorImage(config.matrix, config.vector), bound = Math.max(5, ...config.vector.map(Math.abs), ...output.map(Math.abs)) + 1;
      var board = root.JXG.JSXGraph.initBoard(host.id, {boundingbox: [-bound, bound, bound, -bound], axis: true, keepaspectratio: true, showCopyright: false, showNavigation: false, pan: {enabled: false}, zoom: {enabled: false}, resize: {enabled: true}});
      var point = board.create("point", config.vector, {name: "v", size: 4, color: "#3157d5"});
      var transformed = board.create("point", [function () { return vectorImage(config.matrix, [point.X(), point.Y()])[0]; }, function () { return vectorImage(config.matrix, [point.X(), point.Y()])[1]; }], {name: "Av", fixed: true, size: 4, color: "#b42318"});
      board.create("arrow", [[0, 0], point], {strokeColor: "#3157d5", strokeWidth: 3}); board.create("arrow", [[0, 0], transformed], {strokeColor: "#b42318", strokeWidth: 3, dash: 2});
      status(node, "v = (" + config.vector.map(fmt).join(", ") + ")；Av = (" + output.map(fmt).join(", ") + ")"); record(node, {kind: "spatial", vector: config.vector, image: output});
    } else renderList(node, {nodes: config.shapes || []}, "spatial");
  }
  function renderSequence(node, config) {
    var states = config.steps || selectionSortTrace(config.input), index = 0; show(node); var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"), slider = controls && controls.querySelector("input[type=range]");
    if (slider) slider.max = states.length - 1;
    function paint() { var state = states[index]; clear(host); var title = document.createElement("h3"); title.textContent = state.title || state.summary || state.message || ("步骤 " + (index + 1)); host.appendChild(title); if (state.values) { var list = document.createElement("ol"); list.className = "viz-array"; state.values.forEach(function (v, i) { var li = document.createElement("li"); li.textContent = i + ": " + v; if (state.active && state.active.includes(i)) li.className = "is-active"; if (state.sorted != null && i < state.sorted) li.classList.add("is-sorted"); list.appendChild(li); }); host.appendChild(list); } if (state.description || state.message) { var p = document.createElement("p"); p.textContent = state.description || state.message; host.appendChild(p); } status(node, "步骤 " + (index + 1) + "/" + states.length); if (slider) slider.value = index; if (controls) { var prev = controls.querySelector("[data-viz-prev]"), next = controls.querySelector("[data-viz-next]"); if (prev) prev.disabled = index === 0; if (next) next.disabled = index === states.length - 1; } record(node, {kind: "sequence", step: index, total: states.length}); }
    if (controls) { var prev = controls.querySelector("[data-viz-prev]"), next = controls.querySelector("[data-viz-next]"); if (prev) prev.addEventListener("click", function () { if (index) { index--; paint(); } }); if (next) next.addEventListener("click", function () { if (index < states.length - 1) { index++; paint(); } }); if (slider) slider.addEventListener("input", function () { index = Number(slider.value); paint(); }); }
    paint();
  }

  registerKind("chart", {validate: validateChart, render: renderChart});
  registerKind("relation", {validate: validateRelation, render: function (node, config) { renderList(node, config, "relation"); }});
  registerKind("timeline", {validate: validateTimeline, render: function (node, config) { renderList(node, config, "timeline"); }});
  registerKind("process", {validate: validateProcess, render: function (node, config) { renderList(node, config, "process"); }});
  registerKind("spatial", {validate: validateSpatial, render: renderSpatial});
  registerKind("sequence", {validate: validateSequence, render: renderSequence});
  registerKind("table", {validate: validateTable, render: renderTable});

  var api = {vectorImage: vectorImage, selectionSortTrace: selectionSortTrace, validateConfig: validateConfig, registerKind: registerKind, adapters: adapters};
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
        await adapters[kind].render(node, config);
        node.dataset.vizReady = "true";
      } catch (error) {
        node.dataset.vizReady = "failed";
        var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"); if (host) host.hidden = true; if (controls) controls.hidden = true;
        status(node, error.message);
      }
    }));
    root.__COURSE_VISUALIZATIONS_READY__ = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}(typeof window !== "undefined" ? window : globalThis));
