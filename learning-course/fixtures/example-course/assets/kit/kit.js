/**
 * Course Kit v2 Bundled Runtime
 * Built by kit.py. Do not edit directly.
 */
(function (global) {
  "use strict";
  var CourseKit = global.CourseKit = global.CourseKit || {};
  global.kit = global.kit || CourseKit;
  CourseKit.__COURSE_CONFIG__ = {"theme": "course", "vendor": {"mode": "cdn"}, "code": {"themes": {"light": "github", "dark": "github-dark"}}, "modules": []};
  CourseKit.__ACTIVE_MODULES__ = ["core", "foundation", "content._block", "content.callout", "content.code", "shell.nav", "shell.progress", "shell.theme-switcher", "shell.toc", "learning.records", "learning.step"];
  CourseKit.VENDORS = {"hljs": {"id": "hljs", "version": "11.12.0", "js": {"cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js", "local": "../assets/kit/vendor/hljs/highlight.min.js"}}};

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

    // 1. Course-level config injected at bundle time
    if (kit.__COURSE_CONFIG__ && typeof kit.__COURSE_CONFIG__ === "object") {
      deepMerge(cfg, kit.__COURSE_CONFIG__);
    }

    // 2. Page-level #kit-config override
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

  var DEFAULT_VENDORS = {
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
      version: "4.1.2",
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.1.2/plotly.min.js",
        local: "../assets/kit/vendor/plotly.js-dist-min/plotly.min.js"
      }
    },
    jsxgraph: {
      id: "jsxgraph",
      version: "1.14.0",
      css: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraph.css",
        local: "../assets/kit/vendor/jsxgraph/jsxgraph.css"
      },
      js: {
        cdn: "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraphcore.js",
        local: "../assets/kit/vendor/jsxgraph/jsxgraphcore.js"
      }
    }
  };

  var loadingPromises = {};

  function loadScript(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function (e) {
          reject(new Error("Failed to load script: " + url));
        });
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
        var msg = isLocal
          ? "Failed to load local vendor script: " + url + ". External network fallback is prohibited in local mode."
          : "Failed to load vendor script: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs, isLocal) {
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
      link.onerror = function (e) {
        var msg = isLocal
          ? "Failed to load local vendor stylesheet: " + url + ". External network fallback is prohibited in local mode."
          : "Failed to load stylesheet: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(link);
    });
  }

  function need(vendorId) {
    if (loadingPromises[vendorId]) return loadingPromises[vendorId];

    var vendorsRegistry = kit.VENDORS || DEFAULT_VENDORS;
    var vendor = vendorsRegistry[vendorId] || DEFAULT_VENDORS[vendorId];
    if (!vendor) {
      return Promise.reject(new Error("Unknown vendor id: " + vendorId));
    }

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) || "cdn";
    var useLocal = mode === "local";

    var promise;
    if (vendorId === "hljs") {
      var jsUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(jsUrl, null, useLocal);
    } else if (vendorId === "katex") {
      var cssUrl = useLocal ? (vendor.css && vendor.css.local) : (vendor.css && vendor.css.cdn);
      var katexJsUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      var autoRenderUrl = useLocal ? (vendor.autoRender && vendor.autoRender.local) : (vendor.autoRender && vendor.autoRender.cdn);
      promise = loadStyle(cssUrl, null, useLocal).then(function () {
        return loadScript(katexJsUrl, null, useLocal);
      }).then(function () {
        if (autoRenderUrl) {
          return loadScript(autoRenderUrl, null, useLocal);
        }
      });
    } else if (vendorId === "mermaid") {
      var mermaidUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(mermaidUrl, null, useLocal);
    } else if (vendorId === "plotly") {
      var plotlyUrl = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadScript(plotlyUrl, null, useLocal);
    } else if (vendorId === "jsxgraph") {
      var jsxCss = useLocal ? (vendor.css && vendor.css.local) : (vendor.css && vendor.css.cdn);
      var jsxJs = useLocal ? (vendor.js && vendor.js.local) : (vendor.js && vendor.js.cdn);
      promise = loadStyle(jsxCss, null, useLocal).then(function () {
        return loadScript(jsxJs, null, useLocal);
      });
    } else {
      promise = Promise.resolve();
    }

    loadingPromises[vendorId] = promise;
    return promise;
  }

  kit.need = need;
  kit.loader = { need: need };
  kit.VENDORS = kit.VENDORS || DEFAULT_VENDORS;
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
  var degradedModules = [];
  var pendingModules = new Set();
  var isGlobalSettled = false;

  // Pre-register active modules if injected
  if (Array.isArray(kit.__ACTIVE_MODULES__)) {
    kit.__ACTIVE_MODULES__.forEach(function (id) {
      pendingModules.add(id);
    });
  }

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

  function markModuleDegraded(moduleId, reason) {
    if (degradedModules.indexOf(moduleId) === -1) {
      degradedModules.push(moduleId);
    }
    if (readyModules.indexOf(moduleId) === -1) {
      readyModules.push(moduleId);
    }
    pendingModules.delete(moduleId);
    kit.emit("kit:" + moduleId + ":degraded", { module: moduleId, reason: reason });
    checkGlobalReady();
  }

  function registerPendingModule(moduleId) {
    if (readyModules.indexOf(moduleId) === -1 && failedModules.indexOf(moduleId) === -1) {
      pendingModules.add(moduleId);
    }
  }

  function checkGlobalReady() {
    if (pendingModules.size === 0 && !isGlobalSettled) {
      isGlobalSettled = true;
      var isAllSuccess = failedModules.length === 0;

      if (typeof document !== "undefined") {
        document.documentElement.dataset.kitStatus = "settled";
        document.documentElement.dataset.kitReady = isAllSuccess ? "true" : "false";
        document.documentElement.dataset.courseReady = isAllSuccess ? "true" : "false";
      }

      var payload = {
        ready: readyModules.slice(),
        failed: failedModules.slice(),
        degraded: degradedModules.slice(),
        success: isAllSuccess
      };

      kit.emit("kit:ready", payload);
      kit.emit("kit:settled", payload);

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
    markDegraded: markModuleDegraded,
    registerPending: registerPendingModule,
    isReady: function () { return isGlobalSettled && failedModules.length === 0; },
    isSettled: function () { return isGlobalSettled; },
    getStatus: function () { return isGlobalSettled ? "settled" : "pending"; },
    getReadyModules: function () { return readyModules.slice(); },
    getFailedModules: function () { return failedModules.slice(); },
    getDegradedModules: function () { return degradedModules.slice(); }
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
  var initialized = {};

  function initModule(id) {
    if (initialized[id]) return Promise.resolve();
    initialized[id] = true;
    var mod = modules[id];
    if (!mod || typeof mod.init !== "function") {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
    var res;
    try {
      res = mod.init(kit);
    } catch (err) {
      console.error("[kit] Module " + id + " init failed:", err);
      if (kit.ready && kit.ready.markFailed) kit.ready.markFailed(id, err);
      return Promise.resolve();
    }
    if (res && typeof res.then === "function") {
      return res.then(function () {
        if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      }).catch(function (err) {
        console.error("[kit] Async module " + id + " init failed:", err);
        if (kit.ready && kit.ready.markFailed) kit.ready.markFailed(id, err);
      });
    } else {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
  }

  kit.registerModule = function (id, mod) {
    modules[id] = mod;
    // Standalone fallback: If not bundled with __ACTIVE_MODULES__, initialize immediately
    if (!Array.isArray(kit.__ACTIVE_MODULES__)) {
      initModule(id);
    }
  };

  kit.getModule = function (id) {
    return modules[id];
  };

  kit.listModules = function () {
    return Object.keys(modules);
  };

  async function initAll() {
    var order = Array.isArray(kit.__ACTIVE_MODULES__) ? kit.__ACTIVE_MODULES__ : Object.keys(modules);
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      await initModule(id);
    }
  }

  kit.initAll = initAll;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAll);
    } else {
      initAll();
    }
  }
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

  /* ---- Module: content.callout (callout.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var TITLES = {
    note: "注意",
    info: "说明",
    tip: "提示",
    warning: "警告",
    danger: "危险"
  };

  function enhanceCallout(el) {
    var type = el.dataset.callout || "note";
    if (!el.querySelector(".callout__title")) {
      var title = document.createElement("div");
      title.className = "callout__title";
      title.textContent = TITLES[type] || type.toUpperCase();
      el.insertBefore(title, el.firstChild);
    }
  }

  function init() {
    if (typeof document === "undefined") return;
    var callouts = document.querySelectorAll(".callout, aside[data-callout]");
    Array.prototype.forEach.call(callouts, enhanceCallout);
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.callout");
  }

  kit.callout = {
    init: init
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
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
      return Promise.resolve();
    } else if (lang !== "text" && kit.need) {
      return kit.need("hljs").then(function () {
        if (root.hljs) {
          try {
            root.hljs.highlightElement(codeNode);
          } catch (e) {}
        }
        block.root.dataset.kitState = "ready";
      }).catch(function (err) {
        block.root.dataset.kitState = "failed";
        console.warn("[kit.code] Syntax highlighting failed:", err);
      });
    } else {
      block.root.dataset.kitState = "ready";
      return Promise.resolve();
    }
  }

  // Legacy .code-block support
  function enhanceLegacyCodeBlocks() {
    var legacyBlocks = document.querySelectorAll(".code-block:not(.kit-block)");
    var promises = [];
    Array.prototype.forEach.call(legacyBlocks, function (el) {
      var code = el.querySelector("code");
      if (code) {
        var p = enhanceCodeBlock(code);
        if (p) promises.push(p);
      }
    });
    return promises;
  }

  function init() {
    if (typeof document === "undefined") return Promise.resolve();

    var codeNodes = document.querySelectorAll("pre > code");
    var promises = [];
    Array.prototype.forEach.call(codeNodes, function (node) {
      var p = enhanceCodeBlock(node);
      if (p) promises.push(p);
    });
    var legacyPromises = enhanceLegacyCodeBlocks();
    promises = promises.concat(legacyPromises);

    return Promise.all(promises);
  }

  kit.code = {
    init: init,
    enhance: enhanceCodeBlock
  };

  if (kit.registerModule) {
    kit.registerModule("content.code", kit.code);
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
    if (typeof document === "undefined") return;

    var navEls = document.querySelectorAll("nav.kit-nav, [data-kit-nav]");

    // Keyboard navigation shortcuts: [ for prev, ] for next
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable)) {
        return;
      }
      if (e.key === "[" || (e.altKey && e.key === "ArrowLeft")) {
        var prev = document.querySelector('[data-nav-prev], a[rel="prev"]');
        if (prev && prev.href) prev.click();
      } else if (e.key === "]" || (e.altKey && e.key === "ArrowRight")) {
        var next = document.querySelector('[data-nav-next], a[rel="next"]');
        if (next && next.href) next.click();
      }
    });

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.nav");
    }
  }

  kit.nav = {
    init: initNav
  };

  if (kit.registerModule) {
    kit.registerModule("shell.nav", kit.nav);
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
    return field ? field.value : "";
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
      var learnerStatement = independence ? independence : "未填写/待确认 (页内未设置自述输入)";

      var observed = q.observedAssistance;
      if (!observed) {
        if (q.hintUsed) observed = "with_hints (使用了页面提示)";
        else if (q.answerViewed) observed = "answer_revealed (查看了解析/对照要点)";
        else if (q.attempts > 0) observed = "none (未在页内使用提示；外部辅助不可观测)";
        else observed = "not_attempted (未作答)";
      }

      lines.push(
        "",
        "### " + id,
        "",
        "- 原始答案: " + multiline(answer),
        "- 检查次数: " + q.attempts,
        "- 使用提示: " + (q.hintUsed ? "是" : "否"),
        "- 辅助情况（学习者自述）: " + learnerStatement,
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

  if (kit.registerModule) {
    kit.registerModule("learning.records", kit.records);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRecords);
    else initRecords();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: learning.step (step.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initSteps() {
    if (typeof document === "undefined") return;

    var buttons = document.querySelectorAll("[data-step-next]");
    buttons.forEach(function (next) {
      var scope = next.closest("[data-steps-scope]") ||
        next.closest("section, .card, .lesson") ||
        next.parentElement;
      var items = scope ? Array.prototype.slice.call(scope.querySelectorAll(".step")) : [];
      if (items.length < 2) return;

      next.addEventListener("click", function () {
        var hidden = items.findIndex(function (item) { return item.classList.contains("is-hidden"); });
        if (hidden >= 0) {
          items[hidden].classList.remove("is-hidden");
          var remaining = items.filter(function (item) { return item.classList.contains("is-hidden"); });
          if (remaining.length === 0) {
            next.disabled = true;
          }
        } else {
          next.disabled = true;
        }
      });
    });

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("learning.step");
    }
  }

  kit.step = {
    init: initSteps
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSteps);
    else initSteps();
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

})(typeof window !== 'undefined' ? window : globalThis);
