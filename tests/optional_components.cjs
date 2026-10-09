/*
 * Behavioural checks for the optional components, run against a real DOM.
 *
 * These verify the contracts a course depends on:
 *   - code-highlight colours blocks and preserves the exact source text
 *   - an unknown language degrades to plaintext instead of failing
 *   - theme applies, persists, resolves `auto`, and honours a declared surface
 *   - a course with neither component installed is unaffected
 *
 * Run with: node tests/optional_components.cjs
 * Requires jsdom (in the managed node workspace) and uses a locally cached copy
 * of the pinned highlight.js build so no network access is needed.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const WORKSPACE = "C:/Users/wy/.workbuddy/binaries/node/workspace/node_modules";

/** Locate jsdom: managed workspace first, then a plain resolve for portability. */
function loadJsdom() {
  try {
    return require(path.join(WORKSPACE, "jsdom"));
  } catch (error) {
    return require("jsdom");
  }
}
const { JSDOM } = loadJsdom();

const ROOT = path.resolve(__dirname, "..");
const HL_SRC = path.join(ROOT, "learning-course/assets/optional/code-highlight/code-highlight.js");
const THEME_SRC = path.join(ROOT, "learning-course/assets/optional/theme/theme.js");

/*
 * The highlight.js engine is a 126 KB vendor artifact and is never committed.
 * It is supplied as a file path in HLJS_ENGINE_PATH (the Python driver fetches
 * it into tests/.cache/ when needed), or CACHE_DIR is checked directly so the
 * harness also runs standalone once the cache is warm.
 */
const CACHE_DIR = path.join(__dirname, ".cache");
const ENGINE_PATH = process.env.HLJS_ENGINE_PATH || path.join(CACHE_DIR, "hljs-11.12.0.min.js");
const ENGINE_URL = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js";

function engine() {
  if (fs.existsSync(ENGINE_PATH)) return require(ENGINE_PATH);
  // Do not fetch from here: a sandboxed node may refuse to spawn a helper, and
  // an async download cannot be awaited before the synchronous checks below.
  // The Python driver owns this step; running standalone needs a warm cache.
  throw new Error(
    `highlight.js engine not found at ${ENGINE_PATH}. ` +
    `Run via \`python -m unittest tests.test_visualizations\` (which fetches it), ` +
    `or save ${ENGINE_URL} to ${ENGINE_PATH} once.`
  );
}

