/*
 * Optional component: code block syntax highlighting via highlight.js.
 *
 * Same shape as the math renderer: a pinned CDN build supplies the engine and a
 * stylesheet supplies the colours. highlight.js adds `hljs` classes to the code
 * element; theming is plain CSS, so a course can either swap in one of the
 * bundled highlight.js themes or restyle the token classes itself.
 *
 * This file only wires the loader. It is small on purpose: the engine is
 * fetched from the CDN, not bundled, and a course that does not highlight code
 * never pays for it.
 *
 * Wiring: load code-highlight.css in <head> and this file at the end of <body>.
 * See README.md for the swap-in-theme recipe and the offline option.
 */
(function (root) {
  "use strict";

  var HLJS_VERSION = "11.12.0";
  var HLJS_BASE = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@" + HLJS_VERSION + "/build/";

  // Languages the pinned default build already contains. A block asking for
  // anything else stays unhighlighted rather than triggering an extra request.
  var BUNDLED = ("bash c cpp csharp css diff go graphql ini java javascript json kotlin " +
    "less lua makefile markdown objectivec perl php plaintext python python-repl r ruby " +
    "rust scss shell sql swift typescript vbnet wasm xml yaml").split(" ");

  var ALIASES = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", node: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", python3: "python", ipython: "python-repl",
    rb: "ruby", sh: "bash", zsh: "bash", console: "shell", terminal: "shell",
    yml: "yaml", toml: "ini", conf: "ini", cfg: "ini",
    cs: "csharp", "c++": "cpp", "c#": "csharp",
    h: "c", hpp: "cpp",
    rs: "rust", golang: "go",
    html: "xml", xhtml: "xml", svg: "xml",
    text: "plaintext", txt: "plaintext", "": "plaintext",
    jl: "python", matlab: "python", tex: "plaintext", latex: "plaintext"
  };

  function normalize(language) {
    var key = String(language || "").trim().toLowerCase();
    return ALIASES[key] || key;
  }

  /** Read the language from the block's visible label or the code class list. */
  function languageOf(codeBlock, code) {
    var label = codeBlock.querySelector(".code-language");
    if (label && label.textContent.trim()) return normalize(label.textContent);
    var match = /(?:language|lang|highlight)[-:]([A-Za-z0-9+#]+)/.exec(code.className || "");
    return match ? normalize(match[1]) : "";
  }

  function highlightBlock(hljs, codeBlock) {
    var code = codeBlock.querySelector("pre code");
    if (!code || code.dataset.highlighted === "true") return;
    if (!code.textContent.trim()) return;
    var language = languageOf(codeBlock, code);
    // `plaintext` is always available and is also the graceful path for a
    // language this build does not carry.
    var use = BUNDLED.indexOf(language) === -1 ? "plaintext" : language;
    if (use !== "plaintext") {
      code.classList.add("language-" + use);
      code.classList.remove("language-plaintext");
    }
    hljs.highlightElement(code);
    code.dataset.highlighted = "true";
    code.dataset.language = use;
  }

  function boot(hljs) {
    var blocks = document.querySelectorAll(".code-block");
    Array.prototype.forEach.call(blocks, function (block) { highlightBlock(hljs, block); });
    // Expose for dynamically added blocks (a lesson that injects markup later).
    root.CourseCodeHighlight = {
      highlightAll: function (scope) {
        var nodes = (scope || document).querySelectorAll(".code-block");
        Array.prototype.forEach.call(nodes, function (block) { highlightBlock(hljs, block); });
      },
      version: HLJS_VERSION
    };
    root.__COURSE_CODE_HIGHLIGHT_READY__ = true;
  }

  function loadScript(src, onload, onerror) {
    var el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = onload;
    el.onerror = onerror;
    document.head.appendChild(el);
  }

  function init() {
    if (root.__COURSE_CODE_HIGHLIGHT_INIT__) return;
    root.__COURSE_CODE_HIGHLIGHT_INIT__ = true;
    // A course that self-hosts the engine (offline build) can define
    // window.hljs beforehand; then we reuse it and skip the network entirely.
    if (root.hljs && root.hljs.highlightElement) { boot(root.hljs); return; }
    loadScript(HLJS_BASE + "highlight.min.js", function () {
      if (root.hljs && root.hljs.highlightElement) boot(root.hljs);
    }, function () {
      // CDN unreachable: leave the plain, unhighlighted source text in place.
      root.__COURSE_CODE_HIGHLIGHT_READY__ = false;
    });
  }

  /*
   * Start in whichever order the page happens to give us. Trusting readyState
   * alone is fragile: a script injected after parsing, or a host where
   * DOMContentLoaded never fires, would silently do nothing. So also run as soon
   * as the document already has a body, and keep the listener as a fallback.
   */
  if (document.readyState === "loading" && !document.body) {
    document.addEventListener("DOMContentLoaded", init);
  }
  if (document.body) init();
  document.addEventListener("DOMContentLoaded", function () {
    if (!root.__COURSE_CODE_HIGHLIGHT_INIT__) init();
  });
}(typeof window !== "undefined" ? window : globalThis));
