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
    } catch (e) {
      console.error("[kit.math] Render error", e);
      throw e;
    }
  }

  function init() {
    if (typeof document === "undefined") return Promise.resolve();
    if (!hasMathContent()) {
      return Promise.resolve();
    }

    if (typeof window.renderMathInElement === "function") {
      try {
        renderMath();
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    } else if (kit.need) {
      return kit.need("katex").then(function () {
        renderMath();
      }).catch(function (err) {
        console.warn("[kit.math] KaTeX not available, degrading formula blocks", err);
        root.__COURSE_MATH_READY__ = true;
        document.querySelectorAll(".formula, [data-math]").forEach(function (el) {
          if (el.closest(".kit-block")) {
            el.closest(".kit-block").dataset.kitState = "degraded";
          }
        });
        if (kit.ready && kit.ready.markDegraded) {
          kit.ready.markDegraded("content.math", err);
        }
      });
    }
    return Promise.resolve();
  }

  kit.math = {
    init: init,
    render: renderMath
  };

  if (kit.registerModule) {
    kit.registerModule("content.math", kit.math);
  }
})(typeof window !== "undefined" ? window : globalThis);