const ENGINE = engine();

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? " :: " + detail : ""}`);
  }
}

function lessonDom(codeHtml, language, htmlAttrs) {
  const html = `<!doctype html><html lang="zh-CN"${htmlAttrs || ""}><body>
    <main class="lesson">
      <div class="code-block"><span class="code-language">${language}</span><pre><code>${codeHtml}</code></pre></div>
    </main></body></html>`;
  return new JSDOM(html, { url: "https://example.test/lessons/0001.html", runScripts: "outside-only" });
}

/** Execute a component in a parsed DOM, reusing the cached engine. */
function mount(dom, file, seedEngine) {
  if (seedEngine) dom.window.hljs = ENGINE;
  dom.window.eval(fs.readFileSync(file, "utf8"));
  return dom;
}

function escapeCode(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function main() {
  console.log("== code-highlight ==");

  // 1. Python should get keyword/comment/string tokens with the text intact.
  const pySource = "def check(value):\n    # 非负检查\n    return value >= 0";
  let dom = mount(lessonDom(escapeCode(pySource), "python"), HL_SRC, true);
  let code = dom.window.document.querySelector(".code-block pre code");
  check("python block is marked highlighted", code.dataset.highlighted === "true");
  check("keyword token emitted", code.querySelector(".hljs-keyword") !== null);
  check("comment token emitted", code.querySelector(".hljs-comment") !== null);
  check("source text preserved exactly", code.textContent === pySource, JSON.stringify(code.textContent));

  // 2. Aliases resolve to a bundled language.
  dom = mount(lessonDom("print(1)", "py"), HL_SRC, true);
  code = dom.window.document.querySelector("pre code");
  check("alias py resolves to python", code.dataset.language === "python", code.dataset.language);

  // 3. A language outside the pinned build degrades to plaintext, not an error.
  dom = mount(lessonDom("defmodule A do end", "elixir"), HL_SRC, true);
  code = dom.window.document.querySelector("pre code");
  check("unknown language degrades to plaintext", code.dataset.language === "plaintext", code.dataset.language);
  check("unknown language keeps source text", code.textContent === "defmodule A do end");

  // 4. Language can come from the code element's class list instead of a label.
  dom = lessonDom("int main(void) {}", "");
  dom.window.document.querySelector("pre code").className = "language-c";
  mount(dom, HL_SRC, true);
  check("class-based language detected", dom.window.document.querySelector("pre code").dataset.language === "c");

  // 5. An empty block is skipped rather than reported as highlighted.
  dom = mount(lessonDom("   ", "python"), HL_SRC, true);
  check("empty block skipped", dom.window.document.querySelector("pre code").dataset.highlighted === undefined);

  // 6. Public API for content inserted after load.
  dom = mount(lessonDom("x = 1", "python"), HL_SRC, true);
  check("exposes CourseCodeHighlight.highlightAll", typeof dom.window.CourseCodeHighlight.highlightAll === "function");
  check("sets the readiness flag", dom.window.__COURSE_CODE_HIGHLIGHT_READY__ === true);

  // 7. Re-running must not double-wrap the markup.
  const before = dom.window.document.querySelector("pre code").innerHTML;
  dom.window.CourseCodeHighlight.highlightAll();
  check("re-highlight is idempotent", dom.window.document.querySelector("pre code").innerHTML === before);

  console.log("\n== theme ==");

  // 8. A declared theme and surface survive when no themes are registered
  //    (the documented CSS-only route).
  let tdom = mount(new JSDOM(
    '<!doctype html><html data-theme="warm" data-theme-surface="light"><body><div data-theme-switch></div></body></html>',
    { url: "https://example.test/", runScripts: "outside-only" }), THEME_SRC, false);
  check("explicit data-theme honoured", tdom.window.document.documentElement.dataset.theme === "warm");
  check("declared surface preserved", tdom.window.document.documentElement.dataset.themeSurface === "light");
  check("no switcher without registered themes", tdom.window.document.querySelector(".theme-switch") === null);

  // 9. Registered themes produce a labelled switcher with a follow-system option.
  tdom = new JSDOM('<!doctype html><html><body><div data-theme-switch></div></body></html>',
    { url: "https://example.test/", runScripts: "outside-only" });
  tdom.window.eval(`window.COURSE_THEMES = [
    {name: "scholar", label: "学术", surface: "light"},
    {name: "ink", label: "墨色", surface: "dark"}
  ];`);
  mount(tdom, THEME_SRC, false);
  const select = tdom.window.document.querySelector(".theme-switch select");
  check("switcher rendered for 2+ themes", select !== null);
  check("switcher lists a follow-system option", select && select.options.length === 3, select && String(select.options.length));
  check("switcher is labelled", tdom.window.document.querySelector(".theme-switch label") !== null);
  check("surface follows the active theme", tdom.window.document.documentElement.dataset.themeSurface === "light");

  // 10. Switching applies, persists, and updates the surface for the code block.
  select.value = "ink";
  select.dispatchEvent(new tdom.window.Event("change"));
  check("switch applies theme", tdom.window.document.documentElement.dataset.theme === "ink");
  check("switch updates surface", tdom.window.document.documentElement.dataset.themeSurface === "dark");
  check("choice persisted to storage", tdom.window.localStorage.getItem("course-theme") === "ink");

  // 11. `auto` resolves against the system preference.
  tdom = new JSDOM('<!doctype html><html><body></body></html>', { url: "https://example.test/", runScripts: "outside-only" });
  tdom.window.eval(`window.COURSE_THEMES = [
    {name: "scholar", label: "学术", surface: "light"},
    {name: "ink", label: "墨色", surface: "dark"}
  ];`);
  tdom.window.matchMedia = (q) => ({ matches: q.includes("dark"), addEventListener() {}, addListener() {} });
  mount(tdom, THEME_SRC, false);
  check("auto picks the dark theme on a dark system",
    tdom.window.document.documentElement.dataset.theme === "ink",
    tdom.window.document.documentElement.dataset.theme);

  // 12. An unknown theme name must not throw.
  let threw = null;
  try {
    tdom = new JSDOM('<!doctype html><html data-theme="nope"><body></body></html>', { url: "https://example.test/", runScripts: "outside-only" });
    tdom.window.eval('window.COURSE_THEMES = [{name: "scholar", label: "学术", surface: "light"}];');
    mount(tdom, THEME_SRC, false);
  } catch (error) { threw = error.message; }
  check("unknown theme name does not throw", threw === null, threw);

  console.log("\n== isolation ==");

  // 13. A course that installs neither component is untouched: the engine is
  //     never fetched and no theme attribute is invented.
  const plain = new JSDOM('<!doctype html><html><body><div class="code-block"><pre><code>x = 1</code></pre></div></body></html>',
    { url: "https://example.test/", runScripts: "outside-only" });
  check("no engine injected into a plain course", plain.window.hljs === undefined);
  check("plain course keeps the code block untouched",
    plain.window.document.querySelector("pre code").dataset.highlighted === undefined);

  console.log(failures === 0 ? "\nALL OPTIONAL COMPONENT CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  return failures;
}

process.exit(main() === 0 ? 0 : 1);
