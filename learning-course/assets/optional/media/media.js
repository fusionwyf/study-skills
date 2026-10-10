/* Optional image hotspot annotations; native audio/video remain functional without JS. */
(function (root) {
  "use strict";
  function init() {
    document.querySelectorAll("[data-media]").forEach(function (node) {
      try {
        var script = node.querySelector("[data-media-config]"),
          config = script ? JSON.parse(script.textContent) : { hotspots: [] };
        var image = node.querySelector("img"),
          frame = node.querySelector("[data-media-frame]"),
          status = node.querySelector("[data-media-status]");
        var hotspots = config.hotspots || [];
        if (!Array.isArray(hotspots)) throw new Error("hotspots 必须为数组");
        var ids = [];
        hotspots.forEach(function (h) {
          if (
            !h ||
            typeof h.id !== "string" ||
            !h.id ||
            ids.indexOf(h.id) >= 0 ||
            typeof h.label !== "string" ||
            !h.label.trim() ||
            !Number.isFinite(h.x) ||
            !Number.isFinite(h.y) ||
            h.x < 0 ||
            h.x > 100 ||
            h.y < 0 ||
            h.y > 100
          )
            throw new Error("热点需要唯一 id、label 与 0..100 的 x/y");
          ids.push(h.id);
        });
        if (hotspots.length && (!image || !frame || !image.alt))
          throw new Error("图片标注需要带 alt 的 img 与 data-media-frame");
        var task = node.closest("[data-question-id]"),
          field = task && task.querySelector("textarea"),
          lesson = node.closest(".lesson"),
          store = lesson && lesson.__evidenceStore;
        var questionId = task
          ? task.dataset.questionId
          : node.dataset.mediaQuestion;
        node
          .querySelectorAll("details[data-media-transcript]")
          .forEach(function (transcript) {
            function recordTranscript() {
              if (!transcript.open || !store || !questionId) return;
              store.dispatch({ type: "KEY_VIEWED", id: questionId });
              store.dispatch({
                type: "OBSERVED_ASSISTANCE",
                id: questionId,
                value: "with_hints",
              });
            }
            transcript.addEventListener("toggle", recordTranscript);
            recordTranscript();
          });
        if (field && store)
          field.addEventListener("input", function () {
            store.dispatch({
              type: "RAW_ANSWER",
              id: task.dataset.questionId,
              value: field.value,
            });
          });
        var selected = [];
        hotspots.forEach(function (h, index) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "media-hotspot";
          button.style.left = h.x + "%";
          button.style.top = h.y + "%";
          button.textContent = String(index + 1);
          button.setAttribute("aria-label", h.label);
          button.addEventListener("click", function () {
            if (selected.indexOf(h.id) < 0) selected.push(h.id);
            if (status)
              status.textContent =
                h.label + (h.description ? "：" + h.description : "");
            node.dataset.mediaState = JSON.stringify({
              selected: selected.slice(),
            });
          });
          frame.appendChild(button);
        });
        node.dataset.mediaState = JSON.stringify({ selected: [] });
        node.dataset.mediaReady = "true";
      } catch (error) {
        node.dataset.mediaReady = "failed";
        var status = node.querySelector("[data-media-status]");
        if (status) status.textContent = error.message;
      }
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
