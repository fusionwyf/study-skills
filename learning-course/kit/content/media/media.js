(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initMedia() {
    if (typeof document === "undefined") return;
    var nodes = document.querySelectorAll("[data-media]");
    if (!nodes.length) {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.media");
      return;
    }

    nodes.forEach(function (node) {
      if (node.dataset.mediaInitialized === "true") return;
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

        if (frame) {
          var oldButtons = frame.querySelectorAll(".media-hotspot");
          oldButtons.forEach(function (btn) {
            btn.parentNode && btn.parentNode.removeChild(btn);
          });
        }

        var task = node.closest("[data-question-id]"),
          field = task && task.querySelector("textarea"),
          lesson = node.closest(".lesson");
        var questionId = task
          ? task.dataset.questionId
          : node.dataset.mediaQuestion;
        node
          .querySelectorAll("details[data-media-transcript]")
          .forEach(function (transcript) {
            function recordTranscript() {
              var curStore = (lesson && lesson.__evidenceStore) || (document.querySelector(".lesson") && document.querySelector(".lesson").__evidenceStore);
              if (!transcript.open || !curStore || !questionId) return;
              curStore.dispatch({ type: "KEY_VIEWED", id: questionId });
              curStore.dispatch({
                type: "OBSERVED_ASSISTANCE",
                id: questionId,
                value: "with_hints",
              });
            }
            transcript.addEventListener("toggle", recordTranscript);
            recordTranscript();
          });
        if (field)
          field.addEventListener("input", function () {
            var curStore = (lesson && lesson.__evidenceStore) || (document.querySelector(".lesson") && document.querySelector(".lesson").__evidenceStore);
            if (curStore) {
              curStore.dispatch({
                type: "RAW_ANSWER",
                id: task.dataset.questionId,
                value: field.value,
              });
            }
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
        node.dataset.mediaInitialized = "true";
        node.dataset.mediaState = JSON.stringify({ selected: [] });
        node.dataset.mediaReady = "true";
      } catch (error) {
        node.dataset.mediaReady = "failed";
        var st = node.querySelector("[data-media-status]");
        if (st) st.textContent = error.message;
      }
    });

    if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.media");
  }

  kit.media = {
    init: initMedia
  };

  if (kit.registerModule) {
    kit.registerModule("content.media", kit.media);
  }

  if (!kit.registerModule && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMedia);
    else initMedia();
  }
})(typeof window !== "undefined" ? window : globalThis);
