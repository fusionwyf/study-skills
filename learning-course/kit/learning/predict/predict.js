/*
 * learning.predict — 先预测后揭晓 (Predict-then-Reveal)
 *
 * 作者契约（两种等价写法，二选一）:
 *   <kit-predict data-question-id="p1" data-answer="9.8" data-tolerance="0.5" data-unit="m/s">
 *     <div data-predict-prompt><p>先猜：……？</p></div>
 *     <div data-reveal><p>揭晓内容（也是无脚本时的可读后备）</p></div>
 *   </kit-predict>
 *   <div class="predict" data-predict data-question-id="p1" ...>…</div>
 *
 * data-answer 为数值时自动数值判定（data-tolerance 容差，缺省 10% 相对容差），
 * 并渲染偏差条；无 data-answer 时开放预测，只记录原文不判对错。
 * 揭晓时向 evidenceModel 派发 ATTEMPT + RAW_ANSWER（+ 数值判定时的 VERDICT）。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var LearnKit = root.LearnKit || kit.store;

  var EVIDENCE = (kit.records && kit.records.EVIDENCE) || {
    ATTEMPT: "ATTEMPT", RAW_ANSWER: "RAW_ANSWER", VERDICT: "VERDICT"
  };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function ensureStore(lesson) {
    var store = lesson.__evidenceStore;
    if (!store && LearnKit && LearnKit.createStore && kit.records && kit.records.evidenceModel) {
      store = LearnKit.createStore(kit.records.evidenceModel());
      lesson.__evidenceStore = store;
    }
    return store;
  }

  function enhance(node, lesson, store) {
    if (node.dataset.kitPredictBound === "true") return;
    node.dataset.kitPredictBound = "true";

    var id = node.dataset.questionId || node.id || "predict";
    var promptNode = node.querySelector("[data-predict-prompt]") || node.querySelector("[data-stem]");
    var revealNode = node.querySelector("[data-reveal]");
    var answerText = node.dataset.answer != null ? String(node.dataset.answer).trim() : "";
    var expected = answerText !== "" ? Number(answerText) : NaN;
    var numeric = answerText !== "" && isFinite(expected);
    var tolerance = node.dataset.tolerance != null ? Number(node.dataset.tolerance) : NaN;
    if (!isFinite(tolerance)) tolerance = Math.abs(expected) * 0.1; // 缺省 10% 相对容差
    var unit = node.dataset.unit || "";

    // 无脚本后备：data-reveal 在 HTML 中默认可见；增强后先隐藏，揭晓时展示。
    if (revealNode) revealNode.hidden = true;

    var body = el("div", "kit-predict__body");
    var input = el("input", "kit-predict__input");
    input.type = numeric ? "number" : "text";
    if (numeric) input.step = "any";
    input.placeholder = "先写下你的预测" + (unit ? "（" + unit + "）" : "");
    input.setAttribute("aria-label", "预测输入");
    var button = el("button", "kit-predict__btn", "揭晓");
    button.type = "button";
    var meter = el("div", "kit-predict__meter");
    meter.hidden = true;
    meter.setAttribute("role", "status");
    var bar = el("div", "kit-predict__bar");
    var barFill = el("div", "kit-predict__bar-fill");
    bar.appendChild(barFill);
    var note = el("p", "kit-predict__note");
    meter.appendChild(bar);
    meter.appendChild(note);

    body.appendChild(input);
    body.appendChild(button);
    body.appendChild(meter);
    if (promptNode) promptNode.after(body);
    else node.appendChild(body);

    button.addEventListener("click", function () {
      var raw = String(input.value || "").trim();
      if (!raw) {
        meter.hidden = false;
        note.textContent = "先写下预测，再揭晓。";
        return;
      }
      var dispatch = function (action) {
        var curStore = lesson.__evidenceStore || store;
        if (curStore && curStore.dispatch) curStore.dispatch(action);
      };
      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: raw });
      dispatch({ type: EVIDENCE.ATTEMPT, id: id });

      var value = Number(raw);
      var correct = null;
      if (numeric && isFinite(value)) {
        correct = Math.abs(value - expected) <= tolerance;
        dispatch({ type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect" });
      }

      if (numeric && isFinite(value)) {
        var relative = Math.abs(value - expected) / Math.max(Math.abs(expected), 1e-9);
        var percent = Math.round(Math.min(relative, 9.99) * 1000) / 10;
        barFill.style.width = Math.max(2, Math.min(100, percent)) + "%";
        bar.dataset.tone = correct ? "ok" : "off";
        note.textContent = "你的预测 " + raw + unit + "；真实值 " + answerText + unit +
          "；偏差约 " + percent + "%" + (correct ? "，在容差内。" : "，超出容差。");
      } else if (numeric) {
        note.textContent = "请输入数值后再揭晓；真实值是 " + answerText + unit + "。";
      } else {
        note.textContent = "已记录你的预测：这是开放预测，没有唯一数值答案。";
      }
      meter.hidden = false;

      if (revealNode) {
        revealNode.hidden = false;
        if (kit.content && kit.content.math && kit.content.math.renderIn) {
          try { kit.content.math.renderIn(revealNode); } catch (e) {}
        } else if (root.renderMathInElement) {
          try {
            root.renderMathInElement(revealNode, {
              delimiters: [
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
              ],
              throwOnError: false
            });
          } catch (e) {}
        }
      }

      input.disabled = true;
      button.disabled = true;
      node.dataset.predictState = JSON.stringify({ raw: raw, revealed: true, correct: correct });
    });
  }

  function init() {
    if (typeof document === "undefined") return;
    var lesson = document.querySelector(".lesson") || document.body;
    var store = ensureStore(lesson);
    document.querySelectorAll("kit-predict, [data-predict]").forEach(function (node) {
      try {
        enhance(node, lesson, store);
      } catch (error) {
        node.dataset.kitPredictBound = "failed";
        console.error("[kit] predict init failed:", error);
      }
    });
  }

  kit.predict = { init: init };
  if (kit.registerModule) kit.registerModule("learning.predict", kit.predict);
  if (!kit.registerModule && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
