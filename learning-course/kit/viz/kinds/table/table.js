(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function validateTable(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.columns) || !Array.isArray(config.rows)) throw new Error("table 需要 columns 与 rows");
    return config;
  }

  function renderTable(node, config) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), table = document.createElement("table");
    h.clear(host);
    table.className = "viz-table";
    var head = document.createElement("tr");
    config.columns.forEach(function (column) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = column.label || column.name || column;
      head.appendChild(th);
    });
    table.appendChild(head);
    config.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      config.columns.forEach(function (column) {
        var td = document.createElement("td"), key = column.key || column;
        td.textContent = row[key] == null ? "" : row[key];
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    host.appendChild(table);
    h.status(node, "表格 " + config.rows.length + " 行");
    h.record(node, {kind: "table", rows: config.rows.length});
  }

  core.registerKind("table", {validate: validateTable, render: renderTable, update: function (node, config, snapshot) {
    var next = h.boundConfig(node, config, snapshot); validateTable(next); renderTable(node, next);
  }});

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("viz.kinds.table");
  }
})(typeof window !== "undefined" ? window : globalThis);
