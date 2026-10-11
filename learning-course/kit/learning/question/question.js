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

  /* ---- Question Kind Adapters Registry (Architecture §7.4 & P6) ---- */

  var kindAdapters = {};

  function registerKind(kind, adapter) {
    if (!kind || !adapter) return;
    kindAdapters[kind] = adapter;
    if (adapter.label && !KIND_LABEL[kind]) {
      KIND_LABEL[kind] = adapter.label;
    }
  }

  function getKind(kind) {
    return kindAdapters[kind];
  }

  /* 1. Choice Adapter */
  registerKind("choice", {
    label: "单选",
    mount: function (ctx) {
      var optsSrc = ctx.optsSrc;
      if (!optsSrc) return;
      var ol = el("ol", "q-options");
      var inputs = [];
      Array.prototype.forEach.call(optsSrc.children, function (li, i) {
        var whyNode = li.querySelector("[data-why]");
        var why = whyNode ? whyNode.textContent : "";
        if (whyNode) whyNode.remove();

        var item = el("li", "q-option");
        if (li.hasAttribute("data-correct")) item.dataset.correct = "true";
        var lab = el("label");
        var inp = el("input");
        inp.type = "radio";
        inp.name = ctx.id;

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
          ctx.q.raw = checkedItems.map(function (x) { return x.text; }).join("；");
        });
      });
      optsSrc.remove();
      ctx.body.appendChild(ol);
      ctx.controls.inputs = inputs;
    },
    getRawAnswer: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var checkedItems = inputs.filter(function (x) { return x.input.checked; });
      return checkedItems.map(function (x) { return x.text; }).join("；");
    },
    judge: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var picked = inputs.filter(function (x) { return x.input.checked; });
      if (!picked.length) {
        ctx.feedback.textContent = "先选择答案，再检查。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = picked.map(function (x) { return x.text; }).join("；");
      return picked.length === 1 && picked[0].item.dataset.correct === "true";
    },
    reveal: function (ctx, isReveal) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) {
        var isRight = x.item.dataset.correct === "true";
        var picked = x.input.checked;
        if (picked && isRight) x.item.dataset.result = "right";
        else if (picked && !isRight) x.item.dataset.result = "wrong";
        else if (!picked && isRight && isReveal) x.item.dataset.result = "missed";
        else delete x.item.dataset.result;
      });
    },
    lock: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) { x.input.disabled = true; });
    }
  });

  /* 2. Multi-Choice Adapter */
  registerKind("multi", {
    label: "多选",
    mount: function (ctx) {
      var optsSrc = ctx.optsSrc;
      if (!optsSrc) return;
      var ol = el("ol", "q-options");
      var inputs = [];
      Array.prototype.forEach.call(optsSrc.children, function (li, i) {
        var whyNode = li.querySelector("[data-why]");
        var why = whyNode ? whyNode.textContent : "";
        if (whyNode) whyNode.remove();

        var item = el("li", "q-option");
        if (li.hasAttribute("data-correct")) item.dataset.correct = "true";
        var lab = el("label");
        var inp = el("input");
        inp.type = "checkbox";
        inp.name = ctx.id;

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
          ctx.q.raw = checkedItems.map(function (x) { return x.text; }).join("；");
        });
      });
      optsSrc.remove();
      ctx.body.appendChild(ol);
      ctx.controls.inputs = inputs;
    },
    getRawAnswer: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var checkedItems = inputs.filter(function (x) { return x.input.checked; });
      return checkedItems.map(function (x) { return x.text; }).join("；");
    },
    judge: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var picked = inputs.filter(function (x) { return x.input.checked; });
      if (!picked.length) {
        ctx.feedback.textContent = "先选择答案，再检查。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = picked.map(function (x) { return x.text; }).join("；");
      var right = inputs.filter(function (x) { return x.item.dataset.correct === "true"; });
      return picked.length === right.length && picked.every(function (x) { return x.item.dataset.correct === "true"; });
    },
    reveal: function (ctx, isReveal) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) {
        var isRight = x.item.dataset.correct === "true";
        var picked = x.input.checked;
        if (picked && isRight) x.item.dataset.result = "right";
        else if (picked && !isRight) x.item.dataset.result = "wrong";
        else if (!picked && isRight && isReveal) x.item.dataset.result = "missed";
        else delete x.item.dataset.result;
      });
    },
    lock: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) { x.input.disabled = true; });
    }
  });

  /* 3. Numeric Adapter */
  registerKind("numeric", {
    label: "数值",
    mount: function (ctx) {
      var field = el("div", "q-field");
      var lab2 = el("label", "q-label", "你的答案");
      lab2.setAttribute("for", ctx.id + "-in");
      var inp2 = el("input", "q-input");
      inp2.id = ctx.id + "-in";
      inp2.autocomplete = "off";
      inp2.inputMode = "decimal";

      field.appendChild(lab2);
      field.appendChild(inp2);
      if (ctx.rootEl.dataset.unit) field.appendChild(el("span", "q-unit", ctx.rootEl.dataset.unit));
      field.appendChild(el("p", "q-note", "允许误差 ±" + (ctx.rootEl.dataset.tolerance || 0) +
        (ctx.rootEl.dataset.unit ? " " + ctx.rootEl.dataset.unit : "") + "。"));
      ctx.body.appendChild(field);
      ctx.controls.input = inp2;
      inp2.addEventListener("input", function () { ctx.q.raw = inp2.value; });
      inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") ctx.bCheck.click(); });
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    judge: function (ctx) {
      var raw = ctx.controls.input ? ctx.controls.input.value : "";
      if (!raw.trim()) {
        ctx.feedback.textContent = "先填写答案。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = raw;
      var v = Number(raw.trim());
      var expected = Number(ctx.rootEl.dataset.expected);
      var tol = Number(ctx.rootEl.dataset.tolerance || 0);
      return Number.isFinite(v) && Number.isFinite(expected) && Number.isFinite(tol) && tol >= 0 && Math.abs(v - expected) <= tol;
    },
    reveal: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.value = ctx.rootEl.dataset.expected || "";
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 4. Fill Adapter */
  registerKind("fill", {
    label: "填空",
    mount: function (ctx) {
      var field = el("div", "q-field");
      var lab2 = el("label", "q-label", "填写答案");
      lab2.setAttribute("for", ctx.id + "-in");
      var inp2 = el("input", "q-input");
      inp2.id = ctx.id + "-in";
      inp2.autocomplete = "off";

      field.appendChild(lab2);
      field.appendChild(inp2);
      if (ctx.rootEl.dataset.unit) field.appendChild(el("span", "q-unit", ctx.rootEl.dataset.unit));
      ctx.body.appendChild(field);
      ctx.controls.input = inp2;
      inp2.addEventListener("input", function () { ctx.q.raw = inp2.value; });
      inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") ctx.bCheck.click(); });
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    judge: function (ctx) {
      var raw = ctx.controls.input ? ctx.controls.input.value : "";
      if (!raw.trim()) {
        ctx.feedback.textContent = "先填写答案。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = raw;
      var acc = [];
      try { acc = JSON.parse(ctx.rootEl.dataset.accepted || "[]"); } catch (e) { acc = []; }
      var cs = ctx.rootEl.dataset.caseSensitive === "true";
      return Array.isArray(acc) && acc.some(function (a) { return norm(a, cs) === norm(raw, cs); });
    },
    reveal: function (ctx) {
      try {
        var acc = JSON.parse(ctx.rootEl.dataset.accepted || "[]");
        if (ctx.controls.input && acc.length) ctx.controls.input.value = acc[0];
      } catch (e) {}
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 5. Open Question Adapter */
  registerKind("open", {
    label: "开放",
    checkButtonText: "保存并查看对照要点",
    mount: function (ctx) {
      var field3 = el("div", "q-field");
      var lab3 = el("label", "q-label", "写下你的纠正、条件与反例");
      lab3.setAttribute("for", ctx.id + "-in");
      var ta = el("textarea", "q-textarea");
      ta.id = ctx.id + "-in";
      var cnt = el("span", "q-count", "0 字");
      ta.addEventListener("input", function () {
        cnt.textContent = ta.value.length + " 字";
        ctx.q.raw = ta.value;
      });
      field3.appendChild(lab3);
      field3.appendChild(ta);
      field3.appendChild(cnt);
      ctx.body.appendChild(field3);
      ctx.controls.input = ta;
      if (ctx.keySrc) ctx.keySrc.remove();
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    submit: function (ctx) {
      var rawText = ctx.controls.input ? ctx.controls.input.value : "";
      if (!rawText.trim()) {
        if (ctx.controls.input) ctx.controls.input.focus();
        ctx.feedback.textContent = "先写下自己的回答。";
        ctx.feedback.dataset.tone = "info";
        return;
      }
      ctx.q.raw = rawText;
      ctx.q.attempts = 1;
      ctx.key.hidden = false;
      renderMath(ctx.key);
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
      ctx.bCheck.disabled = true;
      ctx.dispatch({ type: EVIDENCE.RAW_ANSWER, id: ctx.id, value: rawText });
      ctx.dispatch({ type: EVIDENCE.KEY_VIEWED, id: ctx.id });
      ctx.setState("saved", "info", "回答已保存，请对照要点自查差距。");
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 6. Dialogue Adapter */
  registerKind("dialogue", {
    label: "对话",
    checkButtonText: "保存本轮并继续",
    mount: function (ctx) {
      var wrap = el("div", "q-turns");
      var turns = [];
      if (ctx.turnsSrc) {
        Array.prototype.forEach.call(ctx.turnsSrc.children, function (li, i) {
          var t = el("div", "q-turn");
          t.hidden = i > 0;
          var promptText = li.dataset.prompt || li.textContent.trim();
          var p = el("label", "q-turn-prompt", promptText);
          p.setAttribute("for", ctx.id + "-t" + i);
          var ta2 = el("textarea", "q-textarea");
          ta2.id = ctx.id + "-t" + i;
          t.appendChild(p);
          t.appendChild(ta2);
          wrap.appendChild(t);
          turns.push({ node: t, ta: ta2, guidance: li.dataset.guidance });
        });
        ctx.turnsSrc.remove();
      }
      ctx.body.appendChild(wrap);
      ctx.controls.turns = turns;
      ctx.controls.cur = 0;
    },
    getRawAnswer: function (ctx) {
      var turns = ctx.controls.turns || [];
      var cur = turns[ctx.controls.cur];
      return cur ? cur.ta.value : "";
    },
    submit: function (ctx) {
      var cur = ctx.controls.turns[ctx.controls.cur];
      if (!cur) return;
      var val = cur.ta.value;
      if (!val.trim()) {
        cur.ta.focus();
        ctx.feedback.textContent = "先留下自己的回答，再继续。";
        ctx.feedback.dataset.tone = "info";
        return;
      }
      cur.ta.readOnly = true;
      cur.node.dataset.done = "";
      ctx.q.attempts = ctx.controls.cur + 1;
      var turnId = String(ctx.controls.cur + 1);
      ctx.dispatch({ type: EVIDENCE.TURN_RAW, id: ctx.id, turn: turnId, value: val });
      ctx.dispatch({ type: EVIDENCE.TURN_SUBMITTED, id: ctx.id, turn: turnId });

      if (ctx.controls.cur + 1 < ctx.controls.turns.length) {
        ctx.controls.cur++;
        var nextTurn = ctx.controls.turns[ctx.controls.cur];
        nextTurn.node.hidden = false;
        if (nextTurn.guidance) ctx.setAssistance(nextTurn.guidance);
        nextTurn.ta.focus();
        if (ctx.controls.cur + 1 === ctx.controls.turns.length) ctx.bCheck.textContent = "保存最后一轮";
        ctx.setState("idle", "info", "上一轮已保留。请回答新的追问。");
      } else {
        ctx.bCheck.disabled = true;
        ctx.setState("saved", "info", "各轮回答已保留，可复制学习记录给老师评估。");
      }
      ctx.meta.textContent = "已完成 " + ctx.q.attempts + "/" + ctx.controls.turns.length + " 轮" + (ctx.q.hints ? " · 提示 " + ctx.q.hints : "");
    },
    lock: function (ctx) {
      if (ctx.controls.turns) {
        ctx.controls.turns.forEach(function (t) { t.ta.readOnly = true; });
      }
    }
  });

  /* ---- Modern Question Enhancer (Architecture §7.4) ---- */

  function enhanceModernQuestion(rootEl, index, store) {
    if (rootEl.dataset.kitEnhanced === "true") return;
    rootEl.dataset.kitEnhanced = "true";

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
      observedAssistance: null,
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

    var adapter = getKind(kind) || getKind("choice");

    var actions = el("div", "q-actions");
    var bHint = el("button", "btn ghost", "需要提示");
    bHint.type = "button";
    var defaultCheckText = adapter && adapter.checkButtonText ? adapter.checkButtonText : "检查答案";
    var bCheck = el("button", "btn primary", defaultCheckText);
    bCheck.type = "button";
    var bReveal = el("button", "btn", "查看答案");
    bReveal.type = "button";
    bReveal.hidden = true;

    if (hintNodes.length) actions.appendChild(bHint);
    actions.appendChild(bCheck);
    actions.appendChild(bReveal);

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    function setAssistance(level) {
      if (q.observedAssistance === "ai_guided") return;
      if (level === "ai_guided" || (q.observedAssistance !== "with_hints" && level === "with_hints")) {
        q.observedAssistance = level;
      }
      rootEl.dataset.observedAssistance = q.observedAssistance;
      dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: q.observedAssistance });
    }

    function setState(s, tone, msg) {
      q.verdict = s;
      rootEl.dataset.state = s;
      rootEl.dataset.attempts = String(q.attempts);
      rootEl.dataset.hintUsed = q.hints > 0 ? "true" : "false";
      if (q.observedAssistance) {
        rootEl.dataset.observedAssistance = q.observedAssistance;
      }

      stateChip.textContent = STATE_LABEL[s] || s;
      feedback.textContent = msg || "";
      feedback.dataset.tone = tone || "";
      feedback.dataset.state = s;

      var parts = [];
      if (q.attempts) parts.push("第 " + q.attempts + " 次作答");
      if (q.hints) parts.push("提示 " + q.hints + "/" + hintNodes.length);
      if (s === "correct" || s === "saved") {
        parts.push(q.hints > 0 ? (q.observedAssistance === "ai_guided" ? "AI引导" : "用过提示") : "未用提示");
      }
      meta.textContent = parts.join(" · ");
      updateSummary();
    }

    function lock() {
      rootEl.dataset.locked = "";
      actions.querySelectorAll("button").forEach(function (b) {
        if (b !== bReveal) b.disabled = true;
      });
      if (adapter && adapter.lock) {
        adapter.lock(ctx);
      }
      bReveal.hidden = true;
    }

    var ctx = {
      rootEl: rootEl,
      id: id,
      kind: kind,
      body: body,
      stem: stem,
      optsSrc: optsSrc,
      keySrc: keySrc,
      turnsSrc: turnsSrc,
      explain: explain,
      key: key,
      q: q,
      dispatch: dispatch,
      renderMath: renderMath,
      bCheck: bCheck,
      bReveal: bReveal,
      feedback: feedback,
      meta: meta,
      setState: setState,
      setAssistance: setAssistance,
      lock: lock,
      controls: controls
    };

    if (adapter && adapter.mount) {
      adapter.mount(ctx);
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

    bCheck.addEventListener("click", function () {
      if (adapter && adapter.submit) {
        adapter.submit(ctx);
        return;
      }

      if (!adapter || !adapter.judge) return;
      var ok = adapter.judge(ctx);
      if (ok === null) return;
      q.attempts++;

      var rawAns = adapter.getRawAnswer ? adapter.getRawAnswer(ctx) : q.raw;
      q.raw = rawAns;
      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: rawAns });
      dispatch({ type: EVIDENCE.ATTEMPT, id: id });
      dispatch({ type: EVIDENCE.VERDICT, id: id, value: ok ? "correct" : "incorrect" });

      if (ok) {
        if (adapter.reveal) adapter.reveal(ctx, true);
        explain.hidden = false;
        renderMath(explain);
        lock();
        setState("correct", "correct", "回答正确。请用一句话说明判断依据。");
      } else {
        if (adapter.reveal) adapter.reveal(ctx, false);
        var left = maxAttempts - q.attempts;
        if (left <= 0) bReveal.hidden = false;
        bCheck.textContent = "再检查一次";
        setState("incorrect", "incorrect", left > 0 ?
          "还不对，再检查题干条件。还可以再试 " + left + " 次。" :
          "还不对。可以继续尝试，或查看答案与解析。");
      }
    });

    bReveal.addEventListener("click", function () {
      if (adapter && adapter.reveal) adapter.reveal(ctx, true);
      explain.hidden = false;
      renderMath(explain);
      lock();
      dispatch({ type: EVIDENCE.KEY_VIEWED, id: id });
      setAssistance("answer_revealed");
      setState("incorrect", "incorrect", "已显示答案。回头想想：当时哪一步判断偏了？");
      q.revealed = true;
    });

    setState("idle", "", "");
    meta.textContent = "";
  }

  /* ---- Main Init ---- */

  var questionsInitialized = false;

  function initQuestions() {
    if (questionsInitialized) return;
    questionsInitialized = true;
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

    // Support legacy answer elements ([data-answer-input] + [data-answer-check])
    var legacySelector = "[data-question-id]:has([data-answer-input]), section[data-question-id][data-answer-kind]";
    var legacyEls = Array.prototype.slice.call(document.querySelectorAll(legacySelector));
    legacyEls.forEach(function (task) {
      if (task.dataset.kitEnhanced === "true") return;
      task.dataset.kitEnhanced = "true";
      var id = task.dataset.questionId;
      var input = task.querySelector("[data-answer-input]");
      var button = task.querySelector("[data-answer-check]");
      var feedback = task.querySelector("[data-role~=answer-feedback]") || task.querySelector("[data-role=answer-feedback]");
      function normalize(value) {
        var text = String(value).normalize("NFKC").trim();
        return task.dataset.caseSensitive === "true" ? text : text.toLocaleLowerCase();
      }
      if (input) {
        input.addEventListener("input", function () {
          var curStore = (lesson && lesson.__evidenceStore) || store;
          if (curStore && curStore.dispatch) {
            curStore.dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: input.value });
          }
        });
      }
      if (button && input) {
        button.addEventListener("click", function () {
          var raw = input.value;
          if (!raw.trim()) {
            if (feedback) feedback.textContent = "先填写答案。";
            return;
          }
          var correct = false;
          if (task.dataset.answerKind === "numeric") {
            var value = Number(raw), expected = Number(task.dataset.expected);
            var tolerance = Number(task.dataset.tolerance || 0);
            correct = Number.isFinite(value) && Number.isFinite(expected) && Number.isFinite(tolerance) && tolerance >= 0 && Math.abs(value - expected) <= tolerance;
          } else {
            var accepted = [];
            try { accepted = JSON.parse(task.dataset.accepted || "[]"); } catch (e) { accepted = []; }
            correct = Array.isArray(accepted) && accepted.some(function (answer) {
              return typeof answer === "string" && normalize(answer) === normalize(raw);
            });
          }
          var curStore = (lesson && lesson.__evidenceStore) || store;
          if (curStore && curStore.dispatch) {
            curStore.dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: raw });
            curStore.dispatch({ type: EVIDENCE.ATTEMPT, id: id });
            curStore.dispatch({ type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect" });
          }
          if (feedback) {
            feedback.textContent = correct ? (task.dataset.correctText || "本题正确。请解释依据。") : (task.dataset.incorrectText || "再检查条件与方法。");
            feedback.dataset.state = correct ? "correct" : "incorrect";
          }
        });
      }
    });

    updateSummary();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("learning.question");
    }
  }

  kit.question = {
    registerKind: registerKind,
    getKind: getKind,
    adapters: kindAdapters,
    enhance: enhanceModernQuestion,
    updateSummary: updateSummary,
    init: initQuestions
  };

  if (kit.registerModule) {
    kit.registerModule("learning.question", kit.question);
  }

  // Standalone fallback: only listen to DOMContentLoaded if not managed by kit registry
  if (!kit.registerModule && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initQuestions);
    else initQuestions();
  }
})(typeof window !== "undefined" ? window : globalThis);
