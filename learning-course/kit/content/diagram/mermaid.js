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
    if (!root.mermaid) return;
    try {
      root.mermaid.initialize(getThemeConfig());
    } catch (e) {}

    nodes.forEach(function (item, idx) {
      var el = item.element;
      var raw = item.raw;
      var block = item.block;
      var id = "mermaid-diagram-" + idx;

      try {
        root.mermaid.render(id, raw).then(function (res) {
          block.body.innerHTML = res.svg;
          block.root.dataset.kitState = "ready";
        }).catch(function (err) {
          console.warn("[kit.diagram] Mermaid render error", err);
          block.body.innerHTML = "<pre>" + kit.util.escapeHtml(raw) + "</pre>";
          block.label.textContent = "渲染失败";
          block.root.dataset.kitState = "failed";
        });
      } catch (err) {
        console.warn("[kit.diagram] Mermaid render exception", err);
        block.body.innerHTML = "<pre>" + kit.util.escapeHtml(raw) + "</pre>";
        block.label.textContent = "渲染失败";
        block.root.dataset.kitState = "failed";
      }
    });
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
    if (typeof document === "undefined") return;
    var diagramEls = document.querySelectorAll(".mermaid");
    if (!diagramEls.length) {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.diagram");
      return;
    }

    if (kit.ready && kit.ready.registerPending) {
      kit.ready.registerPending("content.diagram");
    }

    Array.prototype.forEach.call(diagramEls, enhanceDiagram);

    if (root.mermaid) {
      renderNodes();
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.diagram");
    } else if (kit.need) {
      kit.need("mermaid").then(function () {
        renderNodes();
        if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.diagram");
      }).catch(function (err) {
        console.warn("[kit.diagram] Mermaid load failed", err);
        if (kit.ready && kit.ready.markFailed) kit.ready.markFailed("content.diagram", err);
      });
    }

    kit.on("kit:themechange", function () {
      if (root.mermaid && nodes.length) {
        renderNodes();
      }
    });
  }

  kit.diagram = {
    init: init,
    render: renderNodes
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
