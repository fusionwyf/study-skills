/* Dependency-free progressive enhancement for course components. */
(function () {
  "use strict";

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

  function textOfCode(block) {
    var pre = block.querySelector("pre");
    return pre ? pre.innerText : "";
  }

  function initCopyButtons() {
    document.querySelectorAll(".code-block").forEach(function (block) {
      if (block.querySelector(".copy-code")) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = "复制";
      button.setAttribute("aria-label", "复制代码");
      button.addEventListener("click", function () {
        var reset = function () { setTimeout(function () { button.textContent = "复制"; }, 1200); };
        copyText(textOfCode(block), function () { button.textContent = "已复制"; reset(); }, function () { button.textContent = "请手动复制"; reset(); });
      });
      block.appendChild(button);
    });
  }

  function selectedAnswers(question) {
    var selected = Array.prototype.slice.call(question.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked'));
    return selected.map(function (input) {
      var label = input.closest("label");
      return label ? label.textContent.trim() : input.value;
    });
  }

  function observeAssistance(question, value) {
    if (!question) return;
    if (question.dataset.observedAssistance !== "ai_guided") question.dataset.observedAssistance = value;
    var field = question.querySelector("[data-independence]");
    if (field && field.value === "independent") field.value = value;
  }

  function initIndependence() {
    document.querySelectorAll("[data-question-id]").forEach(function (question) {
      if (question.querySelector("[data-independence]")) return;
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
        var observed = question.dataset.observedAssistance;
        if (observed && select.value === "independent") select.value = observed;
        if (observed === "ai_guided" && select.value === "with_hints") select.value = observed;
      });
      label.appendChild(select);
      question.appendChild(label);
    });
  }

  function initDialogues() {
    document.querySelectorAll('[data-role~="dialogue-practice"]').forEach(function (dialogue) {
      var turns = Array.prototype.slice.call(dialogue.querySelectorAll("[data-dialogue-turn]"));
      var next = dialogue.querySelector("[data-dialogue-next]");
      var status = dialogue.querySelector("[data-dialogue-status]");
      if (!turns.length || !next || turns.some(function (turn) { return !turn.querySelector("textarea"); })) return;
      var current = 0;
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
        turn.dataset.rawAnswer = answer.value;
        turn.dataset.submitted = "true";
        answer.readOnly = true;
        dialogue.dataset.attempts = String(current + 1);
        if (current + 1 < turns.length) {
          current += 1;
          turns[current].hidden = false;
          var guidance = turns[current].dataset.guidance;
          if (guidance === "with_hints" || guidance === "ai_guided") observeAssistance(dialogue, guidance);
          turns[current].querySelector("textarea").focus();
          if (status) status.textContent = "上一轮已保留。请回答新的追问。";
          if (current + 1 === turns.length) next.textContent = "保存最后一轮";
        } else {
          next.disabled = true;
          if (status) status.textContent = "各轮回答已保留，可复制学习记录给老师评估。";
        }
      });
    });
  }

  function initTeachingTargets() {
    document.querySelectorAll('[data-role~="teaching-target"]').forEach(function (task) {
      var check = task.querySelector("[data-teaching-check]");
      var answer = task.querySelector("textarea");
      var key = task.querySelector("[data-teaching-key]");
      if (!check || !answer || !key) return;
      key.hidden = true;
      check.hidden = false;
      check.addEventListener("click", function () {
        if (!answer.value.trim()) { answer.focus(); return; }
        task.dataset.rawAnswer = answer.value;
        task.dataset.attempts = "1";
        answer.readOnly = true;
        key.hidden = false;
        check.disabled = true;
        task.dataset.answerViewed = "true";
      });
    });
  }

  function initQuizzes() {
    document.querySelectorAll(".quiz[data-question-id]").forEach(function (quiz) {
      quiz.dataset.attempts = quiz.dataset.attempts || "0";
      quiz.dataset.hintUsed = quiz.dataset.hintUsed || "false";
      var submit = quiz.querySelector("[data-quiz-submit]");
      var feedback = quiz.querySelector(".quiz-feedback");
      if (!submit || !feedback) return;
      submit.addEventListener("click", function () {
        var inputs = Array.prototype.slice.call(quiz.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        var selected = inputs.filter(function (input) { return input.checked; });
        if (!selected.length) {
          feedback.textContent = "先选择一个答案，再检查。";
          feedback.dataset.state = "";
          return;
        }
        quiz.dataset.attempts = String(Number(quiz.dataset.attempts || "0") + 1);
        var correctInputs = inputs.filter(function (input) { return input.dataset.correct === "true"; });
        var correct = selected.length === correctInputs.length && selected.every(function (input) { return input.dataset.correct === "true"; });
        feedback.textContent = correct ? (quiz.dataset.correctText || "正确。请说明判断依据。") : (quiz.dataset.incorrectText || "再检查题目条件和规则边界。");
        feedback.dataset.state = correct ? "correct" : "incorrect";
        feedback.setAttribute("role", "status");
      });
    });
  }

  function initHints() {
    document.querySelectorAll("[data-hint]").forEach(function (button) {
      button.addEventListener("click", function () {
        var question = button.closest("[data-question-id]");
        if (question) question.dataset.hintUsed = "true";
        observeAssistance(question, button.dataset.guidance === "ai_guided" ? "ai_guided" : "with_hints");
        var targetId = button.getAttribute("aria-controls");
        var target = targetId ? document.getElementById(targetId) : null;
        if (target) target.hidden = false;
        button.disabled = true;
      });
    });
  }

  function initSteps() {
    document.querySelectorAll(".steps").forEach(function (steps) {
      var items = Array.prototype.slice.call(steps.querySelectorAll(".step"));
      var next = steps.parentElement.querySelector("[data-step-next]");
      if (!next || items.length < 2) return;
      next.addEventListener("click", function () {
        var hidden = items.findIndex(function (item) { return item.classList.contains("is-hidden"); });
        if (hidden >= 0) items[hidden].classList.remove("is-hidden");
        else next.disabled = true;
      });
    });
  }

  function initPrintState() {
    var params = new URLSearchParams(window.location.search);
    var exportMode = params.get("export");
    if (exportMode === "student" || exportMode === "review") document.documentElement.dataset.exportMode = exportMode;
    window.addEventListener("beforeprint", function () { document.documentElement.classList.add("is-printing"); });
    window.addEventListener("afterprint", function () { document.documentElement.classList.remove("is-printing"); });
  }

  function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "section";
  }

  function initAutoToc() {
    document.querySelectorAll("[data-auto-toc]").forEach(function (toc) {
      var lesson = document.querySelector(".lesson");
      if (!lesson) return;
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
    });
  }

  function multiline(value) {
    return String(value || "未填写").replace(/\r?\n/g, "\n  ");
  }

  function buildLearningRecord(lesson) {
    var lines = [
      "# 学习记录",
      "",
      "- course_id: " + (lesson.dataset.courseId || "unknown"),
      "- lesson: " + (lesson.dataset.lessonId || "unknown"),
      "- objective_id: " + (lesson.dataset.objective || "unknown"),
      "",
      "## 练习记录"
    ];
    var hasContent = false;
    var questions = lesson.querySelectorAll("[data-question-id]");
    if (!questions.length) lines.push("", "未设置结构化练习。");
    questions.forEach(function (question) {
      var answer = selectedAnswers(question);
      if (!answer.length) {
        var field = question.querySelector("textarea, input:not([type=radio]):not([type=checkbox])");
        if (field && field.value.trim()) answer = [question.dataset.rawAnswer || field.value];
      }
      if (answer.length) hasContent = true;
      var feedback = question.querySelector(".quiz-feedback");
      var result = question.dataset.answerKind === "open" ? "not-applicable" : ((feedback && feedback.dataset.state) || "not-checked");
      var independence = question.querySelector("[data-independence]");
      lines.push(
        "",
        "### " + question.dataset.questionId,
        "",
        "- 原始答案: " + multiline(answer.join("；")),
        "- 检查次数: " + (question.dataset.attempts || "0"),
        "- 使用提示: " + (question.dataset.hintUsed === "true" ? "是" : "否"),
        "- 辅助情况（学习者自述）: " + ((independence && independence.value) || "unknown"),
        "- 页面观察到的帮助: " + (question.dataset.observedAssistance || "未观察到；不代表没有外部帮助"),
        "- 已查看对照要点: " + (question.dataset.answerViewed === "true" ? "是（作答后）" : "否"),
        "- 即时判定: " + result
      );
      question.querySelectorAll("[data-dialogue-turn]").forEach(function (turn) {
        var field = turn.querySelector("textarea");
        var raw = turn.dataset.rawAnswer || (field ? field.value : "");
        if (raw.trim()) hasContent = true;
        var prompt = turn.querySelector("[data-dialogue-prompt]");
        lines.push("", "#### 轮次 " + turn.dataset.dialogueTurn,
          "- 追问: " + multiline(prompt ? prompt.textContent : ""),
          "- 原始回答: " + multiline(raw),
          "- 已提交: " + (turn.dataset.submitted === "true" ? "是" : "否"),
          "- 已展示: " + (turn.hidden ? "否" : "是"),
          "- 追问类型: " + (turn.dataset.guidance || "question"));
      });
    });

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
    return { text: lines.join("\n"), hasContent: hasContent };
  }

  function initFeedbackCopy() {
    document.querySelectorAll("[data-copy-feedback]").forEach(function (button) {
      button.addEventListener("click", function () {
        var lesson = button.closest(".lesson");
        var status = lesson ? lesson.querySelector("[data-copy-feedback-status]") : null;
        if (!lesson) return;
        var record = buildLearningRecord(lesson);
        if (!record.hasContent) {
          if (status) status.textContent = "请先完成练习或填写反馈";
          return;
        }
        var reset = function () { setTimeout(function () { if (status) status.textContent = ""; }, 1800); };
        copyText(record.text, function () { if (status) status.textContent = "学习记录已复制"; reset(); }, function () { if (status) status.textContent = "复制失败，请手动选择内容"; reset(); });
      });
    });
  }

  function init() {
    initIndependence();
    initDialogues();
    initTeachingTargets();
    initCopyButtons();
    initQuizzes();
    initHints();
    initSteps();
    initPrintState();
    initAutoToc();
    initFeedbackCopy();
    document.documentElement.dataset.courseReady = "true";
    window.__COURSE_READY__ = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
