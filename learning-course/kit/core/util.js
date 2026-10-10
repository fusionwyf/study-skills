(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function slugify(value) {
    if (!value) return "section";
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function plainText(node) {
    return node ? node.textContent.trim() : "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(value, caseSensitive) {
    var text = String(value == null ? "" : value).normalize("NFKC").trim();
    return caseSensitive ? text : text.toLowerCase();
  }

  function copyText(value, done, failed) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(failed);
      return;
    }
    if (typeof document === "undefined") {
      if (failed) failed();
      return;
    }
    var area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      var ok = document.execCommand("copy");
      if (ok && done) done();
      else if (!ok && failed) failed();
    } catch (error) {
      if (failed) failed();
    } finally {
      area.remove();
    }
  }

  function throttleRAF(fn) {
    var ticking = false;
    return function () {
      var args = arguments;
      var context = this;
      if (!ticking) {
        ticking = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(function () {
            ticking = false;
            fn.apply(context, args);
          });
        } else {
          setTimeout(function () {
            ticking = false;
            fn.apply(context, args);
          }, 16);
        }
      }
    };
  }

  var util = {
    slugify: slugify,
    plainText: plainText,
    escapeHtml: escapeHtml,
    norm: norm,
    copyText: copyText,
    throttleRAF: throttleRAF
  };

  kit.util = util;
})(typeof window !== "undefined" ? window : globalThis);
