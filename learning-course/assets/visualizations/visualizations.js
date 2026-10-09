/* Optional offline course visualizations. Config is JSON data, never executable expressions. */
(function (root) {
  "use strict";

  function vectorImage(matrix, vector) {
    return matrix.map(function (row) { return row[0] * vector[0] + row[1] * vector[1]; });
  }

  function selectionSortTrace(input) {
    if (!Array.isArray(input) || input.length < 2 || input.length > 32 ||
        !input.every(Number.isFinite)) throw new Error("算法输入需为 2–32 个有限数值");
    var values = input.slice(), states = [], comparisons = 0, swaps = 0;
    function save(line, message, active, sorted) {
      states.push({values: values.slice(), line: line, message: message,
        active: active, sorted: sorted, comparisons: comparisons, swaps: swaps});
    }
    save(0, "初始数组；预测第一轮最小值。", [], 0);
    for (var i = 0; i < values.length - 1; i++) {
      var min = i;
      save(1, "令 i = " + i + "，候选最小值位置 min = " + min, [i], i);
      for (var j = i + 1; j < values.length; j++) {
        comparisons++;
        var smaller = values[j] < values[min];
        save(2, "比较 a[" + j + "] = " + values[j] + " 与 a[" + min + "] = " + values[min] +
          "；条件为 " + smaller, [j, min], i);
        if (smaller) { min = j; save(3, "更新 min = " + min, [min], i); }
      }
      if (min !== i) {
        var temp = values[i]; values[i] = values[min]; values[min] = temp; swaps++;
      }
      save(4, "本轮结束；前 " + (i + 1) + " 项已放在最终位置。", [i, min], i + 1);
    }
    save(5, "排序完成。比较 " + comparisons + " 次，交换 " + swaps + " 次。", [], values.length);
    return states;
  }

  function validateConfig(kind, config) {
    if (!config || !config.model || !config.domain || !config.precision) {
      throw new Error("需要 model、domain 和 precision，说明模型、范围与数值精度");
    }
    if (kind === "plot") {
      if (!Array.isArray(config.traces) || !config.traces.length) throw new Error("缺少 traces 数据");
      config.traces.forEach(function (trace) {
        if (!["scatter", "surface", "heatmap"].includes(trace.type)) throw new Error("仅支持 scatter、surface、heatmap");
        if (trace.type === "scatter") {
          if (!Array.isArray(trace.x) || !Array.isArray(trace.y) || trace.x.length !== trace.y.length || trace.x.length < 2 ||
              !trace.x.every(Number.isFinite) || !trace.y.every(function (v) { return v === null || Number.isFinite(v); })) {
            throw new Error("曲线 x/y 长度须一致、数值须有限；断点用 null 分段");
          }
          if (trace.connectgaps === true) throw new Error("不能跨越 null 断点连线");
        } else {
          if (!Array.isArray(trace.x) || !trace.x.length || !trace.x.every(Number.isFinite) ||
              !Array.isArray(trace.y) || !trace.y.length || !trace.y.every(Number.isFinite) ||
              !Array.isArray(trace.z) || trace.z.length !== trace.y.length ||
              !trace.z.every(function (row) { return Array.isArray(row) && row.length === trace.x.length &&
                row.every(function (v) { return v === null || Number.isFinite(v); }); })) {
            throw new Error("z 必须为行数等于 y、列数等于 x 的有限数值网格");
          }
        }
      });
    } else if (kind === "geometry") {
      if (!Array.isArray(config.matrix) || config.matrix.length !== 2 ||
          !config.matrix.every(function (row) { return Array.isArray(row) && row.length === 2 && row.every(Number.isFinite); }) ||
          !Array.isArray(config.vector) || config.vector.length !== 2 || !config.vector.every(Number.isFinite)) {
        throw new Error("几何组件需要有限数值的 2×2 matrix 和二维 vector");
      }
      if (!vectorImage(config.matrix, config.vector).every(Number.isFinite)) throw new Error("矩阵变换结果数值溢出");
    } else if (kind === "algorithm") {
      selectionSortTrace(config.input);
    } else throw new Error("未知可视化类型：" + kind);
    return config;
  }

  var api = {vectorImage: vectorImage, selectionSortTrace: selectionSortTrace, validateConfig: validateConfig};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root.document) return;
  root.CourseVisualizations = api;
  var document = root.document;

  function find(node, selector) { return node.querySelector(selector); }
  function record(node, state) { node.dataset.visualState = JSON.stringify(state); }
  function fmt(value) { return Number(value.toPrecision(8)).toString(); }

  async function plot(node, config) {
    if (!root.Plotly) throw new Error("本地 Plotly 未加载；保留模型与数值说明");
    var host = find(node, "[data-viz-host]");
    host.hidden = false;
    var traces = config.traces.map(function (t) { return Object.assign({}, t, {connectgaps: false}); });
    var layout = Object.assign({margin: {t: 35, r: 25, b: 55, l: 55}, autosize: true}, config.layout || {});
    await root.Plotly.newPlot(host, traces, layout, {responsive: true, displaylogo: false, showSendToCloud: false,
      scrollZoom: false, modeBarButtonsToRemove: ["lasso2d", "select2d"]});
    record(node, {model: config.model, view: "initial", precision: config.precision});
    var view = {};
    host.on("plotly_relayout", function (event) {
      Object.assign(view, event);
      record(node, {model: config.model, view: view, precision: config.precision});
    });
    host.on("plotly_click", function (event) {
      var p = event.points[0];
      find(node, "[data-viz-status]").textContent = "选中采样点：x = " + fmt(p.x) + ", y = " + fmt(p.y) +
        (typeof p.z === "number" ? ", z = " + fmt(p.z) : "");
    });
    // Snapshot is optional for screen viewing; text/table fallback always remains printable.
    try {
      var image = document.createElement("img");
      image.className = "viz-print-image";
      image.alt = "初始视角的数值图；模型和采样范围见文字说明";
      image.src = await root.Plotly.toImage(host, {format: "png", width: 1000, height: 650});
      node.appendChild(image);
    } catch (error) { node.dataset.snapshotStatus = "unavailable"; }
  }

  function geometry(node, config) {
    if (!root.JXG) throw new Error("本地 JSXGraph 未加载；保留变换公式与数值说明");
    var host = find(node, "[data-viz-host]");
    host.hidden = false;
    var output = vectorImage(config.matrix, config.vector);
    var bound = Math.max(5, ...config.vector.map(Math.abs), ...output.map(Math.abs)) + 1;
    // A square board and keepaspectratio keep one unit in x equal to one unit in y.
    var board = root.JXG.JSXGraph.initBoard(host.id, {boundingbox: [-bound, bound, bound, -bound],
      axis: true, keepaspectratio: true, showCopyright: false, showNavigation: false,
      pan: {enabled: false}, zoom: {enabled: false}, resize: {enabled: true},
      keyboard: {enabled: false}});
    var point = board.create("point", config.vector, {name: "v", size: 4, color: "#3157d5"});
    var transformed = board.create("point", [function () { return vectorImage(config.matrix, [point.X(), point.Y()])[0]; },
      function () { return vectorImage(config.matrix, [point.X(), point.Y()])[1]; }],
      {name: "Av", fixed: true, size: 4, color: "#b42318"});
    board.create("arrow", [[0, 0], point], {strokeColor: "#3157d5", strokeWidth: 3});
    board.create("arrow", [[0, 0], transformed], {strokeColor: "#b42318", strokeWidth: 3, dash: 2});
    var controls = find(node, "[data-viz-controls]");
    controls.hidden = false;
    var inputs = controls.querySelectorAll("input");
    function update() {
      var v = [point.X(), point.Y()], av = vectorImage(config.matrix, v);
      inputs.forEach(function (input, i) { input.value = fmt(v[i]); });
      find(node, "[data-viz-status]").textContent = "v = (" + v.map(fmt).join(", ") + ")；Av = (" + av.map(fmt).join(", ") + ")";
      record(node, {vector: v, matrix: config.matrix, image: av});
    }
    inputs.forEach(function (input, i) {
      input.addEventListener("change", function () {
        var value = input.valueAsNumber;
        if (!Number.isFinite(value) || Math.abs(value) > 1000) { update(); return; }
        var v = [point.X(), point.Y()]; v[i] = value;
        var av = vectorImage(config.matrix, v);
        if (!av.every(Number.isFinite)) { update(); return; }
        point.moveTo(v);
        var nextBound = Math.max(5, ...v.map(Math.abs), ...av.map(Math.abs)) + 1;
        board.setBoundingBox([-nextBound, nextBound, nextBound, -nextBound], true);
        board.update(); update();
      });
    });
    point.on("drag", update);
    update();
    // Available to lesson-specific checks without relying on guessed pixel coordinates.
    node.courseGeometry = {board: board, vector: point, image: transformed};
  }

  function algorithm(node, config) {
    var states = selectionSortTrace(config.input), index = 0;
    var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]");
    host.hidden = false; controls.hidden = false;
    var slider = find(controls, "input[type=range]");
    slider.max = states.length - 1;
    function render() {
      var state = states[index];
      host.replaceChildren();
      var list = document.createElement("ol"); list.className = "viz-array";
      state.values.forEach(function (value, i) {
        var item = document.createElement("li");
        item.textContent = i + ": " + value + (i < state.sorted ? " ✓" : "") + (state.active.includes(i) ? " ←" : "");
        item.className = i < state.sorted ? "is-sorted" : (state.active.includes(i) ? "is-active" : "");
        list.appendChild(item);
      });
      host.appendChild(list);
      find(node, "[data-viz-status]").textContent = "步骤 " + index + "/" + (states.length - 1) + "：" + state.message;
      node.querySelectorAll("[data-code-line]").forEach(function (line) {
        line.classList.toggle("is-current", Number(line.dataset.codeLine) === state.line);
      });
      slider.value = index;
      find(controls, "[data-viz-prev]").disabled = index === 0;
      find(controls, "[data-viz-next]").disabled = index === states.length - 1;
      record(node, {step: index, state: state, input: config.input});
    }
    find(controls, "[data-viz-prev]").addEventListener("click", function () { if (index > 0) { index--; render(); } });
    find(controls, "[data-viz-next]").addEventListener("click", function () { if (index < states.length - 1) { index++; render(); } });
    slider.addEventListener("input", function () { index = Number(slider.value); render(); });
    render();
  }

  async function init() {
    var nodes = Array.from(document.querySelectorAll("[data-visualization]"));
    await Promise.all(nodes.map(async function (node) {
      try {
        var config = validateConfig(node.dataset.visualization, JSON.parse(find(node, "[data-viz-config]").textContent));
        if (node.dataset.visualization === "plot") await plot(node, config);
        else if (node.dataset.visualization === "geometry") geometry(node, config);
        else algorithm(node, config);
        node.dataset.vizReady = "true";
      } catch (error) {
        node.dataset.vizReady = "failed";
        var host = find(node, "[data-viz-host]"); if (host) host.hidden = true;
        var controls = find(node, "[data-viz-controls]"); if (controls) controls.hidden = true;
        var status = find(node, "[data-viz-status]"); if (status) status.textContent = error.message;
      }
    }));
    root.__COURSE_VISUALIZATIONS_READY__ = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}(typeof window !== "undefined" ? window : globalThis));
