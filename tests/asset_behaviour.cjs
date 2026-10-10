const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const skill = path.resolve(__dirname, "../learning-course");
const base = { model: "m", domain: "d", precision: "p" };
function viz(id, kind, config, source = "") {
  return `<section id="${id}" data-visualization="${kind}" ${source ? `data-viz-source="#${source}"` : ""}><div data-viz-fallback>可读模型与核对点</div><div id="${id}-host" data-viz-host hidden></div><p data-viz-status role="status"></p><script type="application/json" data-viz-config>${JSON.stringify({ ...base, ...config })}</script></section>`;
}
function dom(body, files) {
  const d = new JSDOM(`<html><body>${body}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://course.local/lessons/0001-demo.html",
  });
  for (const file of files)
    d.window.eval(fs.readFileSync(path.join(skill, "assets", file), "utf8"));
  return d;
}
const wait = () => new Promise((r) => setTimeout(r, 40));
(async () => {
  const d = dom(
    `<main class="lesson" data-course-id="test" data-lesson-id="0001" data-objective="test">
 <section data-question-id="numeric" data-answer-kind="numeric" data-expected="0.3" data-tolerance="0.00001"><label for="n">答案</label><input id="n" data-answer-input><button data-answer-check>检查</button><p data-role="answer-feedback"></p></section>
 <section data-question-id="fill" data-answer-kind="fill" data-accepted='["alpha"]'><label for="f">答案</label><input id="f" data-answer-input><button data-answer-check>检查</button><p data-role="answer-feedback"></p></section>
 <section data-question-id="image-notes"><figure data-media><div data-media-frame><img alt="原创图"></div><figcaption data-media-fallback>热点说明</figcaption><p data-media-status></p><details data-media-transcript><summary>参考</summary>文字稿</details><script data-media-config type="application/json">{"hotspots":[{"id":"a","label":"入口","x":10,"y":50}]}</script></figure><label for="notes">观察</label><textarea id="notes"></textarea></section><button data-copy-feedback>复制</button></main>`,
    [
      "learnkit/learnkit.js",
      "course-template/course.js",
      "optional/media/media.js",
    ],
  );
  await wait();
  const w = d.window,
    doc = w.document,
    lesson = doc.querySelector(".lesson"),
    store = lesson.__evidenceStore;
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
    ["visualizations/visualizations.js", "visualizations/kinds/chart.js"],
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
    ["visualizations/visualizations.js", "visualizations/kinds/chart.js"],
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
    ["visualizations/visualizations.js", "visualizations/kinds/list.js"],
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
