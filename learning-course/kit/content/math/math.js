(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function hasMathContent() {
    if (typeof document === "undefined") return false;
    if (document.querySelector(".formula, [data-math]")) return true;
    var text = document.body ? document.body.textContent : "";
    return /\\\(|\\\[|\$\$/.test(text);
  }

  function enhanceFormulaBlocks() {
    var formulas = document.querySelectorAll(".formula:not(.kit-block)");
    Array.prototype.forEach.call(formulas, function (el) {
      if (el.closest(".kit-block")) return;
      var raw = el.textContent.trim();
      var block = kit.block.create({
        kind: "math",
        label: "math"
      });

      var copyBtn = block.addAction("复制 LaTeX", function () {
        kit.util.copyText(raw, function () {
          copyBtn.textContent = "已复制";
          setTimeout(function () { copyBtn.textContent = "复制 LaTeX"; }, 1500);
        }, function () {
          copyBtn.textContent = "复制失败";
          setTimeout(function () { copyBtn.textContent = "复制 LaTeX"; }, 1500);
        });
      }, "复制公式源码");

      el.parentNode.insertBefore(block.root, el);
      block.body.appendChild(el);
      block.root.dataset.kitState = "ready";
    });
  }

  function renderMath() {
    if (typeof window.renderMathInElement !== "function") return;
    var opts = (kit.config && kit.config.math) || {};
    var delimiters = [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
    ];

    try {
      window.renderMathInElement(document.body, {
        delimiters: delimiters,
        macros: opts.macros || {},
        throwOnError: !!opts.throwOnError,
        errorColor: "var(--c-danger)"
      });
      enhanceFormulaBlocks();
      root.__COURSE_MATH_READY__ = true;
      if (kit.ready && kit.ready.markReady) {
        kit.ready.markReady("content.math");
      }
    } catch (e) {
      console.error("[kit.math] Render error", e);
      if (kit.ready && kit.ready.markFailed) {
        kit.ready.markFailed("content.math", e);
      }
    }
  }

  function init() {
    if (!hasMathContent()) {
      if (kit.ready && kit.ready.markReady) {
        kit.ready.markReady("content.math");
      }
      return;
    }

    if (kit.ready && kit.ready.registerPending) {
      kit.ready.registerPending("content.math");
    }

    if (typeof window.renderMathInElement === "function") {
      renderMath();
    } else if (kit.need) {
      kit.need("katex").then(function () {
        renderMath();
      }).catch(function (err) {
        console.warn("[kit.math] KaTeX not available, degrading to plain text formula", err);
        root.__COURSE_MATH_READY__ = true;
        if (kit.ready && kit.ready.markReady) {
          kit.ready.markReady("content.math");
        }
      });
    }
  }

  kit.math = {
    init: init,
    render: renderMath
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
