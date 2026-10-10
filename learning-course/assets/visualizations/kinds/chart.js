/* Generic chart adapter: finite numeric/categorical data; local Plotly or SVG. */
(function (root) {
  "use strict";
  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;
  function validateChart(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.traces) || !config.traces.length)
      throw new Error("chart 需要 traces");
    config.traces.forEach(function (trace) {
      if (!trace || typeof trace !== "object")
        throw new Error("chart trace 必须是对象");
      var type = trace.type || "scatter";
      if (["scatter", "bar", "surface", "heatmap"].indexOf(type) < 0)
        throw new Error("chart 不支持 " + type);
      if (type === "bar" || type === "scatter") {
        var numeric = h.finiteArray(trace.x);
        var categories =
          Array.isArray(trace.x) &&
          trace.x.length &&
          trace.x.every(function (x) {
            return typeof x === "string" && x.trim();
          });
        if (
          !(numeric || categories) ||
          !Array.isArray(trace.y) ||
          trace.x.length !== trace.y.length ||
          !trace.y.some(h.finite) ||
          trace.y.some(function (v) {
            return v !== null && !h.finite(v);
          })
        )
          throw new Error(
            "chart x 必须同为数值或分类，y 为等长有限数值/空缺数组",
          );
      } else if (
        !h.finiteArray(trace.x) ||
        !h.finiteArray(trace.y) ||
        !Array.isArray(trace.z) ||
        trace.z.length !== trace.y.length ||
        trace.z.some(function (row) {
          return (
            !Array.isArray(row) ||
            row.length !== trace.x.length ||
            row.some(function (v) {
              return v !== null && !h.finite(v);
            })
          );
        })
      )
        throw new Error("chart 网格 z 的形状必须与 x/y 匹配");
    });
    var simple = config.traces.filter(function (t) {
      return ["surface", "heatmap"].indexOf(t.type) < 0;
    });
    if (
      simple.length &&
      simple.some(function (t) {
        return typeof t.x[0] !== typeof simple[0].x[0];
      })
    )
      throw new Error("chart 同一横轴不能混用分类与数值");
    return config;
  }
  function renderSvg(node, config) {
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    if (
      config.traces.some(function (t) {
        return t.type === "surface" || t.type === "heatmap";
      })
    ) {
      var note = document.createElement("p");
      note.textContent = "网格数据已校验；渲染器不可用，请核对静态后备。";
      host.appendChild(note);
      h.status(node, note.textContent);
      return;
    }
    var svg = h.svgEl("svg", {
      viewBox: "0 0 720 380",
      role: "img",
      "aria-label": config.model,
    });
    host.appendChild(svg);
    var categories = [],
      xs = [],
      ys = [];
    config.traces.forEach(function (t) {
      t.x.forEach(function (x) {
        if (typeof x === "string") {
          if (categories.indexOf(x) < 0) categories.push(x);
        } else xs.push(x);
      });
      t.y.forEach(function (y) {
        if (h.finite(y)) ys.push(y);
      });
    });
    if (categories.length)
      xs = categories.map(function (_, i) {
        return i;
      });
    var minX = Math.min.apply(Math, xs),
      maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys),
      maxY = Math.max.apply(Math, ys);
    if (
      config.traces.some(function (t) {
        return t.type === "bar";
      })
    ) {
      minY = Math.min(0, minY);
      maxY = Math.max(0, maxY);
    }
    if (minX === maxX) maxX = minX + 1;
    if (minY === maxY) maxY = minY + 1;
    function px(x) {
      return (
        70 +
        (((typeof x === "string" ? categories.indexOf(x) : x) - minX) /
          (maxX - minX)) *
          580
      );
    }
    function py(y) {
      return 310 - ((y - minY) / (maxY - minY)) * 270;
    }
    function text(x, y, value) {
      var el = h.svgEl("text", {
        x: x,
        y: y,
        "text-anchor": "middle",
        "font-size": 13,
      });
      el.textContent = value;
      svg.appendChild(el);
    }
    svg.appendChild(
      h.svgEl("line", { x1: 50, y1: 310, x2: 680, y2: 310, stroke: "#777" }),
    );
    svg.appendChild(
      h.svgEl("line", { x1: 50, y1: 40, x2: 50, y2: 310, stroke: "#777" }),
    );
    if (categories.length)
      categories.forEach(function (x) {
        text(px(x), 335, x);
      });
    else {
      text(70, 335, h.fmt(minX));
      text(650, 335, h.fmt(maxX));
    }
    text(28, 310, h.fmt(minY));
    text(28, 44, h.fmt(maxY));
    config.traces.forEach(function (trace, index) {
      var color = trace.color || ["#3157d5", "#b42318", "#157347"][index % 3];
      if (trace.type === "bar") {
        trace.x.forEach(function (x, i) {
          if (h.finite(trace.y[i]))
            svg.appendChild(
              h.svgEl("rect", {
                x: px(x) - 10,
                y: Math.min(py(0), py(trace.y[i])),
                width: 20,
                height: Math.abs(py(0) - py(trace.y[i])),
                fill: color,
              }),
            );
        });
        return;
      }
      var path = "",
        segment = false,
        mode = trace.mode || "lines";
      trace.x.forEach(function (x, i) {
        var y = trace.y[i];
        if (!h.finite(y)) {
          segment = false;
          return;
        }
        path +=
          (segment ? " L " : " M ") + px(x).toFixed(2) + " " + py(y).toFixed(2);
        segment = true;
        if (mode.indexOf("markers") >= 0)
          svg.appendChild(
            h.svgEl("circle", { cx: px(x), cy: py(y), r: 4, fill: color }),
          );
      });
      if (path && mode.indexOf("lines") >= 0)
        svg.appendChild(
          h.svgEl("path", {
            d: path,
            fill: "none",
            stroke: color,
            "stroke-width": 2,
          }),
        );
    });
    h.status(
      node,
      "静态 SVG 视图：" +
        (categories.length
          ? "分类 " + categories.join("、")
          : "x ∈ [" + h.fmt(minX) + ", " + h.fmt(maxX) + "]") +
        "，y ∈ [" +
        h.fmt(minY) +
        ", " +
        h.fmt(maxY) +
        "]",
    );
  }
  async function renderChart(node, config) {
    if (!root.Plotly)
      await h.loadVendor("plotly.js-dist-min/plotly.min.js", "Plotly");
    var host = h.find(node, "[data-viz-host]"),
      current = config,
      disposed = false;
    var plotting = Promise.resolve();
    function paint(next) {
      validateChart(next);
      current = next;
      h.show(node);
      if (root.Plotly) {
        plotting = plotting
          .catch(function () {})
          .then(function () {
            if (disposed) return;
            return root.Plotly.react(
              host,
              next.traces.map(function (t) {
                return Object.assign({}, t, { connectgaps: false });
              }),
              Object.assign(
                { margin: { t: 35, r: 25, b: 55, l: 55 }, autosize: true },
                next.layout || {},
              ),
              { responsive: true, displaylogo: false },
            );
          });
        h.status(node, "图表已更新，共 " + next.traces.length + " 组数据。");
      } else renderSvg(node, next);
      h.record(node, { kind: "chart", model: next.model, traces: next.traces });
      return plotting;
    }
    paint(config);
    await plotting;
    if (root.Plotly && host.on)
      host.on("plotly_click", function (event) {
        var p = event.points && event.points[0];
        if (p) {
          h.status(node, "选中点：x = " + h.fmt(p.x) + "，y = " + h.fmt(p.y));
          h.record(node, {
            kind: "chart",
            model: current.model,
            selected: {
              curve: p.curveNumber,
              point: p.pointNumber,
              x: p.x,
              y: p.y,
            },
          });
        }
      });
    return {
      update: function (el, initial, snapshot) {
        return paint(h.boundConfig(el, initial, snapshot));
      },
      destroy: function () {
        disposed = true;
        if (root.Plotly) root.Plotly.purge(host);
      },
    };
  }
  core.registerKind("chart", { validate: validateChart, render: renderChart });
})(typeof window !== "undefined" ? window : globalThis);
