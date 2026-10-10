(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var ALIASES = {
    py: "python", js: "javascript", ts: "typescript",
    sh: "bash", shell: "bash", zsh: "bash", yml: "yaml",
    md: "markdown", rb: "ruby", rs: "rust", cs: "csharp", htm: "html"
  };

  function inferLanguage(codeNode) {
    var cls = codeNode.className || "";
    var match = cls.match(/language-([a-zA-Z0-9_-]+)/);
    if (match) {
      var raw = match[1].toLowerCase();
      return ALIASES[raw] || raw;
    }
    // Check parent pre
    var pre = codeNode.parentElement;
    if (pre && pre.dataset && pre.dataset.language) {
      var lang = pre.dataset.language.toLowerCase();
      return ALIASES[lang] || lang;
    }
    return "text";
  }

  function enhanceCodeBlock(codeNode) {
    if (codeNode.closest(".kit-block")) return;
    var pre = codeNode.parentElement;
    if (!pre || pre.tagName.toLowerCase() !== "pre") return;
    if (pre.hasAttribute("data-kit-skip")) return;

    var lang = inferLanguage(codeNode);
    var title = pre.dataset.title || "";
    var wrap = pre.hasAttribute("data-wrap");
    var fold = pre.hasAttribute("data-fold");

    var block = kit.block.create({
      kind: "code",
      label: lang !== "text" ? lang : "",
      title: title
    });

    if (wrap) pre.classList.add("has-wrap");

    var copyBtn = block.addAction("复制", function () {
      var text = codeNode.textContent;
      kit.util.copyText(text, function () {
        copyBtn.textContent = "已复制";
        setTimeout(function () { copyBtn.textContent = "复制"; }, 1500);
      }, function () {
        copyBtn.textContent = "复制失败";
        setTimeout(function () { copyBtn.textContent = "复制"; }, 1500);
      });
    }, "复制代码");

    if (fold) {
      block.root.classList.add("is-folded");
      var foldBtn = block.addAction("展开", function () {
        var isFolded = block.root.classList.toggle("is-folded");
        foldBtn.textContent = isFolded ? "展开" : "折叠";
      }, "展开或折叠代码");
    }

    pre.parentNode.insertBefore(block.root, pre);
    block.body.appendChild(pre);

    // Syntax highlight
    if (lang !== "text" && root.hljs) {
      try {
        root.hljs.highlightElement(codeNode);
      } catch (e) {}
      block.root.dataset.kitState = "ready";
    } else if (lang !== "text" && kit.need) {
      kit.need("hljs").then(function () {
        if (root.hljs) {
          try {
            root.hljs.highlightElement(codeNode);
          } catch (e) {}
        }
        block.root.dataset.kitState = "ready";
      }).catch(function () {
        block.root.dataset.kitState = "failed";
      });
    } else {
      block.root.dataset.kitState = "ready";
    }
  }

  // Legacy .code-block support
  function enhanceLegacyCodeBlocks() {
    var legacyBlocks = document.querySelectorAll(".code-block:not(.kit-block)");
    Array.prototype.forEach.call(legacyBlocks, function (el) {
      var code = el.querySelector("code");
      if (code) enhanceCodeBlock(code);
    });
  }

  function init() {
    if (typeof document === "undefined") return;
    if (kit.ready && kit.ready.registerPending) {
      kit.ready.registerPending("content.code");
    }

    var codeNodes = document.querySelectorAll("pre > code");
    Array.prototype.forEach.call(codeNodes, enhanceCodeBlock);
    enhanceLegacyCodeBlocks();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("content.code");
    }
  }

  kit.code = {
    init: init,
    enhance: enhanceCodeBlock
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
