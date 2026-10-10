/*
 * Course evidence runtime.
 *
 * One evidence store holds every question's interaction state; every
 * component is a LearnKit-registered view that renders from store
 * snapshots. No component writes interaction state straight to a shared
 * DOM dataset, and the learning-record builder reads the store rather than
 * re-scraping the page. LearnKit stays subject-neutral: this file owns
 * course evidence semantics, learnkit.js owns the state engine + registry.
 *
 * Requires learnkit.js to load first (LearnKit.createStore / registerView).
 * Without JavaScript every component keeps its readable markup; without
 * LearnKit the file degrades to copy buttons plus the static page.
 */
(function (root) {
  "use strict";

  var LearnKit = root.LearnKit;

  /* ---------------- Evidence model ---------------- */

  // Every interaction is an action on one store, so component state is
  // addressable by question id instead of living in scattered datasets.
  var EVIDENCE = {
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

  function emptyQuestion() {
    return {
      attempts: 0,
      hintUsed: false,
      answerViewed: false,
      observedAssistance: null,
      independence: "",
      rawAnswer: "",
      verdict: "",
      turns: {}
    };
  }

  function withQuestion(state, id, mutate) {
    var base = state.questions[id] ? state : LearnKit.setPath(state, "questions." + id, emptyQuestion());
    return mutate(base, "questions." + id);
  }

  // ai_guided is sticky: once observed, weaker self-reports cannot overwrite it.
  function strongerAssistance(current, incoming) {
    if (current === "ai_guided") return current;
    return incoming || current;
  }

  function evidenceModel() {
    return {
      initialState: function () { return {questions: {}}; },
      reduce: function (state, action) {
        var id = action.id;
        if (!id) return state;
        switch (action.type) {
          case EVIDENCE.ATTEMPT:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".attempts",
                Number(LearnKit.getPath(s, prefix + ".attempts") || 0) + 1);
            });
          case EVIDENCE.HINT:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".hintUsed", true);
            });
          case EVIDENCE.RAW_ANSWER:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".rawAnswer", action.value);
            });
          case EVIDENCE.VERDICT:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".verdict", action.value);
            });
          case EVIDENCE.KEY_VIEWED:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".answerViewed", true);
            });
          case EVIDENCE.TURN_RAW:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".turns." + action.turn + ".raw", action.value);
            });
          case EVIDENCE.TURN_SUBMITTED:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".turns." + action.turn + ".submitted", true);
            });
          case EVIDENCE.INDEPENDENCE:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".independence", action.value);
            });
          case EVIDENCE.OBSERVED_ASSISTANCE:
            return withQuestion(state, id, function (s, prefix) {
              return LearnKit.setPath(s, prefix + ".observedAssistance",
                strongerAssistance(LearnKit.getPath(s, prefix + ".observedAssistance") || null, action.value));
            });
          default:
            return state;
        }
      },
      derive: function (state) {
        var ids = Object.keys(state.questions);
        var answered = ids.filter(function (id) {
          var q = state.questions[id];
          return !!String(q.rawAnswer || "").trim() || Object.keys(q.turns).length > 0;
        });
        return {
          summary: ids.length ? answered.length + "/" + ids.length + " 题已有作答" : "",
          questions: state.questions,
          hasContent: answered.length > 0
        };
      }
    };
  }

  /* ---------------- Shared helpers ---------------- */

  function copyText(value, done, failed) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(failed);
      return;
    }
    var area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); done(); }
    catch (error) { failed(); }
    finally { area.remove(); }
  }

  function plainText(node) {
    return node ? node.textContent.trim() : "";
  }

  function selectedLabels(node) {
    return Array.prototype.slice.call(
      node.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')
    ).map(function (input) {
      var label = input.closest("label");
      return label ? label.textContent.trim() : input.value;
    });
  }

  function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "section";
  }

  /* ---------------- Views ---------------- */
  // Each factory returns {update(el, snapshot)}. Event wiring happens once at
  // creation; rendering happens in update so one state change repaints all.

  function quizView(ctx) {
    var el = ctx.el;
    var id = el.dataset.questionId;
    var submit = el.querySelector("[data-quiz-submit]");
    var feedback = el.querySelector(".quiz-feedback");

    function paintFeedback(q) {
      if (!feedback || !q.verdict) return;
      feedback.dataset.state = q.verdict;
      feedback.textContent = q.verdict === "correct"
        ? (el.dataset.correctText || "正确。请说明判断依据。")
        : (el.dataset.incorrectText || "再检查题目条件和规则边界。");
      feedback.setAttribute("role", "status");
    }

    if (submit) {
      submit.addEventListener("click", function () {
        var inputs = Array.prototype.slice.call(el.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        var selected = inputs.filter(function (input) { return input.checked; });
        if (!selected.length) {
          if (feedback) { feedback.textContent = "先选择一个答案，再检查。"; feedback.dataset.state = ""; }
          return;
        }
        var correctInputs = inputs.filter(function (input) { return input.dataset.correct === "true"; });
        var correct = selected.length === correctInputs.length &&
          selected.every(function (input) { return input.dataset.correct === "true"; });
        ctx.dispatch({type: EVIDENCE.ATTEMPT, id: id});
        ctx.dispatch({type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect"});
      });
    }
    return {
      update: function (el, snapshot) {
        var q = snapshot.derived.questions[id] || emptyQuestion();
        el.dataset.attempts = String(q.attempts);
        el.dataset.hintUsed = q.hintUsed ? "true" : "false";
        el.dataset.independence = q.independence || "";
        paintFeedback(q);
      }
    };
  }

  function answerView(ctx) {
    var task = ctx.el, id = task.dataset.questionId;
    var input = task.querySelector("[data-answer-input]"), button = task.querySelector("[data-answer-check]");
    var feedback = task.querySelector("[data-role~=answer-feedback]");
    function normalize(value) {
      var text = String(value).normalize("NFKC").trim();
      return task.dataset.caseSensitive === "true" ? text : text.toLocaleLowerCase();
    }
    if (!input || !button) return {update: function () {}};
    input.addEventListener("input", function () { ctx.dispatch({type: EVIDENCE.RAW_ANSWER, id: id, value: input.value}); });
    button.addEventListener("click", function () {
      var raw = input.value;
      if (!raw.trim()) { if (feedback) feedback.textContent = "先填写答案。"; return; }
      var correct = false;
      if (task.dataset.answerKind === "numeric") {
        var value = Number(raw), expected = Number(task.dataset.expected);
        var tolerance = Number(task.dataset.tolerance || 0);
        correct = Number.isFinite(value) && Number.isFinite(expected) && Number.isFinite(tolerance) && tolerance >= 0 && Math.abs(value - expected) <= tolerance;
      } else {
        var accepted; try { accepted = JSON.parse(task.dataset.accepted || "[]"); } catch (error) { accepted = []; }
        correct = Array.isArray(accepted) && accepted.some(function (answer) { return typeof answer === "string" && normalize(answer) === normalize(raw); });
      }
      ctx.dispatch({type: EVIDENCE.RAW_ANSWER, id: id, value: raw});
      ctx.dispatch({type: EVIDENCE.ATTEMPT, id: id});
      ctx.dispatch({type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect"});
    });
    return {update: function (el, snapshot) {
      var q = snapshot.derived.questions[id] || emptyQuestion();
      if (feedback && q.verdict) {
        feedback.textContent = q.verdict === "correct" ? task.dataset.correctText || "本题正确。请解释依据。" : task.dataset.incorrectText || "再检查条件与方法。";
        feedback.dataset.state = q.verdict; feedback.setAttribute("role", "status");
      }
    }};
  }

  function hintView(ctx) {
    var button = ctx.el;
    var question = button.closest("[data-question-id]");
    var id = question ? question.dataset.questionId : null;
    button.addEventListener("click", function () {
      var targetId = button.getAttribute("aria-controls");
      var target = targetId ? document.getElementById(targetId) : null;
      if (target) target.hidden = false;
      button.disabled = true;
      if (!id) return;
      ctx.dispatch({type: EVIDENCE.HINT, id: id});
      ctx.dispatch({type: EVIDENCE.OBSERVED_ASSISTANCE, id: id,
        value: button.dataset.guidance === "ai_guided" ? "ai_guided" : "with_hints"});
    });
    return {update: function () {}};
  }

  function teachingTargetView(ctx) {
    var task = ctx.el;
    var id = task.dataset.questionId;
    var check = task.querySelector("[data-teaching-check]");
    var answer = task.querySelector("textarea");
    var key = task.querySelector("[data-teaching-key]");
    if (check && answer && key) {
      key.hidden = true;
      check.hidden = false;
      check.addEventListener("click", function () {
        if (!answer.value.trim()) { answer.focus(); return; }
        ctx.dispatch({type: EVIDENCE.RAW_ANSWER, id: id, value: answer.value});
        ctx.dispatch({type: EVIDENCE.KEY_VIEWED, id: id});
        answer.readOnly = true;
        key.hidden = false;
        check.disabled = true;
      });
    }
    return {
      update: function (el, snapshot) {
        var q = snapshot.derived.questions[id];
        if (q && q.answerViewed) el.dataset.answerViewed = "true";
      }
    };
  }

  function dialogueView(ctx) {
    var dialogue = ctx.el;
    var id = dialogue.dataset.questionId;
    var turns = Array.prototype.slice.call(dialogue.querySelectorAll("[data-dialogue-turn]"));
    var next = dialogue.querySelector("[data-dialogue-next]");
    var status = dialogue.querySelector("[data-dialogue-status]");
    var current = 0;
    var ready = turns.length && next && !turns.some(function (t) { return !t.querySelector("textarea"); });
    if (ready) {
      turns.forEach(function (turn, index) { turn.hidden = index > 0; });
      next.hidden = false;
      next.addEventListener("click", function () {
        var turn = turns[current];
        var answer = turn.querySelector("textarea");
        if (!answer.value.trim()) {
          if (status) status.textContent = "先留下自己的回答，再继续。";
          answer.focus();
          return;
        }
        var turnId = turn.dataset.dialogueTurn;
        ctx.dispatch({type: EVIDENCE.TURN_RAW, id: id, turn: turnId, value: answer.value});
        ctx.dispatch({type: EVIDENCE.TURN_SUBMITTED, id: id, turn: turnId});
        answer.readOnly = true;
        if (current + 1 < turns.length) {
          current += 1;
          turns[current].hidden = false;
          var guidance = turns[current].dataset.guidance;
          if (guidance === "with_hints" || guidance === "ai_guided") {
            ctx.dispatch({type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: guidance});
          }
          turns[current].querySelector("textarea").focus();
          if (status) status.textContent = "上一轮已保留。请回答新的追问。";
          if (current + 1 === turns.length) next.textContent = "保存最后一轮";
        } else {
          next.disabled = true;
          if (status) status.textContent = "各轮回答已保留，可复制学习记录给老师评估。";
        }
      });
    }
    return {
      update: function (el, snapshot) {
        var q = snapshot.derived.questions[id];
        if (!q) return;
        dialogue.dataset.attempts = String(Object.keys(q.turns).length);
      }
    };
  }

  function independenceView(ctx) {
    var question = ctx.el;
    var id = question.dataset.questionId;
    if (!id || question.querySelector("[data-independence]")) return {update: function () {}};
    var label = document.createElement("label");
    label.className = "assistance-report";
    label.textContent = "这次作答用了哪些帮助？ ";
    var select = document.createElement("select");
    select.setAttribute("data-independence", "");
    [["", "尚未说明"], ["independent", "独立完成，没有 AI 提示"],
     ["with_hints", "用过提示，自己完成"], ["ai_guided", "AI 引导了关键步骤"]].forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry[0];
      option.textContent = entry[1];
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      var q = ctx.getQuestions()[id];
      var observed = q && q.observedAssistance;
      var value = select.value;
      if (observed && value === "independent") value = observed;
      if (observed === "ai_guided" && value === "with_hints") value = observed;
      select.value = value;
      ctx.dispatch({type: EVIDENCE.INDEPENDENCE, id: id, value: value});
    });
    label.appendChild(select);
    question.appendChild(label);
    return {
      update: function (el, snapshot) {
        var q = snapshot.derived.questions[id];
        if (q && select.value !== q.independence) select.value = q.independence || "";
      }
    };
  }

  function stepView(ctx) {
    var next = ctx.el;
    // The control sits in a sibling `.steps-controls`, so scope to the closest
    // shared container that also holds the `.step` items.
    var scope = next.closest("[data-steps-scope]") ||
      next.closest("section, .card, .lesson") ||
      next.parentElement;
    var items = scope ? Array.prototype.slice.call(scope.querySelectorAll(".step")) : [];
    if (items.length < 2) return {update: function () {}};
    next.addEventListener("click", function () {
      var hidden = items.findIndex(function (item) { return item.classList.contains("is-hidden"); });
      if (hidden >= 0) items[hidden].classList.remove("is-hidden");
      else next.disabled = true;
    });
    return {update: function () {}};
  }

  function copyCodeView(ctx) {
    var block = ctx.el;
    if (block.querySelector(".copy-code")) return {update: function () {}};
    var button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code";
    button.textContent = "复制";
    button.setAttribute("aria-label", "复制代码");
    button.addEventListener("click", function () {
      var reset = function () { setTimeout(function () { button.textContent = "复制"; }, 1200); };
      var pre = block.querySelector("pre");
      copyText(pre ? pre.innerText : "",
        function () { button.textContent = "已复制"; reset(); },
        function () { button.textContent = "请手动复制"; reset(); });
    });
    block.appendChild(button);
    return {update: function () {}};
  }

  function autoTocView(ctx) {
    var toc = ctx.el;
    var lesson = document.querySelector(".lesson");
    if (!lesson) return {update: function () {}};
    var list = document.createElement("ol");
    lesson.querySelectorAll("h2, h3").forEach(function (heading) {
      if (!heading.id) heading.id = slugify(heading.textContent);
      var item = document.createElement("li");
      if (heading.tagName.toLowerCase() === "h3") item.style.marginLeft = "0.75rem";
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      item.appendChild(link);
      list.appendChild(item);
    });
    toc.appendChild(list);
    return {update: function () {}};
  }

  /* ---------------- Learning record (reads the store, not the DOM) ---------------- */

  function multiline(value) {
    return String(value || "未填写").replace(/\r?\n/g, "\n  ");
  }

  // Raw text never leaves the DOM for open answers until the learner locks it,
  // so the record prefers the locked store value and falls back to the field.
  function fieldAnswer(node) {
    var selected = selectedLabels(node);
    if (selected.length) return selected.join("；");
    var field = node.querySelector("textarea, input:not([type=radio]):not([type=checkbox])");
    return field && field.value.trim() ? field.value.trim() : "";
  }

  function buildLearningRecord(lesson, state) {
    var questions = state.questions || {};
    var lines = [
      "# 学习记录",
      "",
      "- course_id: " + (lesson.dataset.courseId || "unknown"),
      "- lesson: " + (lesson.dataset.lessonId || "unknown"),
      "- objective_id: " + (lesson.dataset.objective || "unknown"),
      "",
      "## 练习记录"
    ];
    var ids = Object.keys(questions);
    var hasContent = false;
    if (!ids.length) lines.push("", "未设置结构化练习。");
    ids.forEach(function (id) {
      var q = questions[id];
      var node = lesson.querySelector('[data-question-id="' + id + '"]');
      var answer = q.rawAnswer || (node ? fieldAnswer(node) : "");
      if (String(answer || "").trim()) hasContent = true;
      if (Object.keys(q.turns).length) hasContent = true;
      var result = node && node.dataset.answerKind === "open"
        ? "not-applicable"
        : (q.verdict || "not-checked");
      lines.push(
        "",
        "### " + id,
        "",
        "- 原始答案: " + multiline(answer),
        "- 检查次数: " + q.attempts,
        "- 使用提示: " + (q.hintUsed ? "是" : "否"),
        "- 辅助情况（学习者自述）: " + (q.independence || "unknown"),
        "- 页面观察到的帮助: " + (q.observedAssistance || "未观察到；不代表没有外部帮助"),
        "- 已查看对照要点: " + (q.answerViewed ? "是（作答后）" : "否"),
        "- 即时判定: " + result
      );
      Object.keys(q.turns).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (turnId) {
        var turn = q.turns[turnId];
        var turnNode = node ? node.querySelector('[data-dialogue-turn="' + turnId + '"]') : null;
        var field = turnNode ? turnNode.querySelector("textarea") : null;
        var raw = turn.raw || (field ? field.value : "");
        if (String(raw || "").trim()) hasContent = true;
        lines.push("", "#### 轮次 " + turnId,
          "- 追问: " + multiline(turnNode ? plainText(turnNode.querySelector("[data-dialogue-prompt]")) : ""),
          "- 原始回答: " + multiline(raw),
          "- 已提交: " + (turn.submitted ? "是" : "否"),
          "- 已展示: " + (turnNode && turnNode.hidden ? "否" : "是"),
          "- 追问类型: " + (turnNode ? (turnNode.dataset.guidance || "question") : "question"));
      });
    });

    var visualizations = lesson.querySelectorAll("[data-visualization]");
    if (visualizations.length) {
      lines.push("", "## 可视化观察（当前状态；不代表完成练习）");
      visualizations.forEach(function (node) {
        lines.push("", "### " + (node.id || node.dataset.visualization),
          "- 渲染状态: " + (node.dataset.vizReady || "not-loaded"),
          "- 当前参数/步骤: " + (node.dataset.visualState || "unknown"));
      });
    }

    lesson.querySelectorAll("[data-media]").forEach(function (node) {
      lines.push("", "### 媒体观察 " + (node.id || "media"),
        "- 初始化状态: " + (node.dataset.mediaReady || "not-loaded"),
        "- 热点选择: " + (node.dataset.mediaState || "unknown"));
    });

    var runtimes = lesson.querySelectorAll("[data-learnkit]");
    if (runtimes.length) {
      lines.push("", "## LearnKit 运行时观察（当前状态；不代表完成练习）");
      runtimes.forEach(function (node) {
        lines.push("", "### " + (node.id || node.dataset.learnkit),
          "- 初始化状态: " + (node.dataset.lkReady || "not-loaded"),
          "- 当前状态: " + (node.dataset.visualState || "unknown"));
      });
    }

    lines.push("", "## 学习者反馈");
    var reflections = [];
    lesson.querySelectorAll(".reflection label").forEach(function (label) {
      var field = document.getElementById(label.htmlFor);
      if (field && field.value.trim()) {
        hasContent = true;
        reflections.push("", "### " + label.textContent.trim(), "", field.value.trim());
      }
    });
    if (reflections.length) lines = lines.concat(reflections);
    else lines.push("", "未填写额外反思。");
    return {text: lines.join("\n"), hasContent: hasContent};
  }

  /* ---------------- Wiring ---------------- */

  var VIEWS = [
    [".quiz[data-question-id]", quizView],
    ['[data-answer-kind="numeric"], [data-answer-kind="fill"]', answerView],
    ["[data-question-id]", independenceView],
    ["[data-hint]", hintView],
    ['[data-role~="teaching-target"]', teachingTargetView],
    ['[data-role~="dialogue-practice"]', dialogueView],
    ["[data-step-next]", stepView],
    [".code-block", copyCodeView],
    ["[data-auto-toc]", autoTocView]
  ];

  function mountViews(store) {
    var instances = [];
    VIEWS.forEach(function (entry) {
      Array.prototype.slice.call(document.querySelectorAll(entry[0])).forEach(function (el) {
        var ctx = {
          el: el,
          dispatch: function (action) { store.dispatch(action); },
          getQuestions: function () { return store.getState().questions; }
        };
        var view;
        try { view = entry[1](ctx); }
        catch (error) { return; }
        instances.push({el: el, view: view});
      });
    });
    return instances;
  }

  function init() {
    var lesson = document.querySelector(".lesson");
    if (!LearnKit || !lesson) {
      initPrintState();
      document.documentElement.dataset.courseReady = "true";
      return;
    }
    var store = LearnKit.createStore(evidenceModel());
    var instances = mountViews(store);

    // One subscription paints every view, so no component reaches into
    // another component's DOM to stay consistent.
    function paint(snapshot) {
      instances.forEach(function (entry) { entry.view.update(entry.el, snapshot, {store: store}); });
      if (snapshot.derived.summary) lesson.dataset.evidenceSummary = snapshot.derived.summary;
    }
    store.subscribe(paint);
    paint(store.snapshot()); // initial paint: datasets must be set on load

    Array.prototype.slice.call(document.querySelectorAll("[data-copy-feedback]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var status = lesson.querySelector("[data-copy-feedback-status]");
        var record = buildLearningRecord(lesson, store.getState());
        if (!record.hasContent) {
          if (status) status.textContent = "请先完成练习或填写反馈";
          return;
        }
        var reset = function () { setTimeout(function () { if (status) status.textContent = ""; }, 1800); };
        copyText(record.text,
          function () { if (status) status.textContent = "学习记录已复制"; reset(); },
          function () { if (status) status.textContent = "复制失败，请手动选择内容"; reset(); });
      });
    });

    initPrintState();
    lesson.__evidenceStore = store;
    document.documentElement.dataset.courseReady = "true";
    root.__COURSE_READY__ = true;
  }

  function initPrintState() {
    var params = new URLSearchParams(window.location.search);
    var exportMode = params.get("export");
    if (exportMode === "student" || exportMode === "review") {
      document.documentElement.dataset.exportMode = exportMode;
    }
    window.addEventListener("beforeprint", function () { document.documentElement.classList.add("is-printing"); });
    window.addEventListener("afterprint", function () { document.documentElement.classList.remove("is-printing"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}(typeof window !== "undefined" ? window : globalThis));
