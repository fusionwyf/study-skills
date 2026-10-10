import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

function preferredTheme() {
  var surface = document.documentElement.getAttribute("data-theme-surface");
  if (surface === "light") return "default";
  if (surface === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}

var theme = window.COURSE_MERMAID_THEME || preferredTheme();
mermaid.initialize({
  startOnLoad: false,
  theme: theme,
  securityLevel: "strict",
  fontFamily: '"Microsoft YaHei","PingFang SC",system-ui,sans-serif'
});

var containers = document.querySelectorAll(".mermaid");
if (containers.length) {
  mermaid.run({ querySelector: ".mermaid" }).then(function () {
    window.__COURSE_MERMAID_READY__ = true;
  }).catch(function () {
    window.__COURSE_MERMAID_READY__ = false;
  });
} else {
  window.__COURSE_MERMAID_READY__ = true;
}
