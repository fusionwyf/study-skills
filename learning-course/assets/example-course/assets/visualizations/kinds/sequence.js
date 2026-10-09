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

  function validateSequence(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.steps) && !Array.isArray(config.input)) throw new Error("sequence 需要 steps 或 input");
    if (config.input) core.selectionSortTrace(config.input);
    if (config.steps && (!config.steps.length || config.steps.some(function (step) { return !step || typeof step !== "object" || !(step.title || step.summary || step.message); }))) throw new Error("sequence 每个 step 需要 title、summary 或 message");
    return config;
  }

  function renderSequence(node, config) {
    var states = config.steps || core.selectionSortTrace(config.input), index = 0;
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), controls = h.find(node, "[data-viz-controls]");
    var slider = controls && controls.querySelector("input[type=range]");
    if (slider) slider.max = states.length - 1;

    function paint() {
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
      if (prev) prev.addEventListener("click", function () { if (index) { index--; paint(); } });
      if (next) next.addEventListener("click", function () { if (index < states.length - 1) { index++; paint(); } });
      if (slider) slider.addEventListener("input", function () { index = Number(slider.value); paint(); });
    }
    paint();
  }

  core.registerKind("sequence", {validate: validateSequence, render: renderSequence});
}(typeof window !== "undefined" ? window : globalThis));
