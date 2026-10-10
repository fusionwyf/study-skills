/**
 * Course Kit v2 Bundled Runtime
 * Built by kit.py. Do not edit directly.
 */
(function (global) {
  "use strict";
  var CourseKit = global.CourseKit = global.CourseKit || {};
  global.kit = global.kit || CourseKit;

  /* ---- Module: core (bus.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var listeners = {};

  kit.on = function (type, handler) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(handler);
    return function () {
      kit.off(type, handler);
    };
  };

  kit.off = function (type, handler) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter(function (h) { return h !== handler; });
  };

  kit.emit = function (type, detail) {
    if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(type, { detail: detail, bubbles: true }));
      } catch (e) {}
    }
    var handlers = listeners[type] ? listeners[type].slice() : [];
    handlers.forEach(function (h) {
      try { h(detail); } catch (err) { console.error("Event handler error for " + type, err); }
    });
  };
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (config.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var defaults = {
    theme: "course",
    scheme: "auto",
    code: {
      themes: {
        light: "github",
        dark: "github-dark"
      }
    },
    math: {
      macros: {},
      trust: false,
      strict: "warn",
      throwOnError: false
    },
    toc: {
      depth: 2
    },
    vendor: {
      mode: "cdn"
    },
    question: {
      print: "review"
    }
  };

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== "object") target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  function readConfig() {
    var cfg = JSON.parse(JSON.stringify(defaults));

    if (typeof document !== "undefined") {
      var script = document.getElementById("kit-config");
      if (script && script.textContent) {
        try {
          var parsed = JSON.parse(script.textContent);
          deepMerge(cfg, parsed);
        } catch (e) {
          console.warn("[kit] Failed to parse #kit-config JSON", e);
        }
      }
    }

    // Legacy globals compatibility
    if (root.COURSE_THEMES) {
      console.warn("[kit] window.COURSE_THEMES is deprecated. Use assets/course/config.json or #kit-config.");
      if (Array.isArray(root.COURSE_THEMES) && root.COURSE_THEMES.length) {
        cfg.themes = root.COURSE_THEMES;
      }
    }
    if (root.COURSE_CODE_THEMES) {
      console.warn("[kit] window.COURSE_CODE_THEMES is deprecated. Use config.code.themes in config.json.");
      deepMerge(cfg.code.themes, root.COURSE_CODE_THEMES);
    }
    if (root.COURSE_MATH_OPTIONS) {
      console.warn("[kit] window.COURSE_MATH_OPTIONS is deprecated. Use config.math in config.json.");
      deepMerge(cfg.math, root.COURSE_MATH_OPTIONS);
    }

    return cfg;
  }

  kit.config = readConfig();
  kit.getConfig = readConfig;
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (util.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function slugify(value) {
    if (!value) return "section";
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function plainText(node) {
    return node ? node.textContent.trim() : "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(value, caseSensitive) {
    var text = String(value == null ? "" : value).normalize("NFKC").trim();
    return caseSensitive ? text : text.toLowerCase();
  }

  function copyText(value, done, failed) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(failed);
      return;
    }
    if (typeof document === "undefined") {
      if (failed) failed();
      return;
    }
    var area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      var ok = document.execCommand("copy");
      if (ok && done) done();
      else if (!ok && failed) failed();
    } catch (error) {
      if (failed) failed();
    } finally {
      area.remove();
    }
  }

  function throttleRAF(fn) {
    var ticking = false;
    return function () {
      var args = arguments;
      var context = this;
      if (!ticking) {
        ticking = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(function () {
            ticking = false;
            fn.apply(context, args);
          });
        } else {
          setTimeout(function () {
            ticking = false;
            fn.apply(context, args);
          }, 16);
        }
      }
    };
  }

  var util = {
    slugify: slugify,
    plainText: plainText,
    escapeHtml: escapeHtml,
    norm: norm,
    copyText: copyText,
    throttleRAF: throttleRAF
  };

  kit.util = util;
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (store.js) ---- */
  (function () {
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

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

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
        if (action.type === ACTIONS.SET_PARAMETER &&
            getPath(state(), "params." + action.name) !== action.value) {
          next = setPath(state(), "params." + action.name, action.value);
        } else if (action.type === ACTIONS.RESET) {
          next = def.initialState();
        }
      }
      if (next === state()) {
        if (action.type === ACTIONS.STEP_NEXT && derived().atEnd) pause();
        return;
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
  var BLOCK_TYPES = ["html"];

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
      (Array.isArray(section.blocks) ? section.blocks : []).forEach(function (block, blockIndex) {
        if (!block || typeof block !== "object" || !BLOCK_TYPES.includes(block.type) || typeof block.content !== "string") {
          errors.push("sections[" + index + "].blocks[" + blockIndex + "] requires type=html and string content; write HTML + data-* instead: " + (block && block.type));
        }
      });
    });
    return errors;
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

  registerView("stage", {
    update: function (el, snapshot) {
      var renderer = rendererRegistry[el.dataset.lkRender];
      if (renderer) renderer(el, snapshot.state, snapshot.derived);
    }
  });

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
        if (root.document && root.document.activeElement === input) return;
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

    views.forEach(function (entry) { entry.view.update(entry.el, store.snapshot(), {store: store, config: config}); });
    refreshControls(store.snapshot());
    node.__learnkitStore = store;
    return store;
  }

  function init() {
    if (!root.document) return;
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

  kit.store = api;
  root.LearnKit = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (loader.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var VENDORS = {
    hljs: {
      id: "hljs",
      version: "11.12.0",
      js: {
        cdn: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js",
        local: "../assets/kit/vendor/hljs/highlight.min.js"
      }
    },
    katex: {
      id: "katex",
      version: "0.16.11",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
        local: "../assets/kit/vendor/katex/katex.min.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
        local: "../assets/kit/vendor/katex/katex.min.js"
      },
      autoRender: {
        cdn: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
        local: "../assets/kit/vendor/katex/auto-render.min.js"
      }
    },
    mermaid: {
      id: "mermaid",
      version: "11.4.1",
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
        local: "../assets/kit/vendor/mermaid/mermaid.min.js"
      }
    },
    plotly: {
      id: "plotly",
      version: "2.35.2",
      js: {
        cdn: "https://cdn.plot.ly/plotly-2.35.2.min.js",
        local: "../assets/visualizations/vendor/plotly.js-dist-min/plotly.min.js"
      }
    },
    jsxgraph: {
      id: "jsxgraph",
      version: "1.10.1",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.10.1/distrib/jsxgraph.css",
        local: "../assets/visualizations/vendor/jsxgraph/jsxgraph.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.10.1/distrib/jsxgraphcore.js",
        local: "../assets/visualizations/vendor/jsxgraph/jsxgraphcore.js"
      }
    }
  };

  var loadingPromises = {};

  function loadScript(url, attrs) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function (e) { reject(e); });
        return;
      }
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      }
      s.onload = function () {
        s.dataset.loaded = "true";
        resolve();
      };
      s.onerror = function (e) {
        reject(new Error("Failed to load script: " + url));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('link[href="' + url + '"]');
      if (existing) return resolve();
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
      }
      link.onload = function () { resolve(); };
      link.onerror = function (e) { reject(new Error("Failed to load stylesheet: " + url)); };
      document.head.appendChild(link);
    });
  }

  function need(vendorId) {
    if (loadingPromises[vendorId]) return loadingPromises[vendorId];

    var vendor = VENDORS[vendorId];
    if (!vendor) {
      return Promise.reject(new Error("Unknown vendor id: " + vendorId));
    }

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) || "cdn";
    var useLocal = mode === "local";

    var promise;
    if (vendorId === "hljs") {
      var jsUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(jsUrl);
    } else if (vendorId === "katex") {
      var cssUrl = useLocal ? vendor.css.local : vendor.css.cdn;
      var katexJsUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      var autoRenderUrl = useLocal ? vendor.autoRender.local : vendor.autoRender.cdn;
      promise = loadStyle(cssUrl).then(function () {
        return loadScript(katexJsUrl);
      }).then(function () {
        return loadScript(autoRenderUrl);
      });
    } else if (vendorId === "mermaid") {
      var mermaidUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(mermaidUrl);
    } else if (vendorId === "plotly") {
      var plotlyUrl = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadScript(plotlyUrl);
    } else if (vendorId === "jsxgraph") {
      var jsxCss = useLocal ? vendor.css.local : vendor.css.cdn;
      var jsxJs = useLocal ? vendor.js.local : vendor.js.cdn;
      promise = loadStyle(jsxCss).then(function () {
        return loadScript(jsxJs);
      });
    } else {
      promise = Promise.resolve();
    }

    loadingPromises[vendorId] = promise;
    return promise;
  }

  kit.need = need;
  kit.VENDORS = VENDORS;
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (ready.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var readyModules = [];
  var failedModules = [];
  var pendingModules = new Set();
  var isGlobalReady = false;

  function markModuleReady(moduleId) {
    if (readyModules.indexOf(moduleId) === -1) {
      readyModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":ready", { module: moduleId });
    checkGlobalReady();
  }

  function markModuleFailed(moduleId, error) {
    if (failedModules.indexOf(moduleId) === -1) {
      failedModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":failed", { module: moduleId, error: error });
    checkGlobalReady();
  }

  function registerPendingModule(moduleId) {
    if (readyModules.indexOf(moduleId) === -1 && failedModules.indexOf(moduleId) === -1) {
      pendingModules.add(moduleId);
    }
  }

  function checkGlobalReady() {
    if (pendingModules.size === 0 && !isGlobalReady) {
      isGlobalReady = true;
      if (typeof document !== "undefined") {
        document.documentElement.dataset.kitReady = "true";
        document.documentElement.dataset.courseReady = "true";
      }

      var payload = {
        ready: readyModules.slice(),
        failed: failedModules.slice()
      };

      kit.emit("kit:ready", payload);

      // Backward compatibility shims
      if (typeof window !== "undefined") {
        root.__COURSE_MATH_READY__ = true;
        root.__LEARNKIT_READY__ = true;
        try {
          window.dispatchEvent(new CustomEvent("course-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("lk-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("viz-ready", { detail: payload }));
          window.dispatchEvent(new CustomEvent("media-ready", { detail: payload }));
        } catch (e) {}
      }
    }
  }

  kit.ready = {
    markReady: markModuleReady,
    markFailed: markModuleFailed,
    registerPending: registerPendingModule,
    isReady: function () { return isGlobalReady; },
    getReadyModules: function () { return readyModules.slice(); },
    getFailedModules: function () { return failedModules.slice(); }
  };
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: core (registry.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var modules = {};

  kit.registerModule = function (id, mod) {
    modules[id] = mod;
    if (typeof mod.init === "function") {
      try {
        mod.init(kit);
      } catch (err) {
        console.error("Failed to init module " + id, err);
        if (kit.ready && kit.ready.markFailed) {
          kit.ready.markFailed(id, err);
        }
      }
    }
  };

  kit.getModule = function (id) {
    return modules[id];
  };

  kit.listModules = function () {
    return Object.keys(modules);
  };
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: foundation (theme-engine.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var currentTheme = "course";
  var currentScheme = "light";

  function getCourseId() {
    if (typeof document === "undefined") return "default";
    var lesson = document.querySelector(".lesson, [data-course-id]");
    return (lesson && lesson.dataset.courseId) || "default";
  }

  function getSystemScheme() {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  function resolveSchemeForTheme(themeName) {
    if (themeName === "ink") return "dark";
    if (themeName === "paper") return "light";
    if (themeName === "course") return "light";
    return "light";
  }

  function updateHljsTheme(scheme) {
    if (typeof document === "undefined") return;
    var codeThemes = (kit.config && kit.config.code && kit.config.code.themes) || {
      light: "github",
      dark: "github-dark"
    };

    var themeName = scheme === "dark" ? (codeThemes.dark || "github-dark") : (codeThemes.light || "github");
    var isUrl = themeName.indexOf("/") !== -1 || themeName.indexOf(".css") !== -1;
    var targetUrl = isUrl ? themeName : "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/" + themeName + ".min.css";

    var link = document.getElementById("kit-hljs-theme");
    if (!link) {
      link = document.createElement("link");
      link.id = "kit-hljs-theme";
      link.rel = "stylesheet";
      link.href = targetUrl;
      document.head.appendChild(link);
    } else if (link.getAttribute("href") !== targetUrl) {
      // Create new link to preload before replacing to avoid flicker
      var nextLink = document.createElement("link");
      nextLink.rel = "stylesheet";
      nextLink.href = targetUrl;
      nextLink.onload = function () {
        link.remove();
        nextLink.id = "kit-hljs-theme";
      };
      nextLink.onerror = function () {
        nextLink.remove();
      };
      document.head.appendChild(nextLink);
    }
  }

  function applyTheme(themeName, persist) {
    currentTheme = themeName;
    currentScheme = resolveSchemeForTheme(themeName);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = currentTheme;
      document.documentElement.dataset.scheme = currentScheme;
      // Legacy compatibility
      document.documentElement.dataset.themeSurface = currentScheme;

      if (persist && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("kit_theme_" + getCourseId(), currentTheme);
        } catch (e) {}
      }

      updateHljsTheme(currentScheme);
    }

    kit.emit("kit:themechange", {
      theme: currentTheme,
      scheme: currentScheme
    });
  }

  function toggleTheme() {
    var next = currentTheme === "ink" ? "course" : "ink";
    applyTheme(next, true);
    return next;
  }

  function initTheme() {
    var stored = null;
    if (typeof localStorage !== "undefined") {
      try {
        stored = localStorage.getItem("kit_theme_" + getCourseId());
      } catch (e) {}
    }

    var defaultTheme = (kit.config && kit.config.theme) || "course";
    var initialTheme = stored || defaultTheme;

    applyTheme(initialTheme, false);

    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
        if (!stored) {
          applyTheme(e.matches ? "ink" : "course", false);
        }
      });
    }

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("foundation");
    }
  }

  kit.theme = {
    getTheme: function () { return currentTheme; },
    getScheme: function () { return currentScheme; },
    setTheme: function (themeName) { applyTheme(themeName, true); },
    toggle: toggleTheme,
    init: initTheme
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initTheme);
    } else {
      initTheme();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: content._block (block-chrome.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function createBlock(options) {
    options = options || {};
    var kind = options.kind || "generic";
    var labelText = options.label || "";
    var titleText = options.title || "";

    var block = document.createElement("figure");
    block.className = "kit-block";
    block.dataset.kind = kind;
    block.dataset.kitState = "pending";

    var label = document.createElement("div");
    label.className = "kit-block__label";
    label.textContent = labelText;

    var actions = document.createElement("div");
    actions.className = "kit-block__actions";

    var body = document.createElement("div");
    body.className = "kit-block__body";

    if (titleText) {
      block.classList.add("has-header");
      var header = document.createElement("div");
      header.className = "kit-block__header";

      var title = document.createElement("span");
      title.className = "kit-block__title";
      title.textContent = titleText;

      header.appendChild(title);
      header.appendChild(label);
      header.appendChild(actions);
      block.appendChild(header);
    } else {
      block.appendChild(label);
      block.appendChild(actions);
    }

    block.appendChild(body);

    function addAction(text, onClick, ariaLabel) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kit-block__btn";
      btn.textContent = text;
      if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
      btn.addEventListener("click", onClick);
      actions.appendChild(btn);
      return btn;
    }

    return {
      root: block,
      label: label,
      actions: actions,
      body: body,
      addAction: addAction
    };
  }

  kit.block = {
    create: createBlock
  };

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("content._block");
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: content.code (code.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var ALIASES = {
    py: "python", js: "javascript", ts: "typescript",
    sh: "bash", shell: "bash", zsh: "bash", yml: "yaml",
    md: "markdown", rb: "ruby", rs: "rust", cs: "csharp", htm: "html"
  };

  function inferLanguage(codeNode) {
    var cls = codeNode.className || "";
    var match = cls.match(/language-([a-zA-Z0-9_-]+)/);
    if (match) {
      var raw = match[1].toLowerCase();
      return ALIASES[raw] || raw;
    }
    // Check parent pre
    var pre = codeNode.parentElement;
    if (pre && pre.dataset && pre.dataset.language) {
      var lang = pre.dataset.language.toLowerCase();
      return ALIASES[lang] || lang;
    }
    return "text";
  }

  function enhanceCodeBlock(codeNode) {
    if (codeNode.closest(".kit-block")) return;
    var pre = codeNode.parentElement;
    if (!pre || pre.tagName.toLowerCase() !== "pre") return;
    if (pre.hasAttribute("data-kit-skip")) return;

    var lang = inferLanguage(codeNode);
    var title = pre.dataset.title || "";
    var wrap = pre.hasAttribute("data-wrap");
    var fold = pre.hasAttribute("data-fold");

    var block = kit.block.create({
      kind: "code",
      label: lang !== "text" ? lang : "",
      title: title
    });

    if (wrap) pre.classList.add("has-wrap");

    var copyBtn = block.addAction("复制", function () {
      var text = codeNode.textContent;
      kit.util.copyText(text, function () {
        copyBtn.textContent = "已复制";
        setTimeout(function () { copyBtn.textContent = "复制"; }, 1500);
      }, function () {
        copyBtn.textContent = "复制失败";
        setTimeout(function () { copyBtn.textContent = "复制"; }, 1500);
      });
    }, "复制代码");

    if (fold) {
      block.root.classList.add("is-folded");
      var foldBtn = block.addAction("展开", function () {
        var isFolded = block.root.classList.toggle("is-folded");
        foldBtn.textContent = isFolded ? "展开" : "折叠";
      }, "展开或折叠代码");
    }

    pre.parentNode.insertBefore(block.root, pre);
    block.body.appendChild(pre);

    // Syntax highlight
    if (lang !== "text" && root.hljs) {
      try {
        root.hljs.highlightElement(codeNode);
      } catch (e) {}
      block.root.dataset.kitState = "ready";
    } else if (lang !== "text" && kit.need) {
      kit.need("hljs").then(function () {
        if (root.hljs) {
          try {
            root.hljs.highlightElement(codeNode);
          } catch (e) {}
        }
        block.root.dataset.kitState = "ready";
      }).catch(function () {
        block.root.dataset.kitState = "failed";
      });
    } else {
      block.root.dataset.kitState = "ready";
    }
  }

  // Legacy .code-block support
  function enhanceLegacyCodeBlocks() {
    var legacyBlocks = document.querySelectorAll(".code-block:not(.kit-block)");
    Array.prototype.forEach.call(legacyBlocks, function (el) {
      var code = el.querySelector("code");
      if (code) enhanceCodeBlock(code);
    });
  }

  function init() {
    if (typeof document === "undefined") return;
    if (kit.ready && kit.ready.registerPending) {
      kit.ready.registerPending("content.code");
    }

    var codeNodes = document.querySelectorAll("pre > code");
    Array.prototype.forEach.call(codeNodes, enhanceCodeBlock);
    enhanceLegacyCodeBlocks();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("content.code");
    }
  }

  kit.code = {
    init: init,
    enhance: enhanceCodeBlock
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: content.math (math.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function hasMathContent() {
    if (typeof document === "undefined") return false;
    if (document.querySelector(".formula, [data-math]")) return true;
    var text = document.body ? document.body.textContent : "";
    return /\\\(|\\\[|\$\$/.test(text);
  }

  function enhanceFormulaBlocks() {
    var formulas = document.querySelectorAll(".formula:not(.kit-block)");
    Array.prototype.forEach.call(formulas, function (el) {
      if (el.closest(".kit-block")) return;
      var raw = el.textContent.trim();
      var block = kit.block.create({
        kind: "math",
        label: "math"
      });

      var copyBtn = block.addAction("复制 LaTeX", function () {
        kit.util.copyText(raw, function () {
          copyBtn.textContent = "已复制";
          setTimeout(function () { copyBtn.textContent = "复制 LaTeX"; }, 1500);
        }, function () {
          copyBtn.textContent = "复制失败";
          setTimeout(function () { copyBtn.textContent = "复制 LaTeX"; }, 1500);
        });
      }, "复制公式源码");

      el.parentNode.insertBefore(block.root, el);
      block.body.appendChild(el);
      block.root.dataset.kitState = "ready";
    });
  }

  function renderMath() {
    if (typeof window.renderMathInElement !== "function") return;
    var opts = (kit.config && kit.config.math) || {};
    var delimiters = [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
    ];

    try {
      window.renderMathInElement(document.body, {
        delimiters: delimiters,
        macros: opts.macros || {},
        throwOnError: !!opts.throwOnError,
        errorColor: "var(--c-danger)"
      });
      enhanceFormulaBlocks();
      root.__COURSE_MATH_READY__ = true;
      if (kit.ready && kit.ready.markReady) {
        kit.ready.markReady("content.math");
      }
    } catch (e) {
      console.error("[kit.math] Render error", e);
      if (kit.ready && kit.ready.markFailed) {
        kit.ready.markFailed("content.math", e);
      }
    }
  }

  function init() {
    if (!hasMathContent()) {
      if (kit.ready && kit.ready.markReady) {
        kit.ready.markReady("content.math");
      }
      return;
    }

    if (kit.ready && kit.ready.registerPending) {
      kit.ready.registerPending("content.math");
    }

    if (typeof window.renderMathInElement === "function") {
      renderMath();
    } else if (kit.need) {
      kit.need("katex").then(function () {
        renderMath();
      }).catch(function (err) {
        console.warn("[kit.math] KaTeX not available, degrading to plain text formula", err);
        root.__COURSE_MATH_READY__ = true;
        if (kit.ready && kit.ready.markReady) {
          kit.ready.markReady("content.math");
        }
      });
    }
  }

  kit.math = {
    init: init,
    render: renderMath
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: shell.nav (nav.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initNav() {
    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.nav");
    }
  }

  kit.nav = {
    init: initNav
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNav);
    else initNav();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: shell.progress (progress.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initProgress() {
    if (typeof document === "undefined") return;

    var bar = document.createElement("div");
    bar.className = "kit-progress-bar";
    document.body.appendChild(bar);

    function update() {
      var scroll = window.scrollY || document.documentElement.scrollTop;
      var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (height > 0) {
        var pct = Math.min(100, Math.max(0, (scroll / height) * 100));
        bar.style.width = pct + "%";
      }
    }

    var onScroll = kit.util ? kit.util.throttleRAF(update) : update;
    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.progress");
  }

  kit.progress = {
    init: initProgress
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProgress);
    else initProgress();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: shell.theme-switcher (theme-switcher.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function renderSwitcher(container) {
    container.innerHTML = "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kit-theme-toggle";

    function updateLabel() {
      var current = (kit.theme && kit.theme.getTheme && kit.theme.getTheme()) || "course";
      btn.textContent = current === "ink" ? "☀️ 浅色主题" : "🌙 深色主题";
    }

    btn.addEventListener("click", function () {
      if (kit.theme && kit.theme.toggle) {
        kit.theme.toggle();
        updateLabel();
      }
    });

    updateLabel();
    container.appendChild(btn);

    kit.on("kit:themechange", updateLabel);
  }

  function initSwitchers() {
    if (typeof document === "undefined") return;
    var containers = document.querySelectorAll("[data-theme-switch]");
    Array.prototype.forEach.call(containers, renderSwitcher);
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.theme-switcher");
  }

  kit.themeSwitcher = {
    init: initSwitchers
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSwitchers);
    else initSwitchers();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: shell.toc (toc.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var headings = [];
  var activeHeadingId = null;
  var desktopScrollBox = null;
  var allLinkNodes = [];

  function getHeadings() {
    var scope = document.querySelector(".kit-main, .lesson") || document.body;
    var raw = Array.prototype.slice.call(scope.querySelectorAll("h2, h3, [data-toc-label]"));
    var result = [];

    raw.forEach(function (el) {
      if (el.hasAttribute("data-toc-skip")) return;
      if (!el.id) {
        el.id = kit.util.slugify(el.textContent);
      }
      var label = el.dataset.tocLabel || el.textContent.trim();
      var isH3 = el.tagName && el.tagName.toLowerCase() === "h3";
      result.push({
        id: el.id,
        label: label,
        isH3: isH3,
        element: el
      });
    });
    return result;
  }

  function renderList(targetUl, closeCallback) {
    targetUl.innerHTML = "";
    headings.forEach(function (h) {
      var li = document.createElement("li");
      li.className = "kit-toc__item toc-item" + (h.isH3 ? " is-h3" : " is-h2");

      var a = document.createElement("a");
      a.className = "kit-toc__link toc-link";
      a.href = "#" + h.id;
      a.textContent = h.label;
      a.dataset.targetId = h.id;

      a.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(h.id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.pushState) {
            history.pushState(null, "", "#" + h.id);
          }
        }
        if (closeCallback) closeCallback();
      });

      li.appendChild(a);
      targetUl.appendChild(li);
      allLinkNodes.push(a);
    });
  }

  function updateActiveLink(id) {
    if (activeHeadingId === id) return;
    activeHeadingId = id;

    allLinkNodes.forEach(function (a) {
      if (a.dataset.targetId === id) {
        a.setAttribute("aria-current", "location");
        a.classList.add("is-active");

        // Keep active item in view inside the TOC container without whole-page scroll
        if (desktopScrollBox && desktopScrollBox.contains(a)) {
          var containerTop = desktopScrollBox.scrollTop;
          var containerHeight = desktopScrollBox.clientHeight;
          var itemTop = a.offsetTop;
          var itemHeight = a.offsetHeight;

          if (itemTop < containerTop) {
            desktopScrollBox.scrollTop = itemTop - 10;
          } else if (itemTop + itemHeight > containerTop + containerHeight) {
            desktopScrollBox.scrollTop = itemTop + itemHeight - containerHeight + 10;
          }
        }
      } else {
        a.removeAttribute("aria-current");
        a.classList.remove("is-active");
      }
    });

    var mobileBar = document.querySelector(".kit-toc-mobile-bar span");
    if (mobileBar) {
      var match = headings.find(function (h) { return h.id === id; });
      if (match) mobileBar.textContent = match.label;
    }
  }

  function handleScroll() {
    var offset = 100;
    var matchedId = null;

    for (var i = 0; i < headings.length; i++) {
      var rect = headings[i].element.getBoundingClientRect();
      if (rect.top <= offset) {
        matchedId = headings[i].id;
      } else {
        break;
      }
    }

    if (!matchedId && headings.length) {
      matchedId = headings[0].id;
    }

    if (matchedId) {
      updateActiveLink(matchedId);
    }
  }

  var onScrollThrottled = kit.util ? kit.util.throttleRAF(handleScroll) : handleScroll;

  function initToc() {
    if (typeof document === "undefined") return;
    headings = getHeadings();
    if (!headings.length) {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.toc");
      return;
    }

    allLinkNodes = [];

    // 1. Desktop sidebar TOC
    var desktopToc = document.querySelector(".kit-toc, .toc, [data-auto-toc]");
    if (desktopToc) {
      desktopToc.innerHTML = "";

      var header = document.createElement("div");
      header.className = "kit-toc__header toc-header";
      var title = document.createElement("p");
      title.className = "kit-toc__title toc-title";
      title.textContent = "本课目录";
      header.appendChild(title);
      desktopToc.appendChild(header);

      desktopScrollBox = document.createElement("div");
      desktopScrollBox.className = "kit-toc__scroll toc-scroll";
      var ul = document.createElement("ul");
      ul.className = "kit-toc__list toc-list";

      renderList(ul);
      desktopScrollBox.appendChild(ul);
      desktopToc.appendChild(desktopScrollBox);
    }

    // 2. Tablet floating popover button
    var popoverBtn = document.createElement("button");
    popoverBtn.type = "button";
    popoverBtn.className = "kit-toc-btn";
    popoverBtn.textContent = "目录";
    document.body.appendChild(popoverBtn);

    var popover = document.createElement("div");
    popover.className = "kit-toc-popover";
    var popoverUl = document.createElement("ul");
    popoverUl.className = "kit-toc__list toc-list";
    renderList(popoverUl, function () { popover.classList.remove("is-open"); });
    popover.appendChild(popoverUl);
    document.body.appendChild(popover);

    popoverBtn.addEventListener("click", function () {
      popover.classList.toggle("is-open");
    });

    // 3. Mobile bar and bottom drawer
    var mobileBar = document.createElement("div");
    mobileBar.className = "kit-toc-mobile-bar";
    mobileBar.innerHTML = "<span>目录</span><small>▼</small>";
    var page = document.querySelector(".kit-page, .course-shell");
    if (page) page.insertBefore(mobileBar, page.firstChild);

    var backdrop = document.createElement("div");
    backdrop.className = "kit-backdrop";
    document.body.appendChild(backdrop);

    var drawer = document.createElement("div");
    drawer.className = "kit-drawer";
    var drawerUl = document.createElement("ul");
    drawerUl.className = "kit-toc__list toc-list";
    renderList(drawerUl, function () {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
    });
    drawer.appendChild(drawerUl);
    document.body.appendChild(drawer);

    function toggleMobileDrawer() {
      var isOpen = drawer.classList.toggle("is-open");
      backdrop.classList.toggle("is-open", isOpen);
    }

    mobileBar.addEventListener("click", toggleMobileDrawer);
    backdrop.addEventListener("click", function () {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
    });

    // Keyboard handling
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        popover.classList.remove("is-open");
        drawer.classList.remove("is-open");
        backdrop.classList.remove("is-open");
      }
    });

    window.addEventListener("scroll", onScrollThrottled, { passive: true });
    handleScroll();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.toc");
    }
  }

  kit.toc = {
    init: initToc
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToc);
    else initToc();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: learning.records (records.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var LearnKit = root.LearnKit || (kit.store);

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

  function strongerAssistance(current, incoming) {
    if (current === "ai_guided") return current;
    return incoming || current;
  }

  function evidenceModel() {
    return {
      initialState: function () { return { questions: {} }; },
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

  function multiline(value) {
    return String(value || "未填写").replace(/\r?\n/g, "\n  ");
  }

  function selectedLabels(node) {
    return Array.prototype.slice.call(
      node.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')
    ).map(function (input) {
      var label = input.closest("label");
      return label ? label.textContent.trim() : input.value;
    });
  }

  function fieldAnswer(node) {
    var selected = selectedLabels(node);
    if (selected.length) return selected.join("；");
    var field = node.querySelector("textarea, input:not([type=radio]):not([type=checkbox])");
    return field && field.value.trim() ? field.value.trim() : "";
  }

  function buildLearningRecord(lesson, state) {
    var questions = (state && state.questions) || {};
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
      if (Object.keys(q.turns || {}).length) hasContent = true;
      var result = node && (node.dataset.answerKind === "open" || node.dataset.kind === "open" || node.dataset.kind === "dialogue")
        ? "not-applicable"
        : (q.verdict || "not-checked");

      var independence = q.independence;
      if (!independence) {
        if (q.hintUsed) independence = "with_hints";
        else if (q.attempts > 0) independence = "independent";
        else independence = "unknown";
      }

      var observed = q.observedAssistance;
      if (!observed) {
        if (q.hintUsed) observed = "with_hints (使用了页面提示)";
        else if (q.attempts > 0) observed = "未观察到外部辅助，独立完成";
        else observed = "未作答";
      }

      lines.push(
        "",
        "### " + id,
        "",
        "- 原始答案: " + multiline(answer),
        "- 检查次数: " + q.attempts,
        "- 使用提示: " + (q.hintUsed ? "是" : "否"),
        "- 辅助情况（学习者自述）: " + independence,
        "- 页面观察到的帮助: " + observed,
        "- 已查看对照要点: " + (q.answerViewed ? "是（作答后）" : "否"),
        "- 即时判定: " + result
      );
      Object.keys(q.turns || {}).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (turnId) {
        var turn = q.turns[turnId];
        var turnNode = node ? node.querySelector('[data-dialogue-turn="' + turnId + '"]') : null;
        var field = turnNode ? turnNode.querySelector("textarea") : null;
        var raw = turn.raw || (field ? field.value : "");
        if (String(raw || "").trim()) hasContent = true;
        var promptText = turnNode ? (turnNode.querySelector("[data-dialogue-prompt]") || turnNode) : null;
        lines.push("", "#### 轮次 " + turnId,
          "- 追问: " + multiline(promptText ? kit.util.plainText(promptText) : ""),
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
    return { text: lines.join("\n"), hasContent: hasContent };
  }

  function initPrintState() {
    if (typeof window === "undefined") return;
    var params = new URLSearchParams(window.location.search);
    var exportMode = params.get("export");
    if (exportMode === "student" || exportMode === "review") {
      document.documentElement.dataset.exportMode = exportMode;
    }
    window.addEventListener("beforeprint", function () { document.documentElement.classList.add("is-printing"); });
    window.addEventListener("afterprint", function () { document.documentElement.classList.remove("is-printing"); });
  }

  function initRecords() {
    if (typeof document === "undefined") return;
    var lesson = document.querySelector(".lesson");
    if (!lesson) {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("learning.records");
      return;
    }

    var store = lesson.__evidenceStore;
    if (!store && LearnKit && LearnKit.createStore) {
      store = LearnKit.createStore(evidenceModel());
      lesson.__evidenceStore = store;
    }

    Array.prototype.slice.call(document.querySelectorAll("[data-copy-feedback]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var status = lesson.querySelector("[data-copy-feedback-status]");
        var record = buildLearningRecord(lesson, store ? store.getState() : {});
        if (!record.hasContent) {
          if (status) status.textContent = "请先完成练习或填写反馈";
          return;
        }
        var reset = function () { setTimeout(function () { if (status) status.textContent = ""; }, 1800); };
        kit.util.copyText(record.text,
          function () { if (status) status.textContent = "学习记录已复制"; reset(); },
          function () { if (status) status.textContent = "复制失败，请手动选择内容"; reset(); });
      });
    });

    initPrintState();
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("learning.records");
  }

  kit.records = {
    EVIDENCE: EVIDENCE,
    evidenceModel: evidenceModel,
    buildLearningRecord: buildLearningRecord,
    initPrintState: initPrintState,
    init: initRecords
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRecords);
    else initRecords();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: learning.question (question.js) ---- */
  (function () {
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
          var p = el("label", "q-turn-prompt", li.textContent);
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

  /* ---- Legacy Compatibility Wiring ---- */

  function bindLegacyQuiz(el, store) {
    var id = el.dataset.questionId;
    if (!id) return;
    var submit = el.querySelector("[data-quiz-submit]");
    var feedback = el.querySelector(".quiz-feedback");
    var hintBtn = el.querySelector("[data-hint]");
    var targetId = hintBtn ? hintBtn.getAttribute("aria-controls") : null;
    var hintPanel = targetId ? document.getElementById(targetId) : el.querySelector(".quiz-hint-panel, [data-hint-panel]");
    var inputs = Array.prototype.slice.call(el.querySelectorAll('input[type="radio"], input[type="checkbox"]'));

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    if (hintBtn) {
      hintBtn.addEventListener("click", function () {
        if (hintPanel) hintPanel.hidden = false;
        hintBtn.disabled = true;
        hintBtn.classList.add("is-active");
        hintBtn.textContent = "💡 已查看提示";
        var guidance = hintBtn.dataset.guidance === "ai_guided" ? "ai_guided" : "with_hints";
        dispatch({ type: EVIDENCE.HINT, id: id });
        dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: guidance });
        dispatch({ type: EVIDENCE.INDEPENDENCE, id: id, value: guidance });
      });
    }

    if (submit) {
      submit.addEventListener("click", function () {
        var selected = inputs.filter(function (input) { return input.checked; });
        if (!selected.length) {
          if (feedback) {
            feedback.textContent = "先选择一个答案，再提交。";
            feedback.dataset.state = "";
          }
          return;
        }

        var correctInputs = inputs.filter(function (input) { return input.dataset.correct === "true"; });
        var correct = selected.length === correctInputs.length &&
          selected.every(function (input) { return input.dataset.correct === "true"; });

        var selectedLabelsList = selected.map(function (input) {
          var l = input.closest("label");
          return l ? l.textContent.trim() : input.value;
        });

        var qState = (store && store.getState().questions[id]) || {};
        var hintUsed = qState.hintUsed;
        var independenceVal = hintUsed ? "with_hints" : "independent";
        var assistanceVal = hintUsed ? "with_hints" : "none";

        dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: selectedLabelsList.join("；") });
        dispatch({ type: EVIDENCE.ATTEMPT, id: id });
        dispatch({ type: EVIDENCE.INDEPENDENCE, id: id, value: independenceVal });
        dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: assistanceVal });
        dispatch({ type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect" });
      });
    }

    return {
      update: function (node, snapshot) {
        var q = (snapshot.derived && snapshot.derived.questions && snapshot.derived.questions[id]) ||
                (snapshot.questions && snapshot.questions[id]);
        if (!q) return;
        el.dataset.attempts = String(q.attempts || 0);
        el.dataset.hintUsed = q.hintUsed ? "true" : "false";
        el.dataset.independence = q.independence || "";
        if (q.hintUsed && hintBtn) {
          hintBtn.disabled = true;
          hintBtn.classList.add("is-active");
          if (hintPanel) hintPanel.hidden = false;
        }
        if (q.verdict) {
          if (feedback) {
            feedback.dataset.state = q.verdict;
            feedback.textContent = q.verdict === "correct" ? (el.dataset.correctText || "正确。") : (el.dataset.incorrectText || "再检查条件。");
          }
          if (q.verdict === "correct") {
            inputs.forEach(function (inp) { inp.disabled = true; });
            if (submit) submit.disabled = true;
          }
        }
      }
    };
  }

  function bindLegacyAnswer(el, store) {
    var id = el.dataset.questionId;
    var input = el.querySelector("[data-answer-input]");
    var button = el.querySelector("[data-answer-check]");
    var feedback = el.querySelector("[data-role~=answer-feedback], .answer-feedback");

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    if (!input || !button) return { update: function () {} };

    input.addEventListener("input", function () {
      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: input.value });
    });

    button.addEventListener("click", function () {
      var raw = input.value;
      if (!raw.trim()) {
        if (feedback) feedback.textContent = "先填写答案。";
        return;
      }
      var correct = false;
      if (el.dataset.answerKind === "numeric") {
        var value = Number(raw), expected = Number(el.dataset.expected);
        var tolerance = Number(el.dataset.tolerance || 0);
        correct = Number.isFinite(value) && Number.isFinite(expected) && Number.isFinite(tolerance) && tolerance >= 0 && Math.abs(value - expected) <= tolerance;
      } else {
        var accepted;
        try { accepted = JSON.parse(el.dataset.accepted || "[]"); } catch (error) { accepted = []; }
        var cs = el.dataset.caseSensitive === "true";
        correct = Array.isArray(accepted) && accepted.some(function (answer) {
          return typeof answer === "string" && norm(answer, cs) === norm(raw, cs);
        });
      }
      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: raw });
      dispatch({ type: EVIDENCE.ATTEMPT, id: id });
      dispatch({ type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect" });
    });

    return {
      update: function (node, snapshot) {
        var q = (snapshot.derived && snapshot.derived.questions && snapshot.derived.questions[id]) ||
                (snapshot.questions && snapshot.questions[id]);
        if (!q) return;
        el.dataset.attempts = String(q.attempts || 0);
        if (feedback && q.verdict) {
          feedback.textContent = q.verdict === "correct" ? (el.dataset.correctText || "本题正确。请解释依据。") : (el.dataset.incorrectText || "再检查条件与方法。");
          feedback.dataset.state = q.verdict;
          feedback.setAttribute("role", "status");
        }
      }
    };
  }

  function bindLegacyTeachingTarget(el, store) {
    var id = el.dataset.questionId;
    var check = el.querySelector("[data-teaching-check]");
    var answer = el.querySelector("textarea");
    var key = el.querySelector("[data-teaching-key]");

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    if (check && answer && key) {
      key.hidden = true;
      check.hidden = false;
      check.addEventListener("click", function () {
        if (!answer.value.trim()) { answer.focus(); return; }
        dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: answer.value });
        dispatch({ type: EVIDENCE.KEY_VIEWED, id: id });
        answer.readOnly = true;
        key.hidden = false;
        check.disabled = true;
      });
    }
    return {
      update: function (node, snapshot) {
        var q = (snapshot.derived && snapshot.derived.questions && snapshot.derived.questions[id]) ||
                (snapshot.questions && snapshot.questions[id]);
        if (q && q.answerViewed) el.dataset.answerViewed = "true";
      }
    };
  }

  function bindLegacyDialogue(el, store) {
    var id = el.dataset.questionId;
    var turns = Array.prototype.slice.call(el.querySelectorAll("[data-dialogue-turn]"));
    var next = el.querySelector("[data-dialogue-next]");
    var status = el.querySelector("[data-dialogue-status]");
    var current = 0;

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    if (turns.length && next && !turns.some(function (t) { return !t.querySelector("textarea"); })) {
      turns.forEach(function (turn, idx) { turn.hidden = idx > 0; });
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
        dispatch({ type: EVIDENCE.TURN_RAW, id: id, turn: turnId, value: answer.value });
        dispatch({ type: EVIDENCE.TURN_SUBMITTED, id: id, turn: turnId });
        answer.readOnly = true;
        if (current + 1 < turns.length) {
          current += 1;
          turns[current].hidden = false;
          var guidance = turns[current].dataset.guidance;
          if (guidance === "with_hints" || guidance === "ai_guided") {
            dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: guidance });
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
      update: function (node, snapshot) {
        var q = (snapshot.derived && snapshot.derived.questions && snapshot.derived.questions[id]) ||
                (snapshot.questions && snapshot.questions[id]);
        if (!q) return;
        el.dataset.attempts = String(Object.keys(q.turns || {}).length);
      }
    };
  }

  function bindLegacyIndependence(el, store) {
    var id = el.dataset.questionId;
    var select = el.querySelector("select[data-independence]");
    if (!id || !select) return { update: function () {} };

    select.addEventListener("change", function () {
      var q = (store && store.getState().questions[id]) || {};
      var observed = q.observedAssistance;
      var value = select.value;
      if (observed && value === "independent") value = observed;
      if (observed === "ai_guided" && value === "with_hints") value = observed;
      select.value = value;
      if (store && store.dispatch) {
        store.dispatch({ type: EVIDENCE.INDEPENDENCE, id: id, value: value });
      }
    });

    return {
      update: function (node, snapshot) {
        var q = (snapshot.derived && snapshot.derived.questions && snapshot.derived.questions[id]) ||
                (snapshot.questions && snapshot.questions[id]);
        if (q && select.value !== q.independence) select.value = q.independence || "";
      }
    };
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

    var legacyInstances = [];

    // 1. Process modern questions:
    // Elements having [data-kind] or .question with [data-stem]/[data-options]
    var modernSelector = "section.question, .question[data-kind], section[data-question-id][data-kind], section[data-question-id]:has([data-stem])";
    var modernEls = Array.prototype.slice.call(document.querySelectorAll(modernSelector));
    modernEls.forEach(function (qEl, i) {
      enhanceModernQuestion(qEl, i, store);
    });

    // 2. Process legacy elements (if not already enhanced by modern):
    var legacyQuizEls = Array.prototype.slice.call(document.querySelectorAll(".quiz[data-question-id]"))
      .filter(function (el) { return modernEls.indexOf(el) < 0; });
    legacyQuizEls.forEach(function (el) {
      var view = bindLegacyQuiz(el, store);
      if (view) legacyInstances.push({ el: el, view: view });
    });

    var legacyAnswerEls = Array.prototype.slice.call(document.querySelectorAll('[data-answer-kind="numeric"], [data-answer-kind="fill"]'))
      .filter(function (el) { return modernEls.indexOf(el) < 0; });
    legacyAnswerEls.forEach(function (el) {
      var view = bindLegacyAnswer(el, store);
      if (view) legacyInstances.push({ el: el, view: view });
    });

    var legacyTargetEls = Array.prototype.slice.call(document.querySelectorAll('[data-role~="teaching-target"]'))
      .filter(function (el) { return modernEls.indexOf(el) < 0; });
    legacyTargetEls.forEach(function (el) {
      var view = bindLegacyTeachingTarget(el, store);
      if (view) legacyInstances.push({ el: el, view: view });
    });

    var legacyDialogueEls = Array.prototype.slice.call(document.querySelectorAll('[data-role~="dialogue-practice"]'))
      .filter(function (el) { return modernEls.indexOf(el) < 0; });
    legacyDialogueEls.forEach(function (el) {
      var view = bindLegacyDialogue(el, store);
      if (view) legacyInstances.push({ el: el, view: view });
    });

    var legacyIndepEls = Array.prototype.slice.call(document.querySelectorAll("[data-question-id]:has(select[data-independence])"));
    legacyIndepEls.forEach(function (el) {
      var view = bindLegacyIndependence(el, store);
      if (view) legacyInstances.push({ el: el, view: view });
    });

    // Subscribe to store updates for legacy views
    if (store && store.subscribe) {
      store.subscribe(function (snapshot) {
        legacyInstances.forEach(function (inst) {
          try { inst.view.update(inst.el, snapshot); } catch (e) {}
        });
      });
      // Initial paint for legacy views
      var initSnapshot = store.snapshot ? store.snapshot() : store.getState();
      legacyInstances.forEach(function (inst) {
        try { inst.view.update(inst.el, initSnapshot); } catch (e) {}
      });
    }

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

  })();

  /* ---- Module: viz.core (visualizations.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var adapters = {};
  var document = root.document;
  var moduleBase = document && document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/[^/]*$/, "") : null;
  var assetPromises = {};

  /* --- Shared numeric and DOM helpers used by every kind ---------------- */

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function finiteArray(values) { return Array.isArray(values) && values.length > 0 && values.every(finite); }
  function find(node, selector) { return node.querySelector(selector); }
  function fmt(value) { return finite(value) ? Number(value.toPrecision(8)).toString() : String(value); }
  function escape(value) { return String(value).replace(/[&<>"]/g, function (ch) { return {"&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;"}[ch]; }); }
  function record(node, state) { node.dataset.visualState = JSON.stringify(state); }
  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function status(node, text) { var target = find(node, "[data-viz-status]"); if (target) target.textContent = text; }
  function show(node) { var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]"); if (host) host.hidden = false; if (controls) controls.hidden = false; }

  function loadAsset(relative, globalName, stylesheet) {
    if (globalName && root[globalName]) return Promise.resolve(true);
    if (!document || !moduleBase) return Promise.resolve(false);
    if (assetPromises[relative]) return assetPromises[relative];
    assetPromises[relative] = new Promise(function (resolve) {
      var url;
      try { url = new URL(relative, moduleBase).href; }
      catch (error) { url = moduleBase + relative; }
      if (stylesheet) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.onload = function () { resolve(true); };
        link.onerror = function () { resolve(false); };
        document.head.appendChild(link);
      } else {
        var script = document.createElement("script");
        script.src = url;
        script.onload = function () { resolve(true); };
        script.onerror = function () { resolve(false); };
        document.head.appendChild(script);
      }
    });
    return assetPromises[relative];
  }

  function registerKind(name, adapter) {
    if (!name || typeof name !== "string") throw new Error("Kind name required");
    if (!adapter || typeof adapter.render !== "function") throw new Error("Adapter must implement render()");
    if (typeof adapter.validate !== "function") throw new Error("Adapter must implement validate()");
    adapters[name] = adapter;
  }

  function validateCommon(config) {
    if (!config || typeof config !== "object") throw new Error("配置必须是 JSON 对象");
    ["model", "domain", "precision"].forEach(function (key) {
      if (typeof config[key] !== "string" || !config[key].trim()) {
        throw new Error("配置缺少非空说明字段：" + key);
      }
    });
    return config;
  }

  function validateConfig(kind, config) {
    var adapter = adapters[kind];
    if (!adapter) throw new Error("未知可视化类型：" + kind);
    return adapter.validate(config);
  }

  var api = {
    validateCommon: validateCommon,
    validateConfig: validateConfig,
    registerKind: registerKind,
    adapters: adapters,
    helpers: {
      finite: finite,
      finiteArray: finiteArray,
      find: find,
      fmt: fmt,
      escape: escape,
      boundConfig: function (node, config, snapshot) {
        var derived = snapshot && snapshot.derived || {};
        var value = derived.visualizations && derived.visualizations[node.id] || derived.visualization;
        return value ? Object.assign({}, config, value) : config;
      },
      record: record,
      svgEl: svgEl,
      clear: clear,
      status: status,
      show: show,
      loadVendor: function (relative, globalName) { return loadAsset("vendor/" + relative, globalName, false); },
      loadStylesheet: function (relative) { return loadAsset("vendor/" + relative, null, true); }
    },
    loaded: function () { return Object.keys(adapters).sort(); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CourseVisualizations = api;
  kit.viz = api;

  async function init() {
    if (!document) return;
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-visualization]"));
    await Promise.all(nodes.map(async function (node) {
      try {
        node.dataset.kitState = "pending";
        var configNode = find(node, "[data-viz-config]");
        if (!configNode) throw new Error("缺少 data-viz-config");
        var kind = node.dataset.visualization, config = validateConfig(kind, JSON.parse(configNode.textContent));
        var sourceStore = null;
        if (node.dataset.vizSource) {
          var source = document.querySelector(node.dataset.vizSource);
          sourceStore = source && source.__learnkitStore;
          if (!sourceStore) throw new Error("data-viz-source 未找到 LearnKit 状态源：" + node.dataset.vizSource);
        }
        var instance = await adapters[kind].render(node, config, { sourceStore: sourceStore });
        var instanceUpdate = instance && typeof instance.update === "function" ? instance.update : adapters[kind].update;
        if (sourceStore && typeof instanceUpdate !== "function") throw new Error("此适配器不支持 data-viz-source 动态更新");
        if (sourceStore) {
          var revision = 0;
          var update = function (snapshot) {
            var current = ++revision;
            function failed(error) {
              if (current !== revision) return;
              node.dataset.vizReady = "failed";
              node.dataset.kitState = "failed";
              var host = find(node, "[data-viz-host]"); if (host) host.hidden = true;
              status(node, error.message);
            }
            try {
              var result = instanceUpdate(node, config, snapshot, instance);
              if (result && typeof result.then === "function") {
                node.dataset.vizReady = "pending";
                node.dataset.kitState = "pending";
                return Promise.resolve(result).then(function () {
                  if (current === revision) {
                    node.dataset.vizReady = "true";
                    node.dataset.kitState = "ready";
                  }
                }, failed);
              }
              node.dataset.vizReady = "true";
              node.dataset.kitState = "ready";
            } catch (error) { failed(error); }
          };
          node.__vizUnsubscribe = sourceStore.subscribe(update);
          await update(sourceStore.snapshot());
        }
        if ((sourceStore || instance && typeof instance.destroy === "function") && root.addEventListener) {
          node.__vizDestroy = function () {
            if (node.__vizUnsubscribe) node.__vizUnsubscribe();
            if (instance && instance.destroy) instance.destroy();
          };
          root.addEventListener("pagehide", node.__vizDestroy, { once: true });
        }
        if (node.dataset.vizReady !== "failed") {
          node.dataset.vizReady = "true";
          node.dataset.kitState = "ready";
        }
      } catch (error) {
        node.dataset.vizReady = "failed";
        node.dataset.kitState = "failed";
        var host = find(node, "[data-viz-host]"), controls = find(node, "[data-viz-controls]");
        if (host) host.hidden = true;
        if (controls) controls.hidden = true;
        status(node, error.message);
      }
    }));
    root.__COURSE_VISUALIZATIONS_READY__ = true;
    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("viz.core");
    }
  }

  api.init = init;

  if (document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else if (document) init();
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: viz.kinds.list (list.js) ---- */
  (function () {
(function (root) {
  "use strict";
  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function validateList(config, field, kind) {
    core.validateCommon(config);
    if (
      !Array.isArray(config[field]) ||
      !config[field].length ||
      config[field].some(function (n) { return !n || typeof n !== "object"; })
    ) {
      throw new Error(kind + " 需要非空 " + field + " 对象数组");
    }
    return config;
  }

  function validateGraph(config, kind) {
    validateList(config, "nodes", kind);
    if (config.edges !== undefined && !Array.isArray(config.edges)) {
      throw new Error(kind + " edges 必须为数组");
    }
    var ids = config.nodes.map(function (n, i) {
      return String(n.id == null ? n.label || n.title || n.name || i + 1 : n.id);
    });
    if (ids.some(function (id, i) { return !id.trim() || ids.indexOf(id) !== i; })) {
      throw new Error(kind + " 节点 id 必须唯一且非空");
    }
    (config.edges || []).forEach(function (e) {
      if (!e || e.from == null || e.to == null || ids.indexOf(String(e.from)) < 0 || ids.indexOf(String(e.to)) < 0) {
        throw new Error(kind + " edges 需要引用现有节点的 from/to");
      }
    });
    return config;
  }

  function name(item, index) {
    return item.title || item.label || item.name || item.id || index + 1;
  }

  function renderList(node, config, kind) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    var items = kind === "timeline" ? config.events : config.nodes;
    function select(item, index) {
      h.status(
        node,
        String(name(item, index)) +
          (item.date ? " · " + item.date : "") +
          (item.description || item.summary ? "：" + (item.description || item.summary) : "")
      );
      h.record(node, { kind: kind, selected: index });
    }

    if (kind !== "timeline") {
      var positions = {};
      var count = items.length;
      var columns = Math.min(4, count);
      var rows = Math.ceil(count / columns);
      var width = 720;
      var height = rows * 150 + 60;
      items.forEach(function (item, i) {
        positions[String(item.id == null ? item.label || item.title || item.name || i + 1 : item.id)] = {
          x: 90 + ((i % columns) * (width - 180)) / Math.max(1, columns - 1),
          y: 60 + Math.floor(i / columns) * 150
        };
      });
      var svg = h.svgEl("svg", {
        viewBox: "0 0 " + width + " " + height,
        role: "img",
        "aria-label": config.model
      });
      var defs = h.svgEl("defs");
      var marker = h.svgEl("marker", {
        id: node.id + "-arrow",
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto"
      });
      marker.appendChild(h.svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--c-text-2, #65738a)" }));
      defs.appendChild(marker);
      svg.appendChild(defs);

      (config.edges || []).forEach(function (edge) {
        var a = positions[String(edge.from)];
        var b = positions[String(edge.to)];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var length = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / length;
        var uy = dy / length;
        var inset = Math.min(ux ? 74 / Math.abs(ux) : Infinity, uy ? 29 / Math.abs(uy) : Infinity);
        if (String(edge.from) === String(edge.to)) {
          svg.appendChild(h.svgEl("path", {
            d: "M " + (a.x - 25) + " " + (a.y - 25) + " C " + (a.x - 90) + " " + (a.y - 90) + " " + (a.x + 90) + " " + (a.y - 90) + " " + (a.x + 25) + " " + (a.y - 25),
            fill: "none",
            stroke: "var(--c-text-2, #65738a)",
            "marker-end": "url(#" + node.id + "-arrow)"
          }));
        } else {
          svg.appendChild(h.svgEl("line", {
            x1: a.x + ux * inset,
            y1: a.y + uy * inset,
            x2: b.x - ux * inset,
            y2: b.y - uy * inset,
            stroke: "var(--c-text-2, #65738a)",
            "stroke-width": 2,
            "marker-end": "url(#" + node.id + "-arrow)"
          }));
        }
      });

      items.forEach(function (item, index) {
        var pos = positions[String(item.id == null ? item.label || item.title || item.name || index + 1 : item.id)];
        var group = h.svgEl("g", {
          tabindex: 0,
          role: "button",
          "aria-label": String(name(item, index))
        });
        group.appendChild(h.svgEl("rect", {
          x: pos.x - 70,
          y: pos.y - 25,
          width: 140,
          height: 50,
          rx: 8,
          fill: "var(--c-surface-2, #eef3ff)",
          stroke: "var(--c-accent, #3157d5)"
        }));
        var text = h.svgEl("text", {
          x: pos.x,
          y: pos.y + 5,
          "text-anchor": "middle",
          "font-size": 14,
          fill: "var(--c-text, currentColor)"
        });
        text.textContent = name(item, index);
        group.appendChild(text);
        group.addEventListener("click", function () { select(item, index); });
        group.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(item, index);
          }
        });
        svg.appendChild(group);
      });
      host.appendChild(svg);
    }

    var list = document.createElement("ol");
    list.className = kind === "timeline" ? "viz-list viz-timeline" : "viz-list";
    items.forEach(function (item, index) {
      var li = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = String(name(item, index));
      button.addEventListener("click", function () { select(item, index); });
      li.appendChild(button);
      if (item.date) {
        var date = document.createElement("span");
        date.className = "viz-date";
        date.textContent = String(item.date);
        li.appendChild(date);
      }
      if (item.description || item.summary) {
        var p = document.createElement("p");
        p.textContent = item.description || item.summary;
        li.appendChild(p);
      }
      list.appendChild(li);
    });
    host.appendChild(list);

    if (config.edges && config.edges.length) {
      var edges = document.createElement("ul");
      edges.className = "viz-edges";
      config.edges.forEach(function (edge) {
        var li = document.createElement("li");
        li.textContent = String(edge.from) + " → " + String(edge.to) + (edge.label ? "：" + edge.label : "");
        edges.appendChild(li);
      });
      host.appendChild(edges);
    }
    h.status(node, "共 " + items.length + " 项；选择一项查看说明。");
    h.record(node, { kind: kind, selected: null });
  }

  function adapter(kind) {
    return {
      validate: function (c) {
        return kind === "timeline" ? validateList(c, "events", kind) : validateGraph(c, kind);
      },
      render: function (n, c) { renderList(n, c, kind); },
      update: function (n, c, s) {
        var next = h.boundConfig(n, c, s);
        kind === "timeline" ? validateList(next, "events", kind) : validateGraph(next, kind);
        renderList(n, next, kind);
      }
    };
  }

  ["relation", "timeline", "process"].forEach(function (kind) {
    core.registerKind(kind, adapter(kind));
  });

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("viz.kinds.list");
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: viz.kinds.sequence (sequence.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
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

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("viz.kinds.sequence");
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: viz.kinds.table (table.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function validateTable(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.columns) || !Array.isArray(config.rows)) throw new Error("table 需要 columns 与 rows");
    return config;
  }

  function renderTable(node, config) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), table = document.createElement("table");
    h.clear(host);
    table.className = "viz-table";
    var head = document.createElement("tr");
    config.columns.forEach(function (column) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = column.label || column.name || column;
      head.appendChild(th);
    });
    table.appendChild(head);
    config.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      config.columns.forEach(function (column) {
        var td = document.createElement("td"), key = column.key || column;
        td.textContent = row[key] == null ? "" : row[key];
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    host.appendChild(table);
    h.status(node, "表格 " + config.rows.length + " 行");
    h.record(node, {kind: "table", rows: config.rows.length});
  }

  core.registerKind("table", {validate: validateTable, render: renderTable, update: function (node, config, snapshot) {
    var next = h.boundConfig(node, config, snapshot); validateTable(next); renderTable(node, next);
  }});

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("viz.kinds.table");
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

})(typeof window !== 'undefined' ? window : globalThis);
