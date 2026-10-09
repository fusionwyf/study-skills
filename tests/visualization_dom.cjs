/*
 * Render the visualisation kinds in a real DOM and assert what each one puts
 * on screen, including the fallback path a browser takes when the optional
 * third-party library is absent.
 *
 * The adapter contract says a container must never end up as a blank stage
 * (references/render.md §3): with no Plotly, `chart` draws its own SVG; with no
 * JSXGraph, `spatial` prints A · v · Av so the arithmetic is still checkable.
 * Both of those paths are invisible in a normal browser run, which is why they
 * are pinned here.
 *
 * Needs jsdom from the managed node workspace:
 *   NODE_PATH=<workspace>/node_modules node tests/visualization_dom.cjs
 */
const {JSDOM} = require("jsdom");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const KIT = path.resolve(__dirname, "../learning-course/assets/visualizations");

function section(id, kind, config) {
  return `<section class="visualization" id="${id}" data-visualization="${kind}">
    <div class="viz-fallback" data-viz-fallback>模型说明</div>
    <div class="viz-host" id="${id}-host" data-viz-host hidden></div>
    <p class="viz-status" data-viz-status role="status"></p>
    <script type="application/json" data-viz-config>${JSON.stringify(config)}</script>
  </section>`;
}

const body = [
  section("chart-demo", "chart", {model: "s", domain: "d", precision: "p", traces: [{type: "scatter", x: [0, 1, 2], y: [0, 1, 4]}]}),
  section("bar-demo", "chart", {model: "s", domain: "d", precision: "p", traces: [{type: "bar", x: [0, 1], y: [3, 7]}]}),
  section("surface-demo", "chart", {model: "s", domain: "d", precision: "p", traces: [{type: "surface", x: [0, 1], y: [0, 1], z: [[0, 1], [1, 2]]}]}),
  section("spatial-demo", "spatial", {model: "t", domain: "d", precision: "p", matrix: [[1, -1], [0, 1]], vector: [1, 0]}),
  section("shapes-demo", "spatial", {model: "t", domain: "d", precision: "p", shapes: [{title: "方格", description: "单位方格"}]}),
  section("relation-demo", "relation", {model: "r", domain: "d", precision: "p", nodes: [{id: "a", label: "输入"}, {id: "b", label: "输出"}], edges: [{from: "a", to: "b", label: "产生"}]}),
  section("timeline-demo", "timeline", {model: "t", domain: "d", precision: "p", events: [{title: "开始"}, {title: "结束"}]}),
  section("process-demo", "process", {model: "p", domain: "d", precision: "p", nodes: [{label: "准备"}, {label: "执行"}], edges: [{from: "准备", to: "执行"}]}),
  section("table-demo", "table", {model: "t", domain: "d", precision: "p", columns: [{key: "n", label: "方案"}, {key: "c", label: "成本"}], rows: [{n: "A", c: "低"}, {n: "B", c: "高"}]}),
  section("sequence-steps", "sequence", {model: "q", domain: "d", precision: "p", steps: [{title: "识别输入", description: "记录条件"}, {title: "解释输出"}, {title: "收尾"}]}),
  section("sequence-input", "sequence", {model: "q", domain: "d", precision: "p", input: [5, 1, 4, 2, 3]}),
].join("\n");

const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {runScripts: "outside-only", pretendToBeVisual: true});

// Load exactly what a course page loads, in the same order.
for (const file of ["visualizations.js", "kinds/list.js", "kinds/sequence.js", "kinds/table.js", "kinds/chart.js", "kinds/spatial.js"]) {
  dom.window.eval(fs.readFileSync(path.join(KIT, file), "utf8"));
}
const {document} = dom.window;

const of = id => document.getElementById(id);
const host = id => of(id).querySelector("[data-viz-host]");
const status = id => of(id).querySelector("[data-viz-status]").textContent;
const nodes = id => host(id).querySelectorAll("*").length;
const waits = () => new Promise(resolve => setTimeout(resolve, 300));

