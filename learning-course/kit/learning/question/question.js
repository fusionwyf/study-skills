(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var LearnKit = root.LearnKit || kit.store;

  var EVIDENCE = (kit.records && kit.records.EVIDENCE) || {
    ATTEMPT: "ATTEMPT",
    HINT: "HINT",
    RAW_ANSWER: "RAW_ANSWER",
    VERDICT: "VERDICT",
    KEY_VIEWED: "KEY_VIEWED",
    TURN_RAW: "TURN_RAW",
    TURN_SUBMITTED: "TURN_SUBMITTED",
    INDEPENDENCE: "INDEPENDENCE",
    OBSERVED_ASSISTANCE: "OBSERVED_ASSISTANCE"
  };

  var KIND_LABEL = {
    choice: "单选",
    multi: "多选",
    numeric: "数值",
    fill: "填空",
    open: "开放",
    dialogue: "对话"
  };

  var STATE_LABEL = {
    idle: "未作答",
    correct: "回答正确",
    incorrect: "再想想",
    saved: "已保存"
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function norm(v, cs) {
    var t = String(v || "").normalize("NFKC").trim();
    return cs ? t : t.toLocaleLowerCase();
  }

  function renderMath(node) {
    if (root.renderMathInElement && node) {
      try {
        root.renderMathInElement(node, {
          delimiters: [
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }

  var questionsList = [];

  function updateSummary() {
    var summaries = document.querySelectorAll(".q-summary, [data-question-summary]");
    if (!summaries.length) return;
    var total = questionsList.length;
    var done = questionsList.filter(function (q) {
      return q.verdict === "correct" || q.verdict === "saved" || (q.verdict === "incorrect" && q.revealed);
    }).length;
    var ok = questionsList.filter(function (q) { return q.verdict === "correct"; }).length;
    var hintCount = questionsList.filter(function (q) { return q.hints > 0; }).length;
    var ratio = total ? done / total : 0;

    summaries.forEach(function (box) {
      var sDone = box.querySelector("#s-done, [data-summary-done]");
      var sTotal = box.querySelector("#s-total, [data-summary-total]");
      var sBar = box.querySelector("#s-bar, progress");
      var sOk = box.querySelector("#s-ok, [data-summary-ok]");
      var sHint = box.querySelector("#s-hint, [data-summary-hint]");

      if (sDone) sDone.textContent = String(done);
      if (sTotal) sTotal.textContent = String(total);
      if (sBar) { sBar.max = total || 1; sBar.value = done; }
      if (sOk) sOk.textContent = String(ok);
      if (sHint) sHint.textContent = String(hintCount);
    });
  }

  /* ---- Modern Question Enhancer (Architecture §7.4) ---- */

  function enhanceModernQuestion(rootEl, index, store) {
    var kind = rootEl.dataset.kind || "choice";
    var id = rootEl.dataset.questionId || ("q" + (index + 1));
    var maxAttempts = Number(rootEl.dataset.maxAttempts || 2);
    var q = {
      root: rootEl,
      id: id,
      kind: kind,
      attempts: 0,
      hints: 0,
      verdict: "",
      assist: "independent",
      revealed: false,
      raw: null
    };
    questionsList.push(q);

    var stem = rootEl.querySelector("[data-stem]");
    var optsSrc = rootEl.querySelector("[data-options]");
    var hintsSrc = rootEl.querySelector("[data-hints]");
    var explainSrc = rootEl.querySelector("[data-explain]");
    var keySrc = rootEl.querySelector("[data-key]");
    var turnsSrc = rootEl.querySelector("[data-turns]");

    var hintNodes = hintsSrc ? Array.prototype.slice.call(hintsSrc.children) : [];
    var explainHtml = explainSrc ? explainSrc.innerHTML : "";
    var keyHtml = keySrc ? keySrc.innerHTML : "";

    rootEl.classList.add("question");
    rootEl.dataset.state = "idle";
    rootEl.setAttribute("data-role", "evidence");
    if (!rootEl.id) rootEl.id = id;
    if (stem && !stem.id) stem.id = id + "-stem";
    rootEl.setAttribute("aria-labelledby", stem ? stem.id : id);

    var head = el("div", "q-head");
    head.appendChild(el("span", "q-no", "Q" + (index + 1)));
    head.appendChild(el("span", "q-type", KIND_LABEL[kind] || kind));
    var stateChip = el("span", "q-state", STATE_LABEL.idle);
    head.appendChild(stateChip);
    var meta = el("span", "q-meta", "");
    head.appendChild(meta);

    if (stem) stem.classList.add("q-stem");

    var body = el("div", "q-body");
    var controls = {};
    var feedback = el("p", "q-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    var hintBox = el("div", "q-hints");
    hintBox.setAttribute("aria-live", "polite");

    var explain = el("div", "q-explain");
    explain.hidden = true;
    explain.innerHTML = "<b>解析</b>" + explainHtml;

    var key = el("div", "q-key");
    key.hidden = true;
    key.innerHTML = "<b>对照要点</b>" + keyHtml;

    var actions = el("div", "q-actions");
    var bHint = el("button", "btn ghost", "需要提示");
    bHint.type = "button";
    var bCheck = el("button", "btn primary",
      kind === "open" ? "保存并查看对照要点" :
      kind === "dialogue" ? "保存本轮并继续" : "检查答案");
    bCheck.type = "button";
    var bReveal = el("button", "btn", "查看答案");
    bReveal.type = "button";
    bReveal.hidden = true;

    if (hintNodes.length) actions.appendChild(bHint);
    actions.appendChild(bCheck);
    actions.appendChild(bReveal);

    var inputs = [];
    if ((kind === "choice" || kind === "multi") && optsSrc) {
      var ol = el("ol", "q-options");
      Array.prototype.forEach.call(optsSrc.children, function (li, i) {
        var whyNode = li.querySelector("[data-why]");
        var why = whyNode ? whyNode.textContent : "";
        if (whyNode) whyNode.remove();

        var item = el("li", "q-option");
        if (li.hasAttribute("data-correct")) item.dataset.correct = "true";
        var lab = el("label");
        var inp = el("input");
        inp.type = kind === "multi" ? "checkbox" : "radio";
        inp.name = id;

        var mark = el("span", "q-mark", String.fromCharCode(65 + i));
        var text = el("span", "q-text");
        text.innerHTML = li.innerHTML;
        var w = el("p", "q-why", why);
        text.appendChild(w);

        lab.appendChild(inp);
        lab.appendChild(mark);
        lab.appendChild(text);
        item.appendChild(lab);
        ol.appendChild(item);

        inputs.push({ input: inp, item: item, text: li.textContent.trim() });
        inp.addEventListener("change", function () {
          var checkedItems = inputs.filter(function (x) { return x.input.checked; });
          q.raw = checkedItems.map(function (x) { return x.text; }).join("；");
        });
      });
      optsSrc.remove();
      body.appendChild(ol);
    } else if (kind === "numeric" || kind === "fill") {
      var field = el("div", "q-field");
      var lab2 = el("label", "q-label", kind === "numeric" ? "你的答案" : "填写答案");
      lab2.setAttribute("for", id + "-in");
      var inp2 = el("input", "q-input");
      inp2.id = id + "-in";
      inp2.autocomplete = "off";
      if (kind === "numeric") inp2.inputMode = "decimal";

      field.appendChild(lab2);
      field.appendChild(inp2);
      if (rootEl.dataset.unit) field.appendChild(el("span", "q-unit", rootEl.dataset.unit));
      if (kind === "numeric") {
        field.appendChild(el("p", "q-note", "允许误差 ±" + (rootEl.dataset.tolerance || 0) +
          (rootEl.dataset.unit ? " " + rootEl.dataset.unit : "") + "。"));
      }
      body.appendChild(field);
      controls.input = inp2;
      inp2.addEventListener("input", function () { q.raw = inp2.value; });
      inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") bCheck.click(); });
    } else if (kind === "open") {
      var field3 = el("div", "q-field");
      var lab3 = el("label", "q-label", "写下你的纠正、条件与反例");
      lab3.setAttribute("for", id + "-in");
      var ta = el("textarea", "q-textarea");
      ta.id = id + "-in";
      var cnt = el("span", "q-count", "0 字");
      ta.addEventListener("input", function () {
        cnt.textContent = ta.value.length + " 字";
        q.raw = ta.value;
      });
      field3.appendChild(lab3);
      field3.appendChild(ta);
      field3.appendChild(cnt);
      body.appendChild(field3);
      controls.input = ta;
      if (keySrc) keySrc.remove();
    } else if (kind === "dialogue") {
      var wrap = el("div", "q-turns");
      var turns = [];
      if (turnsSrc) {
        Array.prototype.forEach.call(turnsSrc.children, function (li, i) {
          var t = el("div", "q-turn");
          t.hidden = i > 0;
          var promptText = li.dataset.prompt || li.textContent.trim();
          var p = el("label", "q-turn-prompt", promptText);
          p.setAttribute("for", id + "-t" + i);
          var ta2 = el("textarea", "q-textarea");
          ta2.id = id + "-t" + i;
          t.appendChild(p);
          t.appendChild(ta2);
          wrap.appendChild(t);
          turns.push({ node: t, ta: ta2, guidance: li.dataset.guidance });
        });
        turnsSrc.remove();
      }
      body.appendChild(wrap);
      controls.turns = turns;
      controls.cur = 0;
    }

    if (hintsSrc) hintsSrc.remove();
    if (explainSrc) explainSrc.remove();

    rootEl.innerHTML = "";
    rootEl.appendChild(head);
    if (stem) rootEl.appendChild(stem);
    rootEl.appendChild(body);
    rootEl.appendChild(hintBox);
    rootEl.appendChild(actions);
    rootEl.appendChild(feedback);
    rootEl.appendChild(explain);
    rootEl.appendChild(key);

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    function setAssistance(level) {
      if (q.assist === "ai_guided") return;
      if (level === "ai_guided" || (q.assist !== "with_hints" && level === "with_hints")) {
        q.assist = level;
      }
      rootEl.dataset.assistance = q.assist;
      dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: q.assist });
      dispatch({ type: EVIDENCE.INDEPENDENCE, id: id, value: q.assist });
    }

    function setState(s, tone, msg) {
      q.verdict = s;
      rootEl.dataset.state = s;
      rootEl.dataset.attempts = String(q.attempts);
      rootEl.dataset.hintUsed = q.hints > 0 ? "true" : "false";
      rootEl.dataset.independence = q.assist;

      stateChip.textContent = STATE_LABEL[s] || s;
      feedback.textContent = msg || "";
      feedback.dataset.tone = tone || "";
      feedback.dataset.state = s;

      var parts = [];
      if (q.attempts) parts.push("第 " + q.attempts + " 次作答");
      if (q.hints) parts.push("提示 " + q.hints + "/" + hintNodes.length);
      if (s === "correct" || s === "saved") {
        parts.push(q.assist === "independent" ? "独立完成" : q.assist === "ai_guided" ? "AI引导" : "用过提示");
      }
      meta.textContent = parts.join(" · ");
      updateSummary();
    }

    function lock() {
      rootEl.dataset.locked = "";
      actions.querySelectorAll("button").forEach(function (b) {
        if (b !== bReveal) b.disabled = true;
      });
      inputs.forEach(function (x) { x.input.disabled = true; });
      if (controls.input) controls.input.readOnly = true;
      bReveal.hidden = true;
    }

    bHint.addEventListener("click", function () {
      if (q.hints >= hintNodes.length) return;
      var hintNode = hintNodes[q.hints];
      var p = el("p", "q-hint");
      p.innerHTML = "<b>提示 " + (q.hints + 1) + "</b>" + hintNode.innerHTML;
      hintBox.appendChild(p);
      renderMath(p);

      var guidance = hintNode.dataset.guidance === "ai_guided" ? "ai_guided" : "with_hints";
      setAssistance(guidance);
      q.hints++;

      dispatch({ type: EVIDENCE.HINT, id: id });

      if (q.hints >= hintNodes.length) {
        bHint.disabled = true;
        bHint.textContent = "提示已用完";
      } else {
        bHint.textContent = "再来一个提示 (" + q.hints + "/" + hintNodes.length + ")";
      }
      setState(q.verdict || "idle", feedback.dataset.tone, feedback.textContent);
    });

    function showAnswerResult(reveal) {
      inputs.forEach(function (x) {
        var isRight = x.item.dataset.correct === "true";
        var picked = x.input.checked;
        if (picked && isRight) x.item.dataset.result = "right";
        else if (picked && !isRight) x.item.dataset.result = "wrong";
        else if (!picked && isRight && reveal) x.item.dataset.result = "missed";
        else delete x.item.dataset.result;
      });
    }

    function judge() {
      if (kind === "choice" || kind === "multi") {
        var picked = inputs.filter(function (x) { return x.input.checked; });
        if (!picked.length) {
          feedback.textContent = "先选择答案，再检查。";
          feedback.dataset.tone = "info";
          return null;
        }
        var right = inputs.filter(function (x) { return x.item.dataset.correct === "true"; });
        var ok = picked.length === right.length && picked.every(function (x) { return x.item.dataset.correct === "true"; });
        q.raw = picked.map(function (x) { return x.text; }).join("；");
        return ok;
      }
      var raw = controls.input ? controls.input.value : "";
      if (!raw.trim()) {
        feedback.textContent = "先填写答案。";
        feedback.dataset.tone = "info";
        return null;
      }
      q.raw = raw;
      if (kind === "numeric") {
        var v = Number(raw);
        var expected = Number(rootEl.dataset.expected);
        var tol = Number(rootEl.dataset.tolerance || 0);
        return Number.isFinite(v) && Number.isFinite(expected) && Number.isFinite(tol) && tol >= 0 && Math.abs(v - expected) <= tol;
      }
      var acc = [];
      try { acc = JSON.parse(rootEl.dataset.accepted || "[]"); } catch (e) { acc = []; }
      var cs = rootEl.dataset.caseSensitive === "true";
      return Array.isArray(acc) && acc.some(function (a) { return norm(a, cs) === norm(raw, cs); });
    }

    bCheck.addEventListener("click", function () {
      if (kind === "open") {
        var rawText = controls.input ? controls.input.value.trim() : "";
        if (!rawText) {
          if (controls.input) controls.input.focus();
          feedback.textContent = "先写下自己的回答。";
          feedback.dataset.tone = "info";
          return;
        }
        q.attempts = 1;
        key.hidden = false;
        renderMath(key);
        if (controls.input) controls.input.readOnly = true;
        bCheck.disabled = true;
        dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: rawText });
        dispatch({ type: EVIDENCE.KEY_VIEWED, id: id });
        setState("saved", "info", "回答已保存，请对照要点自查差距。");
        return;
      }
      if (kind === "dialogue") {
        var cur = controls.turns[controls.cur];
        var val = cur.ta.value.trim();
        if (!val) {
          cur.ta.focus();
          feedback.textContent = "先留下自己的回答，再继续。";
          feedback.dataset.tone = "info";
          return;
        }
        cur.ta.readOnly = true;
        cur.node.dataset.done = "";
        q.attempts = controls.cur + 1;
        var turnId = String(controls.cur + 1);
        dispatch({ type: EVIDENCE.TURN_RAW, id: id, turn: turnId, value: val });
        dispatch({ type: EVIDENCE.TURN_SUBMITTED, id: id, turn: turnId });

        if (controls.cur + 1 < controls.turns.length) {
          controls.cur++;
          var nextTurn = controls.turns[controls.cur];
          nextTurn.node.hidden = false;
          if (nextTurn.guidance) setAssistance(nextTurn.guidance);
          nextTurn.ta.focus();
          if (controls.cur + 1 === controls.turns.length) bCheck.textContent = "保存最后一轮";
          setState("idle", "info", "上一轮已保留。请回答新的追问。");
        } else {
          bCheck.disabled = true;
          setState("saved", "info", "各轮回答已保留，可复制学习记录给老师评估。");
        }
        meta.textContent = "已完成 " + q.attempts + "/" + controls.turns.length + " 轮" + (q.hints ? " · 提示 " + q.hints : "");
        return;
      }

      var ok = judge();
      if (ok === null) return;
      q.attempts++;

      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: q.raw });
      dispatch({ type: EVIDENCE.ATTEMPT, id: id });
      dispatch({ type: EVIDENCE.VERDICT, id: id, value: ok ? "correct" : "incorrect" });

      if (ok) {
        showAnswerResult(true);
        explain.hidden = false;
        renderMath(explain);
        lock();
        setState("correct", "correct", "回答正确。请用一句话说明判断依据。");
      } else {
        showAnswerResult(false);
        var left = maxAttempts - q.attempts;
        if (left <= 0) bReveal.hidden = false;
        bCheck.textContent = "再检查一次";
        setState("incorrect", "incorrect", left > 0 ?
          "还不对，再检查题干条件。还可以再试 " + left + " 次。" :
          "还不对。可以继续尝试，或查看答案与解析。");
      }
    });

    bReveal.addEventListener("click", function () {
      if (kind === "numeric") {
        if (controls.input) controls.input.value = rootEl.dataset.expected || "";
      } else if (kind === "fill") {
        try {
          var acc = JSON.parse(rootEl.dataset.accepted || "[]");
          if (controls.input && acc.length) controls.input.value = acc[0];
        } catch (e) {}
      }
      showAnswerResult(true);
      explain.hidden = false;
      renderMath(explain);
      lock();
      dispatch({ type: EVIDENCE.KEY_VIEWED, id: id });
      setState("incorrect", "incorrect", "已显示答案。回头想想：当时哪一步判断偏了？");
      q.revealed = true;
    });

    setState("idle", "", "");
    meta.textContent = "";
  }

  /* ---- Main Init ---- */

  function initQuestions() {
    if (typeof document === "undefined") return;
    var lesson = document.querySelector(".lesson") || document.body;
    var store = lesson.__evidenceStore;

    if (!store && LearnKit && LearnKit.createStore && kit.records && kit.records.evidenceModel) {
      store = LearnKit.createStore(kit.records.evidenceModel());
      lesson.__evidenceStore = store;
    }

    // Process modern questions
    var modernSelector = "section.question, .question[data-kind], section[data-question-id][data-kind], section[data-question-id]:has([data-stem])";
    var modernEls = Array.prototype.slice.call(document.querySelectorAll(modernSelector));
    modernEls.forEach(function (qEl, i) {
      enhanceModernQuestion(qEl, i, store);
    });

    updateSummary();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("learning.question");
    }
  }

  kit.question = {
    enhance: enhanceModernQuestion,
    updateSummary: updateSummary,
    init: initQuestions
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initQuestions);
    else initQuestions();
  }
})(typeof window !== "undefined" ? window : globalThis);
