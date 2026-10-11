/*
 * Kind module: sequence — step playback.
 *
 * Plays a list of steps with previous/next/range controls, or derives the
 * steps from `input` when the content is an algorithm trace. No third-party
 * library: plain HTML driven by the shared runtime.
 *
 * Load after visualizations.js.
 */
(function (root) {
  "use strict";

  var core = root.CourseVisualizations;
  if (!core) return;
  var h = core.helpers;

  function selectionSortTrace(input) {
    if (!Array.isArray(input) || input.length < 2 || input.length > 32 || !input.every(h.finite)) throw new Error("序列输入需为 2–32 个有限数值");
    var values = input.slice(), states = [], comparisons = 0, swaps = 0;
    function save(line, message, active, sorted) { states.push({values: values.slice(), line: line, message: message, active: active, sorted: sorted, comparisons: comparisons, swaps: swaps}); }
    save(0, "初始序列；先预测第一轮会确定哪个位置。", [], 0);
    for (var i = 0; i < values.length - 1; i++) {
      var min = i;
      save(1, "设定当前位置 i = " + i + "，候选位置 min = " + min, [i], i);
      for (var j = i + 1; j < values.length; j++) {
        comparisons++;
        var smaller = values[j] < values[min];
        save(2, "比较位置 " + j + " 与候选位置 " + min + "；结果为 " + smaller, [j, min], i);
        if (smaller) { min = j; save(3, "候选位置更新为 " + min, [min], i); }
      }
      if (min !== i) { var temp = values[i]; values[i] = values[min]; values[min] = temp; swaps++; }
      save(4, "本轮结束；前 " + (i + 1) + " 个元素已就位。", [i, min], i + 1);
    }
    save(5, "排序完成，共比较 " + comparisons + " 次、交换 " + swaps + " 次。", [], values.length);
    return states;
  }


  // Compatibility API; algorithm computation belongs to this module.
  core.selectionSortTrace = selectionSortTrace;

  function validateSequence(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.steps) && !Array.isArray(config.input)) throw new Error("sequence 需要 steps 或 input");
    if (config.input) core.selectionSortTrace(config.input);
    if (config.steps && (!config.steps.length || config.steps.some(function (step) { return !step || typeof step !== "object" || !(step.title || step.summary || step.message); }))) throw new Error("sequence 每个 step 需要 title、summary 或 message");
    return config;
  }

  function renderSequence(node, config, context) {
    var states = config.steps || core.selectionSortTrace(config.input);
    var sourceStore = context && context.sourceStore;
    var index = sourceStore ? Number(sourceStore.getDerived().index) || 0 : 0;
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), controls = h.find(node, "[data-viz-controls]");
    var slider = controls && controls.querySelector("input[type=range]");
    if (slider) slider.max = states.length - 1;

    function paint() {
      index = Math.max(0, Math.min(states.length - 1, Number(index) || 0));
      var state = states[index];
      h.clear(host);
      var title = document.createElement("h3");
      title.textContent = state.title || state.summary || state.message || ("步骤 " + (index + 1));
      host.appendChild(title);
      if (state.values) {
        var list = document.createElement("ol");
        list.className = "viz-array";
        state.values.forEach(function (v, i) {
          var li = document.createElement("li");
          li.textContent = i + ": " + v;
          if (state.active && state.active.indexOf(i) !== -1) li.className = "is-active";
          if (state.sorted != null && i < state.sorted) li.classList.add("is-sorted");
          list.appendChild(li);
        });
        host.appendChild(list);
      }
      if (state.description || state.message) {
        var p = document.createElement("p");
        p.textContent = state.description || state.message;
        host.appendChild(p);
      }
      h.status(node, "步骤 " + (index + 1) + "/" + states.length);
      if (slider) slider.value = index;
      if (controls) {
        var prev = controls.querySelector("[data-viz-prev]"), next = controls.querySelector("[data-viz-next]");
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index === states.length - 1;
      }
      h.record(node, {kind: "sequence", step: index, total: states.length});
    }

    if (controls) {
      var prev = controls.querySelector("[data-viz-prev]"), next = controls.querySelector("[data-viz-next]");
      if (prev) prev.addEventListener("click", function () {
        if (sourceStore) sourceStore.dispatch({type: "STEP_PREVIOUS"});
        else if (index) { index--; paint(); }
      });
      if (next) next.addEventListener("click", function () {
        if (sourceStore) sourceStore.dispatch({type: "STEP_NEXT"});
        else if (index < states.length - 1) { index++; paint(); }
      });
      if (slider) slider.addEventListener("input", function () {
        if (sourceStore) sourceStore.dispatch({type: "SEEK", index: Number(slider.value)});
        else { index = Number(slider.value); paint(); }
      });
    }
    paint();
    return sourceStore ? {update: function (nodeElement, nodeConfig, snapshot) {
      index = Number(snapshot.derived.index) || 0;
      paint();
    }} : null;
  }

  core.registerKind("sequence", {validate: validateSequence, render: renderSequence});
}(typeof window !== "undefined" ? window : globalThis));
