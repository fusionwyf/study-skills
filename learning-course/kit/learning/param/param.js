/*
 * learning.param — 参数联动原语 (Scrubbable parameter)
 *
 * 作者契约（两种等价写法）:
 *   <kit-param data-param="mass" data-min="0.5" data-max="5" data-step="0.1"
 *              data-value="1" data-unit="kg" data-label="质量"></kit-param>
 *   <input type="range" data-param="mass" min="0.5" max="5" step="0.1" value="1">
 *
 * 所有参数进入 lesson.__paramStore（LearnKit store，state.params.<name>）；
 * 正文里用 <output data-param-out="mass">1</output> 显示联动数值；
 * 拖动滑块或横向拖曳数值即可改参；当前值写入 node.dataset.paramValue，
 * 由 learning.records 汇总为"参数探索"证据。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var LearnKit = root.LearnKit || kit.store;

  function paramsModel() {
    return {
      initialState: function () { return { params: {} }; },
      reduce: function (state, action) {
        if (action.type === "SET_PARAM" && action.name) {
          return LearnKit.setPath(state, "params." + action.name, action.value);
        }
        return state;
      },
      derive: function (state) {
        return { params: state.params };
      }
    };
  }

  function ensureStore(lesson) {
    if (!lesson.__paramStore && LearnKit && LearnKit.createStore) {
      lesson.__paramStore = LearnKit.createStore(paramsModel());
    }
    return lesson.__paramStore;
  }

  function fmt(value, step) {
    var decimals = 0;
    var text = String(step != null ? step : "");
    var dot = text.indexOf(".");
    if (dot !== -1) decimals = Math.min(4, text.length - dot - 1);
    return Number(value).toFixed(decimals);
  }

  function enhance(node, lesson, store, name) {
    if (node.dataset.kitParamBound === "true") return;
    node.dataset.kitParamBound = "true";

    var min = isFinite(Number(node.dataset.min)) ? Number(node.dataset.min) : 0;
    var max = isFinite(Number(node.dataset.max)) ? Number(node.dataset.max) : 10;
    var step = isFinite(Number(node.dataset.step)) && Number(node.dataset.step) > 0 ? Number(node.dataset.step) : (max - min) / 100;
    var value = isFinite(Number(node.dataset.value)) ? Number(node.dataset.value) : (min + max) / 2;
    var unit = node.dataset.unit || "";
    var label = node.dataset.label || name;

    var row = document.createElement("span");
    row.className = "kit-param";
    var labelEl = document.createElement("label");
    labelEl.className = "kit-param__label";
    labelEl.textContent = label;
    var range = document.createElement("input");
    range.type = "range";
    range.className = "kit-param__range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.setAttribute("aria-label", label);
    var out = document.createElement("output");
    out.className = "kit-param__value";
    out.textContent = fmt(value, step) + unit;
    // scrubbable number：横向拖曳数值改参
    out.tabIndex = 0;
    out.setAttribute("role", "slider");
    out.setAttribute("aria-label", label + "（左右拖动调整）");
    out.setAttribute("aria-valuemin", String(min));
    out.setAttribute("aria-valuemax", String(max));

    row.appendChild(labelEl);
    row.appendChild(range);
    row.appendChild(out);
    node.appendChild(row);
    node.hidden = false;

    var last = value;
    function commit(next, source) {
      next = Math.min(max, Math.max(min, next));
      next = Math.round(next / step) * step;
      if (isFinite(next)) next = Number(next.toFixed(4));
      if (next === last) return;
      last = next;
      if (store && store.dispatch) {
        store.dispatch({ type: "SET_PARAM", name: name, value: next });
      }
      range.value = String(next);
      out.textContent = fmt(next, step) + unit;
      out.setAttribute("aria-valuenow", String(next));
      node.dataset.paramValue = String(next);
      lesson.querySelectorAll('[data-param-out="' + name + '"]').forEach(function (target) {
        target.textContent = fmt(next, step) + (target.dataset.unit || unit);
      });
      if (source !== "store") notifyOutputs();
    }

    function notifyOutputs() {
      lesson.querySelectorAll('[data-param-out="' + name + '"]').forEach(function (target) {
        target.dataset.paramFrom = name;
        target.dataset.paramAt = String(last);
      });
    }

    range.addEventListener("input", function () { commit(Number(range.value)); });
    out.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      out.setPointerCapture(event.pointerId);
      var startX = event.clientX;
      var startValue = last;
      function onMove(moveEvent) {
        var drag = (moveEvent.clientX - startX) / 120; // 每 120px 走满量程
        commit(startValue + drag * (max - min));
      }
      function onUp(upEvent) {
        out.releasePointerCapture(upEvent.pointerId);
        out.removeEventListener("pointermove", onMove);
        out.removeEventListener("pointerup", onUp);
      }
      out.addEventListener("pointermove", onMove);
      out.addEventListener("pointerup", onUp);
    });
    out.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") { commit(last - step); event.preventDefault(); }
      if (event.key === "ArrowRight" || event.key === "ArrowUp") { commit(last + step); event.preventDefault(); }
    });

    if (store && store.subscribe) {
      store.subscribe(function () {
        var current = LearnKit.getPath(store.getState(), "params." + name);
        if (typeof current === "number" && current !== last) {
          commit(current, "store");
        }
      });
    }
    // 初始值直接入 store（commit 对 next === last 会提前返回），保证
    // data-param-out 联动与"参数探索"证据从挂载那一刻就有基准值。
    if (store && store.dispatch) {
      store.dispatch({ type: "SET_PARAM", name: name, value: value });
    }
    node.dataset.paramValue = String(value);
    lesson.querySelectorAll('[data-param-out="' + name + '"]').forEach(function (target) {
      if (!target.textContent.trim()) target.textContent = fmt(value, step) + (target.dataset.unit || unit);
    });
    notifyOutputs();
  }

  function init() {
    if (typeof document === "undefined") return;
    var lesson = document.querySelector(".lesson") || document.body;
    var store = ensureStore(lesson);
    document.querySelectorAll("kit-param, [data-param]").forEach(function (node) {
      var name = node.dataset.param || node.getAttribute("name");
      if (!name) {
        node.dataset.kitParamBound = "missing-name";
        return;
      }
      try {
        enhance(node, lesson, store, name);
      } catch (error) {
        node.dataset.kitParamBound = "failed";
        console.error("[kit] param init failed:", error);
      }
    });
  }

  kit.param = { init: init, paramsModel: paramsModel };
  if (kit.registerModule) kit.registerModule("learning.param", kit.param);
  if (!kit.registerModule && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
