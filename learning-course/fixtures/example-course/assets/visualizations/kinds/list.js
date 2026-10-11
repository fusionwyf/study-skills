/* Relation/process render directed SVG; timeline uses dated HTML. No vendor. */
(function (root) {
  "use strict";
  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;
  function validateList(config, field, kind) {
    core.validateCommon(config);
    if (
      !Array.isArray(config[field]) ||
      !config[field].length ||
      config[field].some(function (n) {
        return !n || typeof n !== "object";
      })
    )
      throw new Error(kind + " 需要非空 " + field + " 对象数组");
    return config;
  }
  function validateGraph(config, kind) {
    validateList(config, "nodes", kind);
    if (config.edges !== undefined && !Array.isArray(config.edges))
      throw new Error(kind + " edges 必须为数组");
    var ids = config.nodes.map(function (n, i) {
      return String(
        n.id == null ? n.label || n.title || n.name || i + 1 : n.id,
      );
    });
    if (
      ids.some(function (id, i) {
        return !id.trim() || ids.indexOf(id) !== i;
      })
    )
      throw new Error(kind + " 节点 id 必须唯一且非空");
    (config.edges || []).forEach(function (e) {
      if (
        !e ||
        e.from == null ||
        e.to == null ||
        ids.indexOf(String(e.from)) < 0 ||
        ids.indexOf(String(e.to)) < 0
      )
        throw new Error(kind + " edges 需要引用现有节点的 from/to");
    });
    return config;
  }
  function name(item, index) {
    return item.title || item.label || item.name || item.id || index + 1;
  }
  function renderList(node, config, kind) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    var items = kind === "timeline" ? config.events : config.nodes;
    function select(item, index) {
      h.status(
        node,
        String(name(item, index)) +
          (item.date ? " · " + item.date : "") +
          (item.description || item.summary
            ? "：" + (item.description || item.summary)
            : ""),
      );
      h.record(node, { kind: kind, selected: index });
    }
    if (kind !== "timeline") {
      var positions = {},
        count = items.length,
        columns = Math.min(4, count),
        rows = Math.ceil(count / columns),
        width = 720,
        height = rows * 150 + 60;
      items.forEach(function (item, i) {
        positions[
          String(
            item.id == null
              ? item.label || item.title || item.name || i + 1
              : item.id,
          )
        ] = {
          x: 90 + ((i % columns) * (width - 180)) / Math.max(1, columns - 1),
          y: 60 + Math.floor(i / columns) * 150,
        };
      });
      var svg = h.svgEl("svg", {
        viewBox: "0 0 " + width + " " + height,
        role: "img",
        "aria-label": config.model,
      });
      var defs = h.svgEl("defs"),
        marker = h.svgEl("marker", {
          id: node.id + "-arrow",
          viewBox: "0 0 10 10",
          refX: 9,
          refY: 5,
          markerWidth: 7,
          markerHeight: 7,
          orient: "auto",
        });
      marker.appendChild(
        h.svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: "#65738a" }),
      );
      defs.appendChild(marker);
      svg.appendChild(defs);
      (config.edges || []).forEach(function (edge) {
        var a = positions[String(edge.from)],
          b = positions[String(edge.to)],
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / length,
          uy = dy / length;
        var inset = Math.min(
          ux ? 74 / Math.abs(ux) : Infinity,
          uy ? 29 / Math.abs(uy) : Infinity,
        );
        if (String(edge.from) === String(edge.to))
          svg.appendChild(
            h.svgEl("path", {
              d:
                "M " +
                (a.x - 25) +
                " " +
                (a.y - 25) +
                " C " +
                (a.x - 90) +
                " " +
                (a.y - 90) +
                " " +
                (a.x + 90) +
                " " +
                (a.y - 90) +
                " " +
                (a.x + 25) +
                " " +
                (a.y - 25),
              fill: "none",
              stroke: "#65738a",
              "marker-end": "url(#" + node.id + "-arrow)",
            }),
          );
        else
          svg.appendChild(
            h.svgEl("line", {
              x1: a.x + ux * inset,
              y1: a.y + uy * inset,
              x2: b.x - ux * inset,
              y2: b.y - uy * inset,
              stroke: "#65738a",
              "stroke-width": 2,
              "marker-end": "url(#" + node.id + "-arrow)",
            }),
          );
      });
      items.forEach(function (item, index) {
        var pos =
          positions[
            String(
              item.id == null
                ? item.label || item.title || item.name || index + 1
                : item.id,
            )
          ];
        var group = h.svgEl("g", {
          tabindex: 0,
          role: "button",
          "aria-label": String(name(item, index)),
        });
        group.appendChild(
          h.svgEl("rect", {
            x: pos.x - 70,
            y: pos.y - 25,
            width: 140,
            height: 50,
            rx: 8,
            fill: "#eef3ff",
            stroke: "#3157d5",
          }),
        );
        var text = h.svgEl("text", {
          x: pos.x,
          y: pos.y + 5,
          "text-anchor": "middle",
          "font-size": 14,
        });
        text.textContent = name(item, index);
        group.appendChild(text);
        group.addEventListener("click", function () {
          select(item, index);
        });
        group.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(item, index);
          }
        });
        svg.appendChild(group);
      });
      host.appendChild(svg);
    }
    var list = document.createElement("ol");
    list.className = kind === "timeline" ? "viz-list viz-timeline" : "viz-list";
    items.forEach(function (item, index) {
      var li = document.createElement("li"),
        button = document.createElement("button");
      button.type = "button";
      button.textContent = String(name(item, index));
      button.addEventListener("click", function () {
        select(item, index);
      });
      li.appendChild(button);
      if (item.date) {
        var date = document.createElement("span");
        date.className = "viz-date";
        date.textContent = String(item.date);
        li.appendChild(date);
      }
      if (item.description || item.summary) {
        var p = document.createElement("p");
        p.textContent = item.description || item.summary;
        li.appendChild(p);
      }
      list.appendChild(li);
    });
    host.appendChild(list);
    if (config.edges && config.edges.length) {
      var edges = document.createElement("ul");
      edges.className = "viz-edges";
      config.edges.forEach(function (edge) {
        var li = document.createElement("li");
        li.textContent =
          String(edge.from) +
          " → " +
          String(edge.to) +
          (edge.label ? "：" + edge.label : "");
        edges.appendChild(li);
      });
      host.appendChild(edges);
    }
    h.status(node, "共 " + items.length + " 项；选择一项查看说明。");
    h.record(node, { kind: kind, selected: null });
  }
  function adapter(kind) {
    return {
      validate: function (c) {
        return kind === "timeline"
          ? validateList(c, "events", kind)
          : validateGraph(c, kind);
      },
      render: function (n, c) {
        renderList(n, c, kind);
      },
      update: function (n, c, s) {
        var next = h.boundConfig(n, c, s);
        kind === "timeline"
          ? validateList(next, "events", kind)
          : validateGraph(next, kind);
        renderList(n, next, kind);
      },
    };
  }
  ["relation", "timeline", "process"].forEach(function (kind) {
    core.registerKind(kind, adapter(kind));
  });
})(typeof window !== "undefined" ? window : globalThis);
