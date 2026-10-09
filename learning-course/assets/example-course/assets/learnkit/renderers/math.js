/* LearnKit renderer: math (text -> KaTeX HTML). No network request is made here.
 *
 * Two entry points share one implementation:
 *   1. LearnKit.registerRenderer("math", ...) — driven by data-lk-render="math",
 *      consistent with the other renderers and able to read the current state.
 *   2. Automatic scan of [data-tex] — keeps lessons written against the earlier
 *      standalone math.js working without any markup change.
 *
 * When window.katex is absent the element keeps its readable fallback text, so
 * the page stays understandable with no script, no KaTeX, or a render error.
 */
(function (root) {
  "use strict";

  var document = root.document;
  if (!document) return;

  function renderNode(node) {
    if (!root.katex) return false;
    if (node.dataset.mathRendered === "true") return true;
    try {
      root.katex.render(node.dataset.tex || "", node, {
        displayMode: node.dataset.displayMode !== "inline",
        throwOnError: false,
        strict: "ignore"
      });
      node.dataset.mathRendered = "true";
      return true;
    } catch (error) {
      node.setAttribute("data-math-error", "true");
      return false;
    }
  }

  function renderAll(scope) {
    if (!root.katex) return false;
    var nodes = (scope || document).querySelectorAll("[data-tex]");
    var rendered = false;
    Array.prototype.forEach.call(nodes, function (node) {
      if (renderNode(node)) rendered = true;
    });
    if (rendered) root.__COURSE_MATH_READY__ = true;
    return rendered;
  }

  // LearnKit renderer contract: render(el, state, derived).
  // Renders the element itself if it carries data-tex, then its subtree.
  function mathRenderer(el) {
    if (el.dataset && el.dataset.tex !== undefined) renderNode(el);
    renderAll(el);
  }

  function register() {
    if (root.LearnKit && typeof root.LearnKit.registerRenderer === "function") {
      root.LearnKit.registerRenderer("math", mathRenderer);
      root.LearnKit.registerRenderer("math-inline", mathRenderer);
    }
  }

  function boot() {
    register();
    if (!renderAll(document)) {
      // KaTeX may load after this script; retry once it announces readiness.
      document.addEventListener("katex:ready", function () { renderAll(document); }, { once: true });
      root.setTimeout(function () { renderAll(document); }, 250);
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { renderAll: renderAll, renderNode: renderNode, mathRenderer: mathRenderer };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}(typeof window !== "undefined" ? window : globalThis));
