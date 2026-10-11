(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function vectorImage(matrix, vector) {
    return matrix.map(function (row) { return row[0] * vector[0] + row[1] * vector[1]; });
  }

  core.vectorImage = vectorImage;

  function validateSpatial(config) {
    core.validateCommon(config);
    if (config.matrix && (!Array.isArray(config.matrix) || config.matrix.length !== 2 || config.matrix.some(function (r) { return !Array.isArray(r) || r.length !== 2 || !r.every(h.finite); }))) throw new Error("spatial matrix 必须为 2×2 有限数值");
    if (config.vector && (!Array.isArray(config.vector) || config.vector.length !== 2 || !config.vector.every(h.finite))) throw new Error("spatial vector 必须为二维有限数值");
    if (!!config.matrix !== !!config.vector) throw new Error("spatial matrix/vector 必须同时提供");
    if (config.matrix && config.vector) {
      var image = core.vectorImage(config.matrix, config.vector);
      if (!image.every(h.finite)) throw new Error("spatial matrix 与 vector 的乘积必须为有限数值");
    }
    if (!config.matrix && (!Array.isArray(config.shapes) || !config.shapes.length)) throw new Error("spatial 需要 matrix/vector 或 shapes");
    return config;
  }

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

  async function renderSpatial(node, config, context) {
    var controls = h.find(node, "[data-viz-controls]"), inputs = controls
      ? Array.prototype.slice.call(controls.querySelectorAll("input[type=number]")) : [];
    var currentVector = config.vector ? config.vector.slice() : null;
    var currentMatrix = config.matrix;
    var repaint;
    function update(nodeElement, nodeConfig, snapshot) {
      var bound = h.boundConfig(nodeElement, nodeConfig, snapshot);
      validateSpatial(bound);
      if (bound.matrix && bound.vector) {
        currentVector = bound.vector.slice(); currentMatrix = bound.matrix;
        syncInputs(currentVector); if (repaint) repaint();
      }
    }
    function readVector() {
      if (inputs.length !== 2) return currentVector;
      var next = inputs.map(function (input) {
        if (!input.value.trim()) return NaN;
        var value = Number(input.value);
        if (input.min !== "" && value < Number(input.min) || input.max !== "" && value > Number(input.max)) return NaN;
        return value;
      });
      if (!next.every(h.finite) || !core.vectorImage(currentMatrix, next).every(h.finite)) return currentVector;
      return next;
    }
    function syncInputs(vector) {
      inputs.forEach(function (input, index) { input.value = vector[index]; });
    }
    if (config.matrix && config.vector) {
      currentVector = readVector();
      syncInputs(currentVector);
      if (!root.JXG) {
        if (kit.loader && kit.loader.need) {
          await kit.loader.need("jsxgraph");
        } else {
          await h.loadVendor("jsxgraph/jsxgraphcore.js", "JXG");
        }
      }
      if (root.JXG) await h.loadStylesheet("jsxgraph/jsxgraph.css");
      if (root.JXG) {
        h.show(node);
        var host = h.find(node, "[data-viz-host]");
        var output = core.vectorImage(currentMatrix, currentVector);
        var bound = Math.max(5, Math.max.apply(Math, currentVector.map(Math.abs)), Math.max.apply(Math, output.map(Math.abs))) + 1;
        var board = root.JXG.JSXGraph.initBoard(host.id, {boundingbox: [-bound, bound, bound, -bound], axis: true, keepaspectratio: true, showCopyright: false, showNavigation: false, pan: {enabled: false}, zoom: {enabled: false}, resize: {enabled: true}});
        var point = board.create("point", currentVector, {name: "v", size: 4, color: "var(--c-accent, #3157d5)"});
        var transformed = board.create("point", [
          function () { return core.vectorImage(currentMatrix, [point.X(), point.Y()])[0]; },
          function () { return core.vectorImage(currentMatrix, [point.X(), point.Y()])[1]; }
        ], {name: "Av", fixed: true, size: 4, color: "var(--c-danger, #b42318)"});
        board.create("arrow", [[0, 0], point], {strokeColor: "var(--c-accent, #3157d5)", strokeWidth: 3});
        board.create("arrow", [[0, 0], transformed], {strokeColor: "var(--c-danger, #b42318)", strokeWidth: 3, dash: 2});
        function recordVector(vector) {
          var image = core.vectorImage(currentMatrix, vector);
          h.status(node, "v = (" + vector.map(h.fmt).join(", ") + ")；Av = (" + image.map(h.fmt).join(", ") + ")");
          h.record(node, {kind: "spatial", vector: vector, image: image});
        }
        inputs.forEach(function (input) {
          input.addEventListener("change", function () {
            var vector = readVector();
            currentVector = vector;
            syncInputs(vector);
            if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: vector.slice()});
            point.moveTo(vector, 0);
            board.update();
            recordVector(vector);
          });
        });
        point.on("drag", function () {
          currentVector = [point.X(), point.Y()];
          syncInputs(currentVector);
          if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: currentVector.slice()});
          recordVector(currentVector);
        });
        repaint = function () { point.moveTo(currentVector, 0); board.update(); recordVector(currentVector); };
        recordVector(currentVector);
        return {update: update, destroy: function () { if (board && board.remove) board.remove(); }};
      }
      function paintFallback() {
        var nextConfig = Object.assign({}, config, {matrix: currentMatrix, vector: currentVector.slice()});
        renderTransformFallback(node, nextConfig);
      }
      inputs.forEach(function (input) {
        input.addEventListener("change", function () {
          currentVector = readVector(); syncInputs(currentVector);
          if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: currentVector.slice()});
          paintFallback();
        });
      });
      repaint = paintFallback;
      paintFallback();
      return {update: update};
    } else {
      renderShapes(node, config.shapes || []);
      return {update: function (nodeElement, nodeConfig, snapshot) {
        var bound = h.boundConfig(nodeElement, nodeConfig, snapshot);
        validateSpatial(bound); renderShapes(nodeElement, bound.shapes || []);
      }};
    }
  }

  var spatialAdapter = {validate: validateSpatial, render: renderSpatial};
  core.registerKind("spatial", spatialAdapter);

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("viz.kinds.spatial");
  }
})(typeof window !== "undefined" ? window : globalThis);
