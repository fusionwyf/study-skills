/*
 * LearnKit runtime (L1) — subject-neutral state engine for interactive lessons.
 * Dependency-free progressive enhancement. Config is JSON data plus models
 * registered in page scripts; never executable expression strings, never eval.
 *
 * Layers: this file = L1 runtime + L3 generic views. Course evidence behavior
 * stays in course.js; subject renderers stay in visualizations.js adapters.
 */
(function (root) {
  "use strict";

  var ACTIONS = {
    PLAY: "PLAY", PAUSE: "PAUSE",
    STEP_NEXT: "STEP_NEXT", STEP_PREVIOUS: "STEP_PREVIOUS",
    SEEK: "SEEK", RESET: "RESET",
    SET_PARAMETER: "SET_PARAMETER",
    SELECT_OBJECT: "SELECT_OBJECT", MOVE_OBJECT: "MOVE_OBJECT",
    SUBMIT_ANSWER: "SUBMIT_ANSWER"
  };

  function getPath(obj, path) {
    if (!path) return undefined;
    return String(path).split(".").reduce(function (node, key) {
      return node == null ? undefined : node[key];
    }, obj);
  }

  // Immutable path write: returns a new object graph along the path.
  function setPath(obj, path, value) {
    var keys = String(path).split(".");
    function assign(node, depth) {
      var base = Array.isArray(node) ? node.slice() : Object.assign({}, node);
      base[keys[depth]] = depth === keys.length - 1 ? value : assign(node == null ? {} : node[keys[depth]], depth + 1);
      return base;
    }
    return assign(obj, 0);
  }

  function isModelDef(def) {
    return !!def && typeof def.initialState === "function" &&
      typeof def.reduce === "function" && typeof def.derive === "function";
  }

  function validateModelDef(name, def) {
    var errors = [];
    if (!isModelDef(def)) {
      errors.push("model " + name + " requires initialState(), reduce(state, action) and derive(state)");
      return errors;
    }
    var initial;
    try { initial = def.initialState(); }
    catch (error) { errors.push("model " + name + " initialState() threw: " + error.message); return errors; }
    if (initial == null || typeof initial !== "object") errors.push("model " + name + " initialState() must return an object");
    try {
      var same = def.reduce(initial, {type: "__LEARNKIT_PROBE__"});
      if (same == null) errors.push("model " + name + " reduce() must return the state for unknown actions");
    } catch (error) {
      errors.push("model " + name + " reduce() threw on an unknown action: " + error.message);
    }
    try { def.derive(initial); }
    catch (error) { errors.push("model " + name + " derive() threw: " + error.message); }
    return errors;
  }

  function defaultDescription(action, state, derived) {
    switch (action.type) {
      case ACTIONS.SET_PARAMETER: return "设置 " + action.name + " = " + action.value;
      case ACTIONS.STEP_NEXT: return "前进一步";
      case ACTIONS.STEP_PREVIOUS: return "后退一步";
      case ACTIONS.SEEK: return "跳转到记录点 " + action.index;
      case ACTIONS.RESET: return "重置为初始状态";
      case ACTIONS.SELECT_OBJECT: return "选中 " + action.id;
      case ACTIONS.PLAY: return "播放";
      case ACTIONS.PAUSE: return "暂停";
      default: return action.type;
    }
  }

  /*
   * Live-model store. History holds every visited state; STEP_PREVIOUS and
   * SEEK move a cursor without re-running the model (transitions are
   * deterministic). Parameter edits truncate the "future" branch, matching
   * explore semantics: a changed assumption invalidates later snapshots.
   */
  function createStore(def, options) {
    if (!isModelDef(def)) throw new Error("createStore requires a model definition with initialState/reduce/derive");
    options = options || {};
    var history = [def.initialState()];
    var cursor = 0;
    var listeners = [];
    var log = [];
    var seq = 0;
    var timer = null;
    var speed = 1;
    var baseInterval = options.baseInterval || 900;

    function state() { return history[cursor]; }
    function derived() { return def.derive(state()); }
    function appendLog(action) {
      var text = typeof def.describe === "function" ? def.describe(action, state(), derived()) : null;
      log.push({seq: ++seq, text: text || defaultDescription(action, state(), derived())});
      if (log.length > 60) log = log.slice(-60);
    }
    function snapshot(action) {
      return {action: action || null, state: state(), derived: derived(), cursor: cursor, length: history.length, log: log.slice()};
    }
    function emit(action) {
      var shot = snapshot(action);
      listeners.forEach(function (listener) { listener(shot); });
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function push(next) {
      history = history.slice(0, cursor + 1);
      history.push(next);
      if (history.length > 500) history = history.slice(-500);
      cursor = history.length - 1;
    }
    function dispatch(action) {
      if (!action || !action.type) throw new Error("action requires a type");
      if (action.type === ACTIONS.PLAY) return play();
      if (action.type === ACTIONS.PAUSE) return pause();
      if (action.type === ACTIONS.STEP_PREVIOUS) {
        if (cursor > 0) { cursor--; appendLog(action); emit(action); }
        return;
      }
      if (action.type === ACTIONS.SEEK) {
        var target = Math.max(0, Math.min(history.length - 1, Math.trunc(Number(action.index))));
        if (Number.isFinite(target) && target !== cursor) { cursor = target; appendLog(action); emit(action); }
        return;
      }
      if (action.type === ACTIONS.STEP_NEXT && cursor < history.length - 1) {
        cursor++; appendLog(action); emit(action); return;
      }
      var next = def.reduce(state(), action);
      if (next == null) throw new Error("reduce() returned no state for " + action.type);
      if (next === state()) {
        // Core-action defaults so minimal models work with standard controls:
        // SET_PARAMETER writes params.* immutably; RESET restores initialState.
        if (action.type === ACTIONS.SET_PARAMETER &&
            getPath(state(), "params." + action.name) !== action.value) {
          next = setPath(state(), "params." + action.name, action.value);
        } else if (action.type === ACTIONS.RESET) {
          next = def.initialState();
        }
      }
      if (next === state()) {
        if (action.type === ACTIONS.STEP_NEXT && derived().atEnd) pause();
        return; // no-op: keep history and log clean
      }
      push(next);
      appendLog(action);
      emit(action);
      if (action.type === ACTIONS.STEP_NEXT && derived().atEnd) pause();
    }
    function play() {
      if (timer) return;
      if (derived().atEnd) { emit({type: ACTIONS.PLAY}); return; }
      timer = setInterval(function () { dispatch({type: ACTIONS.STEP_NEXT}); }, baseInterval / speed);
      emit({type: ACTIONS.PLAY});
    }
    function pause() { stopTimer(); emit({type: ACTIONS.PAUSE}); }
    function setSpeed(value) {
      speed = Math.max(0.1, Number(value) || 1);
      if (timer) { stopTimer(); play(); }
    }
    return {
      getState: state,
      getDerived: derived,
      getLog: function () { return log.slice(); },
      snapshot: snapshot,
      getCursor: function () { return cursor; },
      getLength: function () { return history.length; },
      isPlaying: function () { return !!timer; },
      dispatch: dispatch,
      play: play,
      pause: pause,
      setSpeed: setSpeed,
      subscribe: function (listener) {
        listeners.push(listener);
        return function () { listeners = listeners.filter(function (item) { return item !== listener; }); };
      }
    };
  }

  // Sequence mode: a precomputed list of step states (trace). Any subject can
  // provide steps; index-based seek reaches unvisited steps directly.
  function sequenceModel(states, meta) {
    if (!Array.isArray(states) || !states.length) throw new Error("sequence requires a non-empty states array");
    meta = meta || {};
    return {
      initialState: function () { return {index: 0, params: {}}; },
      reduce: function (state, action) {
        switch (action.type) {
          case ACTIONS.STEP_NEXT:
            return state.index < states.length - 1 ? Object.assign({}, state, {index: state.index + 1}) : state;
          case ACTIONS.STEP_PREVIOUS:
            return state.index > 0 ? Object.assign({}, state, {index: state.index - 1}) : state;
          case ACTIONS.SEEK: {
            var index = Math.max(0, Math.min(states.length - 1, Math.trunc(Number(action.index))));
            return Object.assign({}, state, {index: index});
          }
          case ACTIONS.RESET:
            return {index: 0, params: {}};
          case ACTIONS.SET_PARAMETER:
            return Object.assign({}, state, {params: setPath(state.params, action.name, action.value)});
          default:
            return state;
        }
      },
      derive: function (state) {
        var current = states[state.index];
        return {
          current: current,
          index: state.index,
          total: states.length,
          summary: current.summary || current.title || "",
          properties: current.properties || [],
          atEnd: state.index >= states.length - 1
        };
      },
      describe: function (action, state) {
        if (action.type === ACTIONS.STEP_NEXT || action.type === ACTIONS.SEEK || action.type === ACTIONS.STEP_PREVIOUS) {
          return "步骤 " + (state.index + 1) + "/" + states.length + "：" + (states[state.index].title || "");
        }
        return defaultDescription(action, state, null);
      },
      __states: states,
      __meta: meta
    };
  }

  function createSequenceStore(states, options) {
    return createStore(sequenceModel(states, options && options.meta), options);
  }

  /* ---------------- View registry (L3 generic views) ---------------- */

  var viewRegistry = {};
  var modelRegistry = {};
  var rendererRegistry = {};

  function registerView(name, view) {
    if (!name || !view || typeof view.update !== "function") throw new Error("registerView needs a name and {init?, update, destroy?}");
    viewRegistry[name] = view;
  }
  function registerModel(name, def) {
    var errors = validateModelDef(name, def);
    if (errors.length) throw new Error(errors.join("; "));
    modelRegistry[name] = def;
  }
  function registerRenderer(name, renderer) {
    if (!name || typeof renderer !== "function") throw new Error("registerRenderer needs a name and render(el, state, derived) function");
    rendererRegistry[name] = renderer;
  }

  var SECTION_TYPES = ["explain", "sequence", "explore", "construct", "compare", "predict", "practice"];
  var BLOCK_TYPES = [
    "rich-text", "concept-card", "key-takeaway", "callout", "worked-example", "counter-example",
    "comparison-table", "media-viewer", "annotation", "source-reference", "formula-block", "equation-steps",
    "code-block", "chart", "relation-graph", "timeline", "process-diagram", "spatial-canvas",
    "simulation-stage", "table", "sequence", "hierarchy", "image-annotation", "single-choice",
    "multiple-choice", "true-false", "fill-blank", "matching", "prediction", "interactive-question"
  ];

  // Validate the agent-facing page description before a renderer is selected.
  // This is deliberately structural: it does not attempt to infer pedagogy from prose.
  function validateLessonSpec(spec) {
    var errors = [];
    if (!spec || typeof spec !== "object") return ["LessonSpec must be an object"];
    if (typeof spec.version !== "string" || !/^1\./.test(spec.version)) errors.push("version must start with 1.");
    if (typeof spec.title !== "string" || !spec.title.trim()) errors.push("title is required");
    if (!Array.isArray(spec.sections) || !spec.sections.length) {
      errors.push("sections must be a non-empty array");
      return errors;
    }
    var ids = {};
    spec.sections.forEach(function (section, index) {
      if (!section || typeof section !== "object") { errors.push("sections[" + index + "] must be an object"); return; }
      if (!section.id || !/^[A-Za-z0-9_-]+$/.test(section.id)) errors.push("sections[" + index + "].id must be a safe unique id");
      if (section.id && ids[section.id]) errors.push("duplicate section id: " + section.id);
      if (section.id) ids[section.id] = true;
      if (!SECTION_TYPES.includes(section.type)) errors.push("sections[" + index + "] has unsupported type: " + section.type);
      if (typeof section.title !== "string" || !section.title.trim()) errors.push("sections[" + index + "].title is required");
      ["blocks", "controls", "views"].forEach(function (key) {
        if (section[key] !== undefined && !Array.isArray(section[key])) errors.push("sections[" + index + "]." + key + " must be an array");
      });
      (section.blocks || []).forEach(function (block, blockIndex) {
        if (!block || typeof block !== "object" || !BLOCK_TYPES.includes(block.type)) {
          errors.push("sections[" + index + "].blocks[" + blockIndex + "] has unsupported type: " + (block && block.type));
        }
      });
    });
    return errors;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch];
    });
  }

  registerView("status", {
    update: function (el, snapshot) {
      el.textContent = (snapshot.derived && snapshot.derived.summary) || "";
    }
  });

  registerView("property-table", {
    update: function (el, snapshot) {
      var rows = getPath({derived: snapshot.derived, state: snapshot.state}, el.dataset.lkBind || "derived.properties") || [];
      el.replaceChildren();
      var table = el.ownerDocument.createElement("table");
      var body = el.ownerDocument.createElement("tbody");
      rows.forEach(function (row) {
        var tr = el.ownerDocument.createElement("tr");
        var th = el.ownerDocument.createElement("th");
        th.scope = "row";
        th.textContent = row.name;
        var td = el.ownerDocument.createElement("td");
        td.textContent = row.value;
        tr.appendChild(th); tr.appendChild(td);
        body.appendChild(tr);
      });
      table.appendChild(body);
      el.appendChild(table);
    }
  });

  registerView("event-log", {
    update: function (el, snapshot) {
      var count = Number(el.dataset.lkLimit) || 8;
      el.replaceChildren();
      snapshot.log.slice(-count).forEach(function (entry) {
        var item = el.ownerDocument.createElement("li");
        item.textContent = entry.text;
        el.appendChild(item);
      });
    }
  });

  registerView("history", {
    update: function (el, snapshot) {
      el.replaceChildren();
      var list = el.ownerDocument.createElement("ol");
      list.className = "lk-history-list";
      var total = snapshot.length || 1;
      for (var i = 0; i < total; i++) {
        var item = el.ownerDocument.createElement("li");
        item.textContent = (i === snapshot.cursor ? "当前：" : "步骤 ") + (i + 1);
        if (i === snapshot.cursor) item.setAttribute("aria-current", "step");
        list.appendChild(item);
      }
      el.appendChild(list);
    }
  });

  registerView("change-summary", {
    update: function (el, snapshot) {
      var previous = snapshot.cursor > 0 ? snapshot.state : null;
      var summary = snapshot.derived && (snapshot.derived.changeSummary || snapshot.derived.summary);
      el.textContent = summary || (previous ? "状态已更新。" : "初始状态。");
    }
  });

  registerView("legend", {
    update: function (el, snapshot) {
      var items = getPath({derived: snapshot.derived, state: snapshot.state}, el.dataset.lkBind || "derived.legend") || [];
      el.replaceChildren();
      items.forEach(function (item) {
        var li = el.ownerDocument.createElement("li");
        li.textContent = (item.label || item.name || "") + (item.description ? "：" + item.description : "");
        el.appendChild(li);
      });
    }
  });

  // Generic stage: hands the element to a named page-registered renderer.
  registerView("stage", {
    update: function (el, snapshot) {
      var renderer = rendererRegistry[el.dataset.lkRender];
      if (renderer) renderer(el, snapshot.state, snapshot.derived);
    }
  });

  /* ---------------- Spec validation (Agent output checks) ---------------- */

  function validateSpec(kind, config, registry) {
    registry = registry || modelRegistry;
    var errors = [];
    if (!config || typeof config !== "object") return ["config must be an object"];
    if (kind === "lesson") return validateLessonSpec(config);
    if (!config.model || typeof config.model !== "object" || !config.model.description) {
      errors.push("config.model.description is required: state what the model computes, with assumptions");
    }
    if (["sequence", "construct", "compare", "predict"].includes(kind)) {
      if (config.model.name) {
        if (!registry[config.model.name]) errors.push("unknown registered model: " + config.model.name);
      } else if (!Array.isArray(config.states) || !config.states.length) {
        errors.push("sequence config requires a non-empty states array or a registered model name");
      } else {
        config.states.forEach(function (state, index) {
          if (!state || typeof state !== "object" || !(state.title || state.summary)) {
            errors.push("states[" + index + "] needs a title or summary so playback stays explainable");
          }
        });
      }
    } else if (kind === "explore") {
      if (!config.model.name || !registry[config.model.name]) {
        errors.push("explore config requires model.name of a model registered via LearnKit.registerModel");
      }
    } else {
      errors.push("unknown learnkit kind: " + kind);
    }
    return errors;
  }

  /* ---------------- Declarative wiring (browser only) ---------------- */

  function find(node, selector) { return node.querySelector(selector); }
  function findAll(node, selector) { return Array.prototype.slice.call(node.querySelectorAll(selector)); }

  function wireContainer(node) {
    var kind = node.dataset.learnkit;
    var configNode = find(node, "[data-lk-config]");
    if (!configNode) throw new Error("缺少 data-lk-config JSON 配置");
    var config = JSON.parse(configNode.textContent);
    var errors = validateSpec(kind, config);
    if (errors.length) throw new Error(errors.join("；"));

    var store;
    if (["sequence", "construct", "compare", "predict"].includes(kind) && !config.model.name) store = createSequenceStore(config.states);
    else store = createStore(modelRegistry[config.model.name]);
    if (config.params) {
      Object.keys(config.params).forEach(function (name) {
        store.dispatch({type: ACTIONS.SET_PARAMETER, name: name, value: config.params[name]});
      });
    }

    var host = find(node, "[data-lk-host]");
    var controls = find(node, "[data-lk-controls]");
    if (host) host.hidden = false;
    if (controls) controls.hidden = false;

    function refreshControls(snapshot) {
      findAll(node, "[data-lk-action]").forEach(function (button) {
        var type = button.dataset.lkAction;
        if (type === ACTIONS.STEP_PREVIOUS) button.disabled = snapshot.cursor === 0;
        else if (type === ACTIONS.STEP_NEXT) button.disabled = !!snapshot.derived.atEnd;
        else if (type === ACTIONS.PLAY) button.disabled = !!snapshot.derived.atEnd || store.isPlaying();
        else if (type === ACTIONS.PAUSE) button.disabled = !store.isPlaying();
      });
      findAll(node, "input[data-lk-bind], select[data-lk-bind]").forEach(function (input) {
        if (root.document.activeElement === input) return; // never fight the user's edit
        var value = getPath(snapshot.state, input.dataset.lkBind);
        if (value !== undefined) input.value = value;
      });
      findAll(node, "input[data-lk-seek]").forEach(function (input) {
        input.max = Math.max(0, (kind === "sequence" ? snapshot.derived.total : snapshot.length) - 1);
        input.value = kind === "sequence" ? snapshot.derived.index : snapshot.cursor;
      });
    }

    var views = findAll(node, "[data-lk-view]").map(function (el) {
      var view = viewRegistry[el.dataset.lkView];
      if (!view) throw new Error("未知视图类型：" + el.dataset.lkView);
      if (typeof view.init === "function") view.init(el, {store: store, config: config});
      return {el: el, view: view};
    });

    store.subscribe(function (snapshot) {
      views.forEach(function (entry) {
        entry.view.update(entry.el, snapshot, {store: store, config: config});
      });
      refreshControls(snapshot);
      node.dataset.visualState = JSON.stringify({
        mode: kind,
        cursor: snapshot.cursor,
        length: snapshot.length,
        params: snapshot.state.params || {},
        summary: snapshot.derived.summary || ""
      });
    });

    findAll(node, "[data-lk-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        store.dispatch({type: button.dataset.lkAction});
      });
    });
    findAll(node, "input[data-lk-bind], select[data-lk-bind]").forEach(function (input) {
      function commit() {
        var raw = input.type === "range" || input.type === "number" ? input.valueAsNumber : input.value;
        if (typeof raw === "number" && !Number.isFinite(raw)) return;
        var path = input.dataset.lkBind.replace(/^params\./, "");
        store.dispatch({type: ACTIONS.SET_PARAMETER, name: path, value: raw});
      }
      // Range sliders feel live; text/select commit on change to avoid partial input.
      input.addEventListener(input.type === "range" ? "input" : "change", commit);
    });
    findAll(node, "input[data-lk-seek]").forEach(function (input) {
      input.addEventListener("input", function () {
        store.dispatch({type: ACTIONS.SEEK, index: Number(input.value)});
      });
    });
    findAll(node, "select[data-lk-speed]").forEach(function (select) {
      select.addEventListener("change", function () { store.setSpeed(select.value); });
    });

    // Initial paint: push the current snapshot to every view and control.
    views.forEach(function (entry) { entry.view.update(entry.el, store.snapshot(), {store: store, config: config}); });
    refreshControls(store.snapshot());
    node.__learnkitStore = store;
    return store;
  }

  function init() {
    var nodes = findAll(root.document, "[data-learnkit]");
    nodes.forEach(function (node) {
      try {
        wireContainer(node);
        node.dataset.lkReady = "true";
      } catch (error) {
        node.dataset.lkReady = "failed";
        var host = find(node, "[data-lk-host]"); if (host) host.hidden = true;
        var controls = find(node, "[data-lk-controls]"); if (controls) controls.hidden = true;
        var status = find(node, "[data-lk-status]"); if (status) status.textContent = error.message;
      }
    });
    root.__LEARNKIT_READY__ = true;
  }

  var api = {
    ACTIONS: ACTIONS,
    getPath: getPath,
    setPath: setPath,
    createStore: createStore,
    createSequenceStore: createSequenceStore,
    sequenceModel: sequenceModel,
    validateModelDef: validateModelDef,
    validateSpec: validateSpec,
    validateLessonSpec: validateLessonSpec,
    SECTION_TYPES: SECTION_TYPES,
    BLOCK_TYPES: BLOCK_TYPES,
    registerView: registerView,
    registerModel: registerModel,
    registerRenderer: registerRenderer,
    registries: {views: viewRegistry, models: modelRegistry, renderers: rendererRegistry}
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root.document) return;
  root.LearnKit = api;
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", init);
  else init();
}(typeof window !== "undefined" ? window : globalThis));
