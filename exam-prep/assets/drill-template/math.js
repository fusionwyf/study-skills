/* Optional local KaTeX bridge. No network request is made here. */
(function () {
  "use strict";

  function renderMath() {
    if (!window.katex) return false;
    document.querySelectorAll("[data-tex]").forEach(function (node) {
      if (node.dataset.mathRendered === "true") return;
      try {
        window.katex.render(node.dataset.tex || "", node, {
          displayMode: node.dataset.displayMode !== "inline",
          throwOnError: false,
          strict: "ignore"
        });
        node.dataset.mathRendered = "true";
      } catch (error) {
        node.setAttribute("data-math-error", "true");
      }
    });
    window.__EXAM_PREP_MATH_READY__ = true;
    return true;
  }

  window.renderExamPrepMath = renderMath;

  if (!renderMath()) {
    document.addEventListener("katex:ready", renderMath, { once: true });
    window.setTimeout(renderMath, 250);
  }
}());
