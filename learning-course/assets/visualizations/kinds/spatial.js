/*
 * Kind module: spatial — geometry and transform canvas (optional, needs JSXGraph).
 *
 * Draws a draggable vector and its image under a 2×2 matrix when JSXGraph is
 * present. Without it, the same content degrades to the shape list, so the
 * learner still reads the structure instead of a blank canvas.
 *
 * Load after visualizations.js. JSXGraph itself is copied by
 * `install_optional.py --components spatial`, not committed to the course.
 */
(function (root) {
  "use strict";

  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;

  function validateSpatial(config) {
    core.validateCommon(config);
    if (config.matrix && (!Array.isArray(config.matrix) || config.matrix.length !== 2 || config.matrix.some(function (r) { return !Array.isArray(r) || r.length !== 2 || !r.every(h.finite); }))) throw new Error("spatial matrix 必须为 2×2 有限数值");
    if (config.vector && (!Array.isArray(config.vector) || config.vector.length !== 2 || !config.vector.every(h.finite))) throw new Error("spatial vector 必须为二维有限数值");
    if (config.matrix && config.vector) {
      // Finite inputs can still overflow: a huge matrix would render Infinity
      // coordinates, so the projection must stay finite too.
      var image = core.vectorImage(config.matrix, config.vector);
      if (!image.every(h.finite)) throw new Error("spatial matrix 与 vector 的乘积必须为有限数值");
    }
    if (!config.matrix && (!Array.isArray(config.shapes) || !config.shapes.length)) throw new Error("spatial 需要 matrix/vector 或 shapes");
    return config;
  }

  /** Fallback that keeps the structure readable when JSXGraph is absent. */
  function renderShapes(node, shapes) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), list = document.createElement("ol");
    h.clear(host);
    list.className = "viz-list";
    shapes.forEach(function (item, index) {
      var li = document.createElement("li");
      li.dataset.index = index;
      li.innerHTML = "<strong>" + h.escape(item.title || item.label || item.name || (item.id || index + 1)) + "</strong>" +
        (item.description || item.summary ? "<p>" + h.escape(item.description || item.summary) + "</p>" : "");
      li.addEventListener("click", function () { h.status(node, item.title || item.label || item.name || item.id); });
      list.appendChild(li);
    });
    host.appendChild(list);
    h.status(node, "共 " + shapes.length + " 项；选择一项查看说明。");
    h.record(node, {kind: "spatial", selected: null});
  }

  /**
   * Fallback for a matrix/vector transform when JSXGraph is not loaded.
   *
   * The canvas cannot be drawn without the library, but the content is still
   * checkable: printing the matrix, the input and the computed image lets the
   * learner verify the arithmetic by hand. Rendering an empty list here instead
   * would leave a blank stage, which the adapter contract forbids.
   */
  function renderTransformFallback(node, config) {
    var output = core.vectorImage(config.matrix, config.vector);
    h.show(node);
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    var table = document.createElement("table");
    table.className = "viz-table";
    var rows = [
      ["A", config.matrix.map(function (row) { return "[" + row.map(h.fmt).join(", ") + "]"; }).join(" ")],
      ["v", "(" + config.vector.map(h.fmt).join(", ") + ")"],
      ["Av", "(" + output.map(h.fmt).join(", ") + ")"]
    ];
    rows.forEach(function (pair) {
      var tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td");
      th.scope = "row"; th.textContent = pair[0]; td.textContent = pair[1];
      tr.appendChild(th); tr.appendChild(td); table.appendChild(tr);
    });
    host.appendChild(table);
    h.status(node, "当前浏览器未加载几何渲染器；已列出 A、v 与 Av，可按行核对矩阵乘法。");
    h.record(node, {kind: "spatial", vector: config.vector, image: output});
  }

  async function renderSpatial(node, config) {
    var controls = h.find(node, "[data-viz-controls]"), inputs = controls
      ? Array.prototype.slice.call(controls.querySelectorAll("input[type=number]")) : [];
    var currentVector = config.vector ? config.vector.slice() : null;
    function readVector() {
      if (inputs.length !== 2) return currentVector;
      var next = inputs.map(function (input) { return Number(input.value); });
      return next.every(h.finite) ? next : currentVector;
    }
    function syncInputs(vector) {
      inputs.forEach(function (input, index) { input.value = vector[index]; });
    }
    if (config.matrix && config.vector) {
      currentVector = readVector();
      syncInputs(currentVector);
      if (!root.JXG) await h.loadVendor("jsxgraph/jsxgraphcore.js", "JXG");
      if (root.JXG) await h.loadStylesheet("jsxgraph/jsxgraph.css");
      if (root.JXG) {
        h.show(node);
        var host = h.find(node, "[data-viz-host]");
        var output = core.vectorImage(config.matrix, currentVector);
        // `Math.max` over a spread would be the only ES2015 spread in the kit;
        // the rest of the runtime is ES5-shaped, so reduce instead.
        var bound = Math.max(5, Math.max.apply(Math, currentVector.map(Math.abs)), Math.max.apply(Math, output.map(Math.abs))) + 1;
        var board = root.JXG.JSXGraph.initBoard(host.id, {boundingbox: [-bound, bound, bound, -bound], axis: true, keepaspectratio: true, showCopyright: false, showNavigation: false, pan: {enabled: false}, zoom: {enabled: false}, resize: {enabled: true}});
        var point = board.create("point", currentVector, {name: "v", size: 4, color: "#3157d5"});
        var transformed = board.create("point", [
          function () { return core.vectorImage(config.matrix, [point.X(), point.Y()])[0]; },
          function () { return core.vectorImage(config.matrix, [point.X(), point.Y()])[1]; }
        ], {name: "Av", fixed: true, size: 4, color: "#b42318"});
        board.create("arrow", [[0, 0], point], {strokeColor: "#3157d5", strokeWidth: 3});
        board.create("arrow", [[0, 0], transformed], {strokeColor: "#b42318", strokeWidth: 3, dash: 2});
        function recordVector(vector) {
          var image = core.vectorImage(config.matrix, vector);
          h.status(node, "v = (" + vector.map(h.fmt).join(", ") + ")；Av = (" + image.map(h.fmt).join(", ") + ")");
          h.record(node, {kind: "spatial", vector: vector, image: image});
        }
        inputs.forEach(function (input) {
          input.addEventListener("change", function () {
            var vector = readVector();
            currentVector = vector;
            point.moveTo(vector, 0);
            board.update();
            recordVector(vector);
          });
        });
        point.on("drag", function () {
          currentVector = [point.X(), point.Y()];
          syncInputs(currentVector);
          recordVector(currentVector);
        });
        recordVector(currentVector);
        return {destroy: function () { if (board && board.remove) board.remove(); }};
      }
      function paintFallback() {
        var nextConfig = Object.assign({}, config, {vector: currentVector.slice()});
        renderTransformFallback(node, nextConfig);
      }
      inputs.forEach(function (input) {
        input.addEventListener("change", function () { currentVector = readVector(); syncInputs(currentVector); paintFallback(); });
      });
      paintFallback();
    } else {
      renderShapes(node, config.shapes || []);
    }
  }

  core.registerKind("spatial", {validate: validateSpatial, render: renderSpatial});
}(typeof window !== "undefined" ? window : globalThis));
