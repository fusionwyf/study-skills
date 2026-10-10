/*
 * Optional component: code block syntax highlighting via highlight.js.
 *
 * Same shape as the math renderer: a pinned CDN build supplies the engine and
 * an official theme stylesheet supplies the colours (`theme.js` picks which
 * one). This file only wires the loader — it deliberately holds no language
 * table and no colour table. highlight.js already knows which languages it
 * carries, so we ask it (`hljs.getLanguage`) instead of keeping a copy that
 * drifts.
 *
 * Wiring: load code-highlight.css in <head>, then this file and theme.js at
 * the end of <body>.
 * See README.md for the swap-in-theme recipe and the offline option.
 */
(function (root) {
  "use strict";

  var HLJS_VERSION = "11.12.0";
  var HLJS_BASE = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@" + HLJS_VERSION + "/build/";

  /*
   * Aliases highlight.js does not resolve on its own. Everything else
   * (`js`, `py`, `sh`, `yml`, `html`, `c++`, `c#`, `objc`, `toml`, …) the
   * library already understands.
   */
  var EXTRA_ALIASES = {
    node: "javascript",
    console: "shell",
    terminal: "shell",
    conf: "ini",
    cfg: "ini",
    "objective-c": "objectivec",
    python3: "python",
    /* No bundled grammar is close enough, so these degrade to plain text
       rather than silently mis-colouring source. */
    jl: "plaintext", matlab: "plaintext",
    tex: "plaintext", latex: "plaintext"
  };

  /** Read the language from the block's visible label or the code class list. */
  function languageOf(codeBlock, code) {
    var text = "";
    var label = codeBlock.querySelector(".code-language");
    if (label && label.textContent.trim()) {
      text = label.textContent;
    } else {
      var match = /(?:language|lang|highlight)[-:]([A-Za-z0-9+#]+)/.exec(code.className || "");
      if (match) text = match[1];
    }
    var key = String(text || "").trim().toLowerCase();
    return EXTRA_ALIASES[key] || key;
  }

  function highlightBlock(hljs, codeBlock) {
    var code = codeBlock.querySelector("pre code");
    if (!code || code.dataset.highlighted === "true") return;
    if (!code.textContent.trim()) return;

    var requested = languageOf(codeBlock, code);
    var known = requested && hljs.getLanguage(requested);
    var use = known ? requested : "plaintext";

    /*
     * `highlightElement` auto-detects when the element carries no language it
     * recognises, which would guess a grammar for an unknown language instead
     * of degrading. Pinning `plaintext` keeps the documented contract and also
     * stops highlight.js from stamping a stray `language-*` class on the block.
     */
    code.classList.add("language-" + use);
    hljs.highlightElement(code);

    /*
     * Called last: highlight.js appends the canonical class next to whatever it
     * found, so an aliased label ends up as `language-py language-python`. Keep
     * only the resolved class — one source of truth for the grammar in use.
     */
    Array.prototype.slice.call(code.classList).forEach(function (name) {
      if (/^language-/.test(name) && name !== "language-" + use) code.classList.remove(name);
    });
    code.dataset.highlighted = "true";
    code.dataset.language = use;
  }

  function highlightAll(hljs, scope) {
    var nodes = (scope || document).querySelectorAll(".code-block");
    Array.prototype.forEach.call(nodes, function (block) { highlightBlock(hljs, block); });
  }

  function boot(hljs) {
    highlightAll(hljs, document);
    // Expose for dynamically added blocks (a lesson that injects markup later).
    root.CourseCodeHighlight = {
      highlightAll: function (scope) { highlightAll(hljs, scope); },
      languages: function () { return hljs.listLanguages().slice(); },
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