(async () => {
  await waits();

  assert.equal(dom.window.__COURSE_VISUALIZATIONS_READY__, true, "the kit must signal readiness once every container is handled");
  // The array comes from the jsdom realm, so compare its contents rather than
  // its prototype chain.
  assert.equal(JSON.stringify(dom.window.CourseVisualizations.loaded()),
    JSON.stringify(["chart", "process", "relation", "sequence", "spatial", "table", "timeline"]));

  const ready = ["chart-demo", "bar-demo", "surface-demo", "spatial-demo", "shapes-demo", "relation-demo", "timeline-demo", "process-demo", "table-demo", "sequence-steps", "sequence-input"];
  for (const id of ready) {
    assert.equal(of(id).dataset.vizReady, "true", `${id} must finish rendering`);
    assert.equal(host(id).hidden, false, `${id} must reveal its host instead of leaving the fallback as the only output`);
  }

  // No third-party library is present, so every one of these is a fallback path.
  assert.equal(dom.window.Plotly, undefined, "this harness deliberately runs without Plotly");
  assert.equal(dom.window.JXG, undefined, "this harness deliberately runs without JSXGraph");

  // chart → a built-in SVG with one path per line trace, two bars for a bar trace.
  assert.equal(host("chart-demo").querySelectorAll("svg").length, 1);
  assert.equal(host("chart-demo").querySelectorAll("path").length, 1);
  assert.match(status("chart-demo"), /静态 SVG 视图：x ∈ \[0, 2\]，y ∈ \[0, 4\]/);
  assert.equal(host("bar-demo").querySelectorAll("rect").length, 2);
  // A grid trace cannot be drawn without a mesh renderer, so it prints a note
  // rather than an empty canvas.
  assert.match(status("surface-demo"), /网格数据已校验/);
  assert.ok(nodes("surface-demo") > 0, "a grid trace must still produce readable output");

  // spatial → A · v · Av as a three-row table (never a blank stage).
  assert.equal(host("spatial-demo").querySelectorAll(".viz-table tr").length, 3);
  assert.match(status("spatial-demo"), /未加载几何渲染器/);
  const cells = Array.from(host("spatial-demo").querySelectorAll("td")).map(td => td.textContent);
  assert.deepEqual(cells, ["[1, -1] [0, 1]", "(1, 0)", "(1, 0)"], "the fallback must show the actual matrix and the computed image");
  // A shapes-only config still lists what it has.
  assert.equal(host("shapes-demo").querySelectorAll(".viz-list li").length, 1);

  // The library-free kinds.
  assert.equal(host("relation-demo").querySelectorAll(".viz-list li").length, 2);
  assert.equal(host("relation-demo").querySelectorAll(".viz-edges li").length, 1);
  assert.equal(host("relation-demo").querySelector(".viz-edges li").textContent, "a → b：产生");
  assert.equal(host("timeline-demo").querySelectorAll(".viz-list li").length, 2);
  assert.equal(host("process-demo").querySelectorAll(".viz-list li").length, 2);
  assert.equal(host("process-demo").querySelectorAll(".viz-edges li").length, 1);
  assert.equal(host("table-demo").querySelectorAll(".viz-table tr").length, 3, "one header row plus two body rows");
  assert.equal(host("table-demo").querySelectorAll("th[scope=col]").length, 2);

  // sequence → a step counter that advances and clamps at both ends.
  assert.match(status("sequence-steps"), /步骤 1\/3/);
  assert.equal(host("sequence-steps").querySelectorAll("h3").length, 1);
  assert.match(status("sequence-input"), /步骤 1\/\d+/, "a bare `input` derives its own trace");
  assert.ok(host("sequence-input").querySelectorAll(".viz-array li").length >= 5, "the derived trace must show the array being sorted");

  console.log("Visualisation DOM checks passed: every kind renders, and both library-missing fallbacks stay readable");
})().catch(error => { console.error(error); process.exit(1); });
