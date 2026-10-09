/*
 * Kind module: relation · timeline · process — node/event lists.
 *
 * Three kinds that share one shape: an ordered collection the learner clicks
 * to inspect. A concept graph, a chronology, and a state machine differ in
 * what they *mean*, not in how they are shown, so they share one renderer and
 * keep their own validators. No third-party library: plain HTML.
 *
 * Load after visualizations.js.
 */
(function (root) {
  "use strict";

  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;

  function validateList(config, field, kind) {
    core.validateCommon(config);
    if (!Array.isArray(config[field]) || !config[field].length) throw new Error(kind + " 需要 " + field);
    return config;
  }

  function validateRelation(config) {
    validateList(config, "nodes", "relation");
    if (config.edges && (!Array.isArray(config.edges) || config.edges.some(function (e) { return !e || !e.from || !e.to; }))) throw new Error("relation edges 需要 from/to");
    return config;
  }
  function validateTimeline(config) { return validateList(config, "events", "timeline"); }
  function validateProcess(config) {
    validateList(config, "nodes", "process");
    if (config.edges && (!Array.isArray(config.edges) || config.edges.some(function (e) { return !e || !e.from || !e.to; }))) throw new Error("process edges 需要 from/to");
    return config;
  }

  /** Render whichever list the kind carries as an inspectable ordered list. */
  function renderList(node, config, kind) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), list = document.createElement("ol");
    h.clear(host);
    list.className = "viz-list";
    var items = kind === "timeline" ? config.events : config.nodes;
    items.forEach(function (item, index) {
      var li = document.createElement("li");
      li.dataset.index = index;
      li.innerHTML = "<strong>" + h.escape(item.title || item.label || item.name || (item.id || index + 1)) + "</strong>" +
        (item.description || item.summary ? "<p>" + h.escape(item.description || item.summary) + "</p>" : "");
      li.addEventListener("click", function () {
        h.status(node, (item.title || item.label || item.name || item.id) + (item.date ? " · " + item.date : ""));
        h.record(node, {kind: kind, selected: index});
      });
      list.appendChild(li);
    });
    host.appendChild(list);
    if (config.edges && config.edges.length) {
      var edges = document.createElement("ul");
      edges.className = "viz-edges";
      config.edges.forEach(function (edge) {
        var item = document.createElement("li");
        item.textContent = String(edge.from) + " → " + String(edge.to) + (edge.label ? "：" + edge.label : "");
        edges.appendChild(item);
      });
      host.appendChild(edges);
    }
    h.status(node, "共 " + items.length + " 项；选择一项查看说明。");
    h.record(node, {kind: kind, selected: null});
  }

  core.registerKind("relation", {validate: validateRelation, render: function (node, config) { renderList(node, config, "relation"); }});
  core.registerKind("timeline", {validate: validateTimeline, render: function (node, config) { renderList(node, config, "timeline"); }});
  core.registerKind("process", {validate: validateProcess, render: function (node, config) { renderList(node, config, "process"); }});
}(typeof window !== "undefined" ? window : globalThis));
