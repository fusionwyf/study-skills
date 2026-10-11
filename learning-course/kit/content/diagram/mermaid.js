(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var nodes = [];

  function getThemeConfig() {
    var scheme = (kit.theme && kit.theme.getScheme && kit.theme.getScheme()) || "light";
    return {
      startOnLoad: false,
      theme: scheme === "dark" ? "dark" : "default",
      themeVariables: {
        fontFamily: "var(--font-body)",
        darkMode: scheme === "dark"
      }
    };
  }

  function renderNodes() {
    if (!root.mermaid) return Promise.resolve();
    try {
      root.mermaid.initialize(getThemeConfig());
    } catch (e) {}

    var promises = nodes.map(function (item, idx) {
      var raw = item.raw;
      var block = item.block;
      var id = "mermaid-diagram-" + idx;

      return Promise.resolve().then(function () {
        return root.mermaid.render(id, raw);
      }).then(function (res) {
        block.body.innerHTML = res.svg;
        block.root.dataset.kitState = "ready";
      }).catch(function (err) {
        console.warn("[kit.diagram] Mermaid render error", err);
        block.body.innerHTML = "<pre>" + kit.util.escapeHtml(raw) + "</pre>";
        block.label.textContent = "渲染失败";
        block.root.dataset.kitState = "failed";
      });
    });

    return Promise.all(promises);
  }

  function enhanceDiagram(el) {
    if (el.closest(".kit-block")) return;
    var raw = el.textContent.trim();
    var title = el.dataset.title || "";

    var block = kit.block.create({
      kind: "diagram",
      label: "mermaid",
      title: title
    });

    var copyBtn = block.addAction("复制源码", function () {
      kit.util.copyText(raw, function () {
        copyBtn.textContent = "已复制";
        setTimeout(function () { copyBtn.textContent = "复制源码"; }, 1500);
      }, function () {
        copyBtn.textContent = "复制失败";
        setTimeout(function () { copyBtn.textContent = "复制源码"; }, 1500);
      });
    }, "复制图表源码");

    el.parentNode.insertBefore(block.root, el);
    el.style.display = "none";
    block.body.appendChild(el);

    nodes.push({ element: el, raw: raw, block: block });
  }

  function init() {
    if (typeof document === "undefined") return Promise.resolve();
    var diagramEls = document.querySelectorAll(".mermaid");
    if (!diagramEls.length) {
      return Promise.resolve();
    }

    Array.prototype.forEach.call(diagramEls, enhanceDiagram);

    kit.on("kit:themechange", function () {
      if (root.mermaid && nodes.length) {
        renderNodes();
      }
    });

    if (root.mermaid) {
      return renderNodes();
    } else if (kit.need) {
      return kit.need("mermaid").then(function () {
        return renderNodes();
      }).catch(function (err) {
        console.warn("[kit.diagram] Mermaid load failed", err);
        nodes.forEach(function (item) {
          item.block.body.innerHTML = "<pre>" + kit.util.escapeHtml(item.raw) + "</pre>";
          item.block.label.textContent = "渲染失败";
          item.block.root.dataset.kitState = "failed";
        });
        throw err;
      });
    }
    return Promise.resolve();
  }

  kit.diagram = {
    init: init,
    render: renderNodes
  };

  if (kit.registerModule) {
    kit.registerModule("content.diagram", kit.diagram);
  }
})(typeof window !== "undefined" ? window : globalThis);
