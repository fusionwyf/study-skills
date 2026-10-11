const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const skill = path.resolve(__dirname, "../learning-course");
const base = { model: "m", domain: "d", precision: "p" };
function viz(id, kind, config, source = "") {
  return `<section id="${id}" data-visualization="${kind}" ${source ? `data-viz-source="#${source}"` : ""}><div data-viz-fallback>可读模型与核对点</div><div id="${id}-host" data-viz-host hidden></div><p data-viz-status role="status"></p><script type="application/json" data-viz-config>${JSON.stringify({ ...base, ...config })}</script></section>`;
}

// Generate Kit in a temporary course to test real bundled artifact
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-beh-test-"));
let kitJs = "";
try {
  const initPy = path.join(skill, "scripts/init_course.py");
  const kitPy = path.join(skill, "kit/build/kit.py");
  const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

  cp.execFileSync(py, [initPy, "--course-dir", tmpDir, "--title", "Test Course", "--goal", "Testing Kit"], { stdio: "pipe" });

  const sampleHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body>
<main class="lesson" data-course-id="test" data-lesson-id="0001" data-objective="test">
  <section data-question-id="numeric" data-answer-kind="numeric" data-expected="0.3" data-tolerance="0.00001"><input data-answer-input></section>
  <figure data-media><img alt="test"></figure>
  <div data-visualization="chart"></div>
  <div data-visualization="relation"></div>
  <div data-visualization="timeline"></div>
</main>
</body>
</html>`;
  fs.writeFileSync(path.join(tmpDir, "lessons/0001-test.html"), sampleHtml, "utf8");

  const cfgPath = path.join(tmpDir, "assets/course/config.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  cfg.modules = ["viz.kinds.chart"];
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");

  cp.execFileSync(py, [kitPy, "sync", tmpDir], { stdio: "pipe" });

  kitJs = fs.readFileSync(path.join(tmpDir, "assets/kit/kit.js"), "utf8");
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}
}

function dom(body) {
  const d = new JSDOM(`<html><body>${body}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://course.local/lessons/0001-demo.html",
  });
  d.window.eval(kitJs);
  return d;
}
const wait = () => new Promise((r) => setTimeout(r, 60));
(async () => {
  const d = dom(
    `<main class="lesson" data-course-id="test" data-lesson-id="0001" data-objective="test">
 <section data-question-id="numeric" data-answer-kind="numeric" data-expected="0.3" data-tolerance="0.00001"><label for="n">答案</label><input id="n" data-answer-input><button data-answer-check>检查</button><p data-role="answer-feedback"></p></section>
 <section data-question-id="fill" data-answer-kind="fill" data-accepted='["alpha"]'><label for="f">答案</label><input id="f" data-answer-input><button data-answer-check>检查</button><p data-role="answer-feedback"></p></section>
 <section data-question-id="image-notes"><figure data-media><div data-media-frame><img alt="原创图"></div><figcaption data-media-fallback>热点说明</figcaption><p data-media-status></p><details data-media-transcript><summary>参考</summary>文字稿</details><script data-media-config type="application/json">{"hotspots":[{"id":"a","label":"入口","x":10,"y":50}]}</script></figure><label for="notes">观察</label><textarea id="notes"></textarea></section><button data-copy-feedback>复制</button></main>`
  );
  await wait();
  const w = d.window,
    doc = w.document,
    lesson = doc.querySelector(".lesson"),
    store = lesson.__evidenceStore;
  const kitInstance = w.CourseKit || w.kit;
  assert.equal(kitInstance.ready.isSettled(), true, "CourseKit.ready.isSettled() must be true");
  assert.equal(doc.documentElement.dataset.kitStatus, "settled", "documentElement dataset.kitStatus must be 'settled'");
  assert.ok(kitInstance.ready.getReadyModules().includes("core"), "core module must be in readyModules");
  function answer(id, value) {
    const task = doc.querySelector(`[data-question-id="${id}"]`),
      input = task.querySelector("input[data-answer-input]");
    input.value = value;
    input.dispatchEvent(new w.Event("input"));
    task.querySelector("[data-answer-check]").click();
  }
  answer("numeric", "0.300001");
  assert.equal(store.getState().questions.numeric.verdict, "correct");
  answer("numeric", "Infinity");
  assert.equal(store.getState().questions.numeric.verdict, "incorrect");
  assert.equal(store.getState().questions.numeric.rawAnswer, "Infinity");
  answer("fill", "  ＡＬＰＨＡ  ");
  assert.equal(store.getState().questions.fill.verdict, "correct");
  assert.equal(store.getState().questions.fill.rawAnswer, "  ＡＬＰＨＡ  ");
  const hotspots = doc.querySelectorAll("[data-media] .media-hotspot");
  assert.equal(hotspots.length, 1, "There must be exactly 1 hotspot button per configured hotspot, not duplicated");
  if (kitInstance.media && kitInstance.media.init) {
    kitInstance.media.init();
    assert.equal(
      doc.querySelectorAll("[data-media] .media-hotspot").length,
      1,
      "Hotspot buttons must not duplicate on re-initialization"
    );
  }
  doc.querySelector(".media-hotspot").click();
  assert.match(doc.querySelector("[data-media]").dataset.mediaState, /"a"/);
  doc.getElementById("notes").value = "入口使动线清楚";
  doc.getElementById("notes").dispatchEvent(new w.Event("input"));
  assert.equal(
    store.getState().questions["image-notes"].rawAnswer,
    "入口使动线清楚",
  );
  doc.querySelector("[data-media-transcript]").open = true;
  await wait();
  assert.equal(store.getState().questions["image-notes"].answerViewed, true);
  assert.equal(
    store.getState().questions["image-notes"].observedAssistance,
    "with_hints",
  );
  let copied = "";
  Object.defineProperty(w.navigator, "clipboard", {
    value: {
      writeText: async (text) => {
        copied = text;
      },
    },
  });
  doc.querySelector("[data-copy-feedback]").click();
  await wait();
  assert.match(copied, /入口使动线清楚/);
  assert.match(copied, /热点选择/);
  assert.match(copied, /ＡＬＰＨＡ/);
  d.window.close();
  // Test chart subscription, categorical SVG and numeric negative baseline without vendor.
  const c = dom(
    viz(
      "linked",
      "chart",
      { traces: [{ type: "bar", x: ["A", "B"], y: [-2, 3] }] },
      "source",
    ) + '<div id="source"></div>',
  );
  const cw = c.window,
    cd = cw.document;
  let update,
    unsubscribe = 0;
  cd.getElementById("source").__learnkitStore = {
    subscribe: (f) => {
      update = f;
      return () => unsubscribe++;
    },
    snapshot: () => ({
      derived: {
        visualizations: {
          linked: { traces: [{ type: "bar", x: ["A", "B"], y: [-2, 3] }] },
        },
      },
    }),
  };
  await wait();
  assert.equal(cd.getElementById("linked").dataset.vizReady, "true");
  assert.equal(cd.querySelectorAll("rect").length, 2);
  assert.equal(cd.querySelectorAll("text")[0].textContent, "A");
  const old = cd.querySelector("rect").getAttribute("height");
  update({
    derived: {
      visualizations: {
        linked: { traces: [{ type: "bar", x: ["A", "B"], y: [1, 3] }] },
      },
    },
  });
  assert.notEqual(cd.querySelector("rect").getAttribute("height"), old);
  assert.match(cd.getElementById("linked").dataset.visualState, /\[1,3\]/);
  cw.dispatchEvent(new cw.Event("pagehide"));
  assert.equal(unsubscribe, 1);
  c.window.close();
  // Async renderer rejection must fail readiness; a later valid state recovers.
  const p = dom(
    viz("async-chart", "chart", { traces: [{ x: [0], y: [1] }] }, "source") +
      '<div id="source"></div>',
  );
  const pd = p.window.document;
  let refresh,
    rejectPlot = false,
    resolvePlot;
  p.window.Plotly = {
    react: () =>
      rejectPlot
        ? Promise.reject(new Error("plot failed"))
        : resolvePlot
          ? new Promise((resolve) => {
              resolvePlot = resolve;
            })
          : Promise.resolve(),
    purge: () => {},
  };
  const snapshot = () => ({
    derived: {
      visualizations: { "async-chart": { traces: [{ x: [0], y: [1] }] } },
    },
  });
  pd.getElementById("source").__learnkitStore = {
    subscribe: (f) => {
      refresh = f;
      return () => {};
    },
    snapshot,
  };
  await wait();
  assert.equal(pd.getElementById("async-chart").dataset.vizReady, "true");
  rejectPlot = true;
  await refresh(snapshot());
  assert.equal(pd.getElementById("async-chart").dataset.vizReady, "failed");
  assert.equal(pd.getElementById("async-chart-host").hidden, true);
  rejectPlot = false;
  resolvePlot = true;
  const painting = refresh(snapshot());
  assert.equal(pd.getElementById("async-chart").dataset.vizReady, "pending");
  await Promise.resolve();
  await Promise.resolve();
  resolvePlot();
  await painting;
  assert.equal(pd.getElementById("async-chart").dataset.vizReady, "true");
  assert.equal(pd.getElementById("async-chart-host").hidden, false);
  p.window.close();
  // Sequence clamps mismatched external indices; graph exposes date and keyboard selection.
  const g = dom(
    viz("graph", "relation", {
      nodes: [
        { id: "a", label: "输入" },
        { id: "b", label: "输出" },
      ],
      edges: [{ from: "a", to: "b" }],
    }) +
      viz("time", "timeline", { events: [{ title: "开始", date: "阶段一" }] }),
  );
  await wait();
  assert.equal(g.window.document.querySelectorAll("#graph svg line").length, 1);
  const edge = g.window.document.querySelector("#graph svg line");
  const boxes = g.window.document.querySelectorAll("#graph svg rect");
  assert.ok(Number(edge.getAttribute("x1")) > Number(boxes[0].getAttribute("x")) + Number(boxes[0].getAttribute("width")), "directed edge starts outside the source node");
  assert.ok(Number(edge.getAttribute("x2")) < Number(boxes[1].getAttribute("x")), "arrowhead remains outside the target node");
  assert.equal(
    g.window.document.querySelector("#time .viz-date").textContent,
    "阶段一",
  );
  g.window.document
    .querySelector("#graph svg g")
    .dispatchEvent(
      new g.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  assert.match(
    g.window.document.querySelector("#graph").dataset.visualState,
    /"selected":0/,
  );
  g.window.close();
  console.log(
    "Asset behaviour passed: numeric/fill raw evidence, media export, categorical chart updates, unsubscribe and keyboard graphs",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
