/**
 * Course Kit v2 Bundled Runtime
 * Built by kit.py. Do not edit directly.
 */
(function (global) {
  "use strict";
  var CourseKit = global.CourseKit = global.CourseKit || {};
  global.kit = global.kit || CourseKit;
  CourseKit.__COURSE_CONFIG__ = {"theme": "course", "vendor": {"mode": "cdn"}, "code": {"themes": {"light": "github", "dark": "github-dark"}}, "modules": []};
  CourseKit.__ACTIVE_MODULES__ = ["core", "foundation", "content._block", "content.callout", "content.code", "shell.elements", "shell.nav", "shell.progress", "shell.theme-switcher", "shell.toc", "learning.records", "learning.step"];
  CourseKit.VENDORS = {"hljs": {"id": "hljs", "version": "11.12.0", "js": {"cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js", "local": "../assets/kit/vendor/hljs/highlight.min.js"}}};
  CourseKit.__LOCAL_VENDORS__ = [];
  CourseKit.__THEMES__ = {"blueprint": {"label": "工程蓝图", "scheme": "dark", "fonts": ["noto-sans-sc:400,700", "jetbrains-mono:400,700"]}, "brutal": {"label": "新粗野", "scheme": "light", "code": "dark", "fonts": ["noto-sans-sc:400,700,900", "space-grotesk:500,700", "jetbrains-mono:400,700"]}, "course": {"label": "默认", "scheme": "light"}, "field": {"label": "博物志", "scheme": "light", "code": "dark", "fonts": ["lxgw-wenkai", "jetbrains-mono:400,700"]}, "ink": {"label": "深色", "scheme": "dark"}, "paper": {"label": "纸张", "scheme": "light"}, "riso": {"label": "孔版印刷", "scheme": "light", "code": "dark", "fonts": ["noto-sans-sc:400,700,900", "space-grotesk:500,700"]}, "swiss": {"label": "瑞士网格", "scheme": "light", "code": "dark", "fonts": ["noto-sans-sc:400,700,900", "jetbrains-mono:400,700"]}};
  CourseKit.__EXTENSIONS__ = [];

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

  // Dev fallback registry for unbundled kit/ source. Bundle output is
  // authoritative: kit.py injects the active subset as CourseKit.VENDORS.
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
    plot: {
      id: "plot",
      version: "0.6.16",
      js: {
        cdn: "https://cdn.jsdelivr.net/combine/npm/d3@7.9.0/dist/d3.min.js,npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js",
        local: "../assets/kit/vendor/observable-plot/plot.bundle.min.js"
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

  function resolveVendorUrl(url, isLocal) {
    if (!url) return null;
    if (!isLocal) return url;
    if (typeof document !== "undefined") {
      var kitScript = document.querySelector('script[src*="kit.js"]');
      if (kitScript) {
        var src = kitScript.getAttribute("src") || "";
        var match = src.match(/^(.*?)kit\.js/);
        if (match) {
          var kitDir = match[1];
          var vendorRel = url.replace(/^(\.\.\/)+assets\/kit\//, "").replace(/^assets\/kit\//, "");
          return kitDir + vendorRel;
        }
      }
    }
    return url;
  }

  function loadScript(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("jsdom") >= 0) {
      return Promise.reject(new Error("External script loading is not supported in JSDOM: " + url));
    }
    return new Promise(function (resolve, reject) {
      var timer = null;
      if (typeof setTimeout === "function") {
        timer = setTimeout(function () {
          reject(new Error("Timeout loading script: " + url));
        }, isLocal ? 10000 : 30000);
      }
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") {
          if (timer) clearTimeout(timer);
          return resolve();
        }
        existing.addEventListener("load", function () {
          if (timer) clearTimeout(timer);
          resolve();
        });
        existing.addEventListener("error", function (e) {
          if (timer) clearTimeout(timer);
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
        if (timer) clearTimeout(timer);
        s.dataset.loaded = "true";
        resolve();
      };
      s.onerror = function (e) {
        if (timer) clearTimeout(timer);
        var msg = isLocal
          ? "Failed to load local vendor script: " + url
          : "Failed to load vendor script: " + url;
        reject(new Error(msg));
      };
      document.head.appendChild(s);
    });
  }

  function loadStyle(url, attrs, isLocal) {
    if (typeof document === "undefined") return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("jsdom") >= 0) {
      return Promise.reject(new Error("External stylesheet loading is not supported in JSDOM: " + url));
    }
    return new Promise(function (resolve, reject) {
      var timer = null;
      if (typeof setTimeout === "function") {
        timer = setTimeout(function () {
          reject(new Error("Timeout loading stylesheet: " + url));
        }, isLocal ? 10000 : 30000);
      }
      var existing = document.querySelector('link[href="' + url + '"]');
      if (existing) {
        if (timer) clearTimeout(timer);
        return resolve();
      }
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
      }
      link.onload = function () {
        if (timer) clearTimeout(timer);
        resolve();
      };
      link.onerror = function (e) {
        if (timer) clearTimeout(timer);
        var msg = isLocal
          ? "Failed to load local vendor stylesheet: " + url
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

    var mode = (kit.config && kit.config.vendor && kit.config.vendor.mode) ||
               (kit.config && kit.config.vendor_mode) || "cdn";
    // Which vendors actually have offline packages is build-time knowledge,
    // injected as kit.__LOCAL_VENDORS__ (scanned from kit/vendor/ by kit.py);
    // this list is only a dev fallback for unbundled kit/ source.
    var localPackages = kit.__LOCAL_VENDORS__ || ["plotly", "jsxgraph", "plot"];
    var useLocal = (mode === "local") && (localPackages.indexOf(vendorId) >= 0);

    function getUrl(item) {
      if (!item) return null;
      if (typeof item === "string") return item;
      var raw = useLocal ? item.local : item.cdn;
      return resolveVendorUrl(raw, useLocal);
    }

    var styles = vendor.css ? (Array.isArray(vendor.css) ? vendor.css : [vendor.css]) : [];
    var scripts = vendor.js ? (Array.isArray(vendor.js) ? vendor.js : [vendor.js]) : [];
    if (vendor.autoRender) scripts.push(vendor.autoRender);

    var promise = Promise.all(styles.map(function (s) {
      var primaryUrl = getUrl(s);
      if (!primaryUrl) return Promise.resolve();
      return loadStyle(primaryUrl, null, useLocal).catch(function (err) {
        if (useLocal && s.cdn) {
          return loadStyle(s.cdn, null, false);
        }
        if (!useLocal && s.local) {
          var fallbackLocal = resolveVendorUrl(s.local, true);
          return loadStyle(fallbackLocal, null, true);
        }
        throw err;
      });
    })).then(function () {
      return scripts.reduce(function (seq, sc) {
        return seq.then(function () {
          var primaryUrl = getUrl(sc);
          if (!primaryUrl) return Promise.resolve();
          return loadScript(primaryUrl, null, useLocal).catch(function (err) {
            // Dual-fallback: if cdn failed, try local; if local failed, try cdn
            if (useLocal && sc.cdn) {
              return loadScript(sc.cdn, null, false);
            }
            if (!useLocal && sc.local) {
              var fallbackLocal = resolveVendorUrl(sc.local, true);
              return loadScript(fallbackLocal, null, true);
            }
            throw err;
          });
        });
      }, Promise.resolve());
    });

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
    var mod = modules[id];
    if (!mod) {
      initialized[id] = true;
      if (kit.ready && kit.ready.markReady) kit.ready.markReady(id);
      return Promise.resolve();
    }
    initialized[id] = true;
    if (typeof mod.init !== "function") {
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

  var allInitialized = false;

  kit.registerModule = function (id, mod) {
    modules[id] = mod;
    // Standalone fallback or dynamic registration after initAll has already run:
    if (!Array.isArray(kit.__ACTIVE_MODULES__) || allInitialized) {
      initModule(id);
    }
  };

  // Base core module lifecycle registration
  kit.registerModule("core", {
    init: function () {
      return Promise.resolve();
    }
  });

  kit.getModule = function (id) {
    return modules[id];
  };

  kit.listModules = function () {
    return Object.keys(modules);
  };

  async function initAll() {
    var order = Array.isArray(kit.__ACTIVE_MODULES__) ? kit.__ACTIVE_MODULES__.slice() : [];
    Object.keys(modules).forEach(function (id) {
      if (order.indexOf(id) === -1) {
        order.push(id);
      }
    });

    // Phase 1: core + foundation (synchronous prerequisites for everything)
    // Phase 2: shell.* (layout: sidebar, TOC, progress bar — must appear immediately)
    // Phase 3: everything else in parallel (content vendors like Mermaid/KaTeX are
    //          heavy CDN loads; they must NOT block the visible layout)
    var shellIds = [];
    var deferredIds = [];
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (id === "core" || id === "foundation") {
        await initModule(id);
      } else if (id.indexOf("shell.") === 0) {
        shellIds.push(id);
      } else {
        deferredIds.push(id);
      }
    }
    for (var j = 0; j < shellIds.length; j++) {
      await initModule(shellIds[j]);
    }
    for (var k = 0; k < deferredIds.length; k++) {
      initModule(deferredIds[k]);
    }

    allInitialized = true;
  }

  kit.initAll = initAll;

  if (typeof document !== "undefined" && !Array.isArray(kit.__ACTIVE_MODULES__)) {
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

  /*
   * 主题预设注册表：单一来源是 kit/foundation/themes/*.css 的 @kit-theme 头，
   * 由 kit.py 构建期解析并注入为 kit.__THEMES__；课程自创预设经 config.customThemes
   * 在 initTheme 注册。scheme：页面明暗；code：代码块高亮使用的明暗（可与页面不同，
   * 例如浅色页面配深色代码块）；fonts：按需加载的网页字体（fontsource 包名:字重，
   * 或完整 URL），失败时回退到 CSS 字体栈。
   */
  var THEMES = kit.__THEMES__ || {};

  function themeMeta(themeName) {
    return THEMES[themeName] || { label: themeName, scheme: "light" };
  }

  function resolveSchemeForTheme(themeName) {
    return themeMeta(themeName).scheme || "light";
  }

  var FONT_URLS = {
    "lxgw-wenkai": "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
  };

  function fontUrls(spec) {
    if (spec.indexOf("/") !== -1) return [spec];
    if (FONT_URLS[spec]) return [FONT_URLS[spec]];
    var parts = spec.split(":");
    var weights = (parts[1] || "400").split(",");
    return weights.map(function (w) {
      return "https://cdn.jsdelivr.net/npm/@fontsource/" + parts[0] + "@5/" + w.trim() + ".css";
    });
  }

  var loadedFonts = {};
  function loadThemeFonts(themeName) {
    if (typeof document === "undefined") return;
    var mode = kit.config && kit.config.fonts;
    if (mode === "system" || mode === false) return;
    (themeMeta(themeName).fonts || []).forEach(function (spec) {
      fontUrls(spec).forEach(function (url) {
        if (loadedFonts[url]) return;
        loadedFonts[url] = true;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.setAttribute("data-kit-font", themeName);
        link.onerror = function () { link.remove(); };
        document.head.appendChild(link);
      });
    });
  }

  function updateHljsTheme(scheme) {
    if (typeof document === "undefined") return;
    var codeThemes = (kit.config && kit.config.code && kit.config.code.themes) || {
      light: "github",
      dark: "github-dark"
    };

    var themeName = scheme === "dark" ? (codeThemes.dark || "github-dark") : (codeThemes.light || "github");
    var isUrl = themeName.indexOf("/") !== -1 || themeName.indexOf(".css") !== -1;
    var isLocal = (kit.config && (kit.config.vendor_mode === "local" || (kit.config.vendor && kit.config.vendor.mode === "local")));
    var targetUrl = isUrl ? themeName : (isLocal ? "../assets/kit/vendor/hljs/styles/" + themeName + ".min.css" : "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/styles/" + themeName + ".min.css");

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

      if (persist && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("kit_theme_" + getCourseId(), currentTheme);
        } catch (e) {}
      }

      loadThemeFonts(currentTheme);
      updateHljsTheme(themeMeta(currentTheme).code || currentScheme);
    }

    kit.emit("kit:themechange", {
      theme: currentTheme,
      scheme: currentScheme
    });
  }

  function defaultTheme() {
    return (kit.config && kit.config.theme) || "course";
  }

  // 在课程默认主题与深色主题之间切换；若默认主题本身是深色，则切到 course。
  function toggleTheme() {
    var base = defaultTheme();
    var alt = resolveSchemeForTheme(base) === "dark" ? "course" : "ink";
    var next = currentTheme === base ? alt : base;
    applyTheme(next, true);
    return next;
  }

  // 可切换的主题列表：config.themes（数组）优先，否则为 [默认主题, 深色/浅色备选]。
  function availableThemes() {
    var list = kit.config && Array.isArray(kit.config.themes) ? kit.config.themes.slice() : null;
    if (!list || !list.length) {
      var base = defaultTheme();
      list = [base, resolveSchemeForTheme(base) === "dark" ? "course" : "ink"];
    }
    return list.filter(function (name, i) { return list.indexOf(name) === i; });
  }

  var themeInitialized = false;
  function initTheme() {
    if (themeInitialized) return;
    themeInitialized = true;

    // 课程自创预设（kit.py sync 从 assets/course/themes/*.css 的 @kit-theme
    // 头解析进 config.customThemes）在此注册，随后即可切换。
    var custom = kit.config && kit.config.customThemes;
    if (custom && typeof custom === "object") {
      Object.keys(custom).forEach(function (name) {
        if (typeof kit.theme.register === "function") kit.theme.register(name, custom[name]);
      });
    }

    var stored = null;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        stored = window.localStorage.getItem("kit_theme_" + getCourseId());
      }
    } catch (e) {}

    var base = defaultTheme();
    // URL ?kit-theme=<id> 优先（kit.py shot / 分享链接用），不改写持久化选择。
    var urlTheme = null;
    try {
      if (typeof window !== "undefined" && window.location) {
        urlTheme = new URLSearchParams(window.location.search).get("kit-theme");
      }
    } catch (e) {}
    // 已存储的主题若不在可切换列表中（例如课程更换了预设），回到默认主题。
    var initialTheme = base;
    if (urlTheme && availableThemes().indexOf(urlTheme) !== -1) initialTheme = urlTheme;
    else if (stored && availableThemes().indexOf(stored) !== -1) initialTheme = stored;

    applyTheme(initialTheme, false);

    // 仅当课程使用默认 course 主题且学习者未手动选择时，才跟随系统明暗。
    if (typeof window !== "undefined" && window.matchMedia && base === "course") {
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
    list: availableThemes,
    meta: themeMeta,
    // 课程扩展可注册自定义预设：kit.theme.register("my-theme", { label, scheme, code, fonts })
    register: function (name, meta) { THEMES[name] = meta || { label: name, scheme: "light" }; },
    init: initTheme
  };

  if (kit.registerModule) {
    kit.registerModule("foundation", kit.theme);
  }

  if (typeof document !== "undefined" && !kit.registerModule) {
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

  /* ---- Module: shell.elements (elements.js) ---- */
  (function () {
/*
 * shell.elements — Web Components 双轨外壳 (Light DOM Custom Elements)
 *
 * 与语义 HTML + data-* 契约 100% 等价的简洁写法。自定义元素在
 * customElements.define 时同步升级既有 DOM，把简洁属性归一化为
 * 标准 data-* 结构，随后由各内容模块按原契约接管：
 *
 *   <kit-question kind="choice" question-id="q1" max-attempts="2"> … </kit-question>
 *   <kit-callout type="tip" label="重点提示" fold="open"> … </kit-callout>
 *   <kit-viz kind="chart" id="demo"> … </kit-viz>
 *   <kit-predict question-id="p1" answer="9.8" tolerance="0.5" unit="m/s"> … </kit-predict>
 *   <kit-param name="mass" min="0.5" max="5" step="0.1" value="1" unit="kg"></kit-param>
 *   <kit-island id="pendulum"> … </kit-island>
 *
 * 归一化发生在 kit.js 求值时（早于 initAll），因此静态页面无需额外处理；
 * 动态插入的节点由 connectedCallback 归一化属性，交互增强仍以整页初始化为准。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function mapAttributes(node, mapping) {
    Object.keys(mapping).forEach(function (from) {
      var to = mapping[from];
      if (node.hasAttribute(from) && !node.hasAttribute(to)) {
        node.setAttribute(to, node.getAttribute(from) || "");
      }
      node.removeAttribute(from);
    });
  }

  function addClass(node, cls) {
    var classes = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    if (classes.indexOf(cls) === -1) classes.push(cls);
    node.setAttribute("class", classes.join(" "));
  }

  var ELEMENT_SPECS = {
    "kit-question": {
      normalize: function (node) {
        mapAttributes(node, {
          "kind": "data-kind",
          "question-id": "data-question-id",
          "max-attempts": "data-max-attempts",
          "expected": "data-expected",
          "tolerance": "data-tolerance",
          "unit": "data-unit",
          "accepted": "data-accepted"
        });
        addClass(node, "question");
        if (!node.hasAttribute("data-role")) node.setAttribute("data-role", "evidence");
      }
    },
    "kit-callout": {
      normalize: function (node) {
        mapAttributes(node, { "type": "data-callout", "fold": "data-fold" });
        addClass(node, "callout");
        var label = node.getAttribute("label");
        if (label && !node.querySelector(".callout__title")) {
          var title = document.createElement("div");
          title.className = "callout__title";
          title.textContent = label;
          node.insertBefore(title, node.firstChild);
        }
        node.removeAttribute("label");
      }
    },
    "kit-viz": {
      normalize: function (node) {
        mapAttributes(node, { "kind": "data-visualization" });
        addClass(node, "visualization");
        if (!node.id) node.id = "kit-viz-" + Math.random().toString(36).slice(2, 8);
      }
    },
    "kit-predict": {
      normalize: function (node) {
        mapAttributes(node, {
          "question-id": "data-question-id",
          "answer": "data-answer",
          "tolerance": "data-tolerance",
          "unit": "data-unit"
        });
        if (!node.hasAttribute("data-question-id") && node.id) {
          node.setAttribute("data-question-id", node.id);
        }
        node.setAttribute("data-predict", "");
      }
    },
    "kit-param": {
      normalize: function (node) {
        mapAttributes(node, {
          "name": "data-param",
          "min": "data-min",
          "max": "data-max",
          "step": "data-step",
          "value": "data-value",
          "unit": "data-unit",
          "label": "data-label"
        });
      }
    },
    "kit-island": {
      normalize: function (node) {
        if (!node.id && node.hasAttribute("name")) {
          node.id = node.getAttribute("name") || "";
        }
        node.setAttribute("data-island", "");
      }
    }
  };

  function rerunModuleInit(moduleId) {
    var mod = kit.getModule && kit.getModule(moduleId);
    if (mod && typeof mod.init === "function") {
      try { mod.init(); } catch (error) { console.error("[kit] elements re-init " + moduleId + ":", error); }
    }
  }

  var REINIT_AFTER = {
    "kit-question": "learning.question",
    "kit-callout": "content.callout",
    "kit-viz": "viz.core",
    "kit-predict": "learning.predict",
    "kit-param": "learning.param",
    "kit-island": "viz.island"
  };

  function upgradeAll() {
    Object.keys(ELEMENT_SPECS).forEach(function (tag) {
      if (typeof document === "undefined") return;
      document.querySelectorAll(tag).forEach(function (node) {
        try {
          ELEMENT_SPECS[tag].normalize(node);
          node.dataset.kitElementNormalized = "true";
        } catch (error) {
          console.error("[kit] element normalize failed for <" + tag + ">:", error);
        }
      });
    });
  }

  if (typeof customElements !== "undefined" && typeof document !== "undefined") {
    Object.keys(ELEMENT_SPECS).forEach(function (tag) {
      if (customElements.get(tag)) return;
      var spec = ELEMENT_SPECS[tag];
      var Controller = function () { return Reflect.construct(HTMLElement, [], Controller); };
      Controller.prototype = Object.create(HTMLElement.prototype, {
        connectedCallback: {
          value: function () {
            if (this.dataset.kitElementNormalized === "true") return;
            try {
              spec.normalize(this);
              this.dataset.kitElementNormalized = "true";
            } catch (error) {
              console.error("[kit] element normalize failed for <" + tag + ">:", error);
            }
            if (kit.__ACTIVE_MODULES__ && kit.getModule && REINIT_AFTER[tag]) {
              rerunModuleInit(REINIT_AFTER[tag]);
            }
          }
        }
      });
      Object.defineProperty(Controller, "observedAttributes", { value: [] });
      customElements.define(tag, Controller);
    });
  }

  kit.elements = { specs: ELEMENT_SPECS, upgradeAll: upgradeAll };
  if (kit.registerModule) {
    kit.registerModule("shell.elements", {
      init: function () {
        upgradeAll();
      }
    });
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: shell.nav (nav.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function getLessonHref(file, isLessonPage) {
    var baseFile = file.indexOf("/") !== -1 ? file.split("/").pop() : file;
    return isLessonPage ? baseFile : ("lessons/" + baseFile);
  }

  /* ---------------------------------------------------------------------------
   * Chaptered packages restart lesson numbers at 0001 per chapter, so a bare
   * number is not a unique identity. nav.json entries therefore carry:
   *   file  - path relative to lessons/ ("第九章/0001-x.html", or "0001-x.html")
   *   key   - composite progress key ("第九章/0001", or "0001")
   * and links are resolved relative to the current page instead of by number.
   * ------------------------------------------------------------------------- */

  function lessonKey(entry) {
    if (!entry) return "";
    if (entry.key) return entry.key;
    var number = entry.number == null ? "" : String(Number(entry.number));
    return entry.chapter ? (entry.chapter + "/" + number) : number;
  }

  function normalizePath(pathname) {
    return String(pathname || "").split("\\").join("/");
  }

  // lessons/-relative path of the page, derived from the URL, or "" when unknown
  function pageLessonFile() {
    if (typeof window === "undefined" || !window.location) return "";
    var pathname = normalizePath(window.location.pathname);
    var marker = "/lessons/";
    var index = pathname.lastIndexOf(marker);
    if (index === -1) return "";
    return pathname.slice(index + marker.length).replace(/^\/+/, "");
  }

  /** Relative href between two lessons/-relative paths; mirrors build_index.lesson_href. */
  function relLessonHref(fromFile, toFile) {
    if (!fromFile) return "lessons/" + toFile;
    var fromDir = fromFile.indexOf("/") === -1 ? [] : fromFile.split("/").slice(0, -1);
    var toParts = String(toFile).split("/");
    var common = 0;
    while (common < fromDir.length && common < toParts.length - 1 && fromDir[common] === toParts[common]) {
      common += 1;
    }
    var up = [];
    for (var i = common; i < fromDir.length; i += 1) up.push("..");
    return up.concat(toParts.slice(common)).join("/");
  }

  /** Where nav.json lives, resolved from the kit.js tag so any depth works. */
  function navJsonUrl(fallbackUrl) {
    if (typeof document === "undefined") return fallbackUrl;
    var kitScript = document.querySelector('script[src*="kit.js"]');
    if (!kitScript) return fallbackUrl;
    var src = kitScript.getAttribute("src") || "";
    var match = src.match(/^(.*?)kit\.js/);
    if (!match) return fallbackUrl;
    // kitDir is "<base>/assets/kit/"; nav.json sits at "<base>/assets/course/nav.json".
    var kitDir = match[1];
    var assetsDir = kitDir.replace(/assets\/kit\/$/, "assets/");
    if (assetsDir === kitDir) return fallbackUrl;
    return assetsDir + "course/nav.json";
  }

  function renderSidebar(navData, currentLessonId, currentLesson) {
    var page = document.querySelector(".kit-page, .course-shell");
    if (!page) return;

    var sidebar = document.querySelector(".kit-sidebar");
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "kit-sidebar";
      sidebar.setAttribute("aria-label", "课程大纲");
      page.insertBefore(sidebar, page.firstChild);
    }

    var isLessonPage = !!document.querySelector(".lesson, [data-lesson-id]");
    var lessons = (navData && navData.lessons) || [];
    var currentIndex = -1;
    var pageFile = isLessonPage ? pageLessonFile() : "";

    if (isLessonPage) {
      // Exact lessons/-relative path wins: it is the only identity that stays
      // unique when two chapters both contain a 0001.
      for (var i = 0; i < lessons.length; i += 1) {
        if (pageFile && lessons[i].file === pageFile) { currentIndex = i; break; }
      }
      if (currentIndex === -1 && currentLesson) {
        for (var j = 0; j < lessons.length; j += 1) {
          if (lessonKey(lessons[j]) && lessonKey(lessons[j]) === lessonKey(currentLesson)) { currentIndex = j; break; }
        }
      }
      if (currentIndex === -1 && currentLessonId != null) {
        for (var k = 0; k < lessons.length; k += 1) {
          var candidate = lessons[k];
          if (!candidate.chapter && String(Number(candidate.number)) === String(Number(currentLessonId))) { currentIndex = k; break; }
        }
      }
    }

    var totalLessons = lessons.length;

    // Course progress: judged strictly based on records (completed_lessons)
    var completedList = (navData && Array.isArray(navData.completed_lessons)) ? navData.completed_lessons : null;

    function isLessonCompleted(it, idx) {
      if (completedList !== null) {
        var numStr = it.number ? String(Number(it.number)) : String(idx + 1);
        if (numStr.length < 4) {
          numStr = ("0000" + numStr).slice(-4);
        }
        // Chaptered packages key progress on "<章>/<NNNN>"; a bare number would
        // wrongly mark every chapter's same-numbered lesson as done.
        var key = lessonKey(it);
        if (key && completedList.indexOf(key) !== -1) return true;
        if (!it.chapter) {
          return completedList.indexOf(numStr) !== -1 || completedList.indexOf(it.number) !== -1;
        }
        return false;
      }
      if (navData && typeof navData.current_lesson !== "undefined" && navData.current_lesson !== null) {
        var lNum = it.number ? Number(it.number) : (idx + 1);
        return lNum <= Number(navData.current_lesson);
      }
      return false;
    }

    var completedCount = 0;
    if (completedList !== null) {
      completedCount = completedList.length;
    } else if (navData && typeof navData.completed_count !== "undefined") {
      completedCount = Number(navData.completed_count);
    } else if (navData && typeof navData.current_lesson !== "undefined") {
      completedCount = Number(navData.current_lesson);
    } else {
      completedCount = (currentIndex !== -1) ? (currentIndex + 1) : 0;
    }
    if (isNaN(completedCount) || completedCount < 0) completedCount = 0;
    if (completedCount > totalLessons) completedCount = totalLessons;

    var progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    // Generic course metadata resolution (from nav.json / course config or DOM)
    var courseTitle = (navData && navData.title) || "";
    if (!courseTitle) {
      var courseNavHome = document.querySelector(".course-nav a, .kit-nav a");
      if (courseNavHome && courseNavHome.textContent && courseNavHome.textContent.trim() !== "课程首页") {
        courseTitle = courseNavHome.textContent.trim();
      }
    }
    if (!courseTitle) {
      var lessonScope = document.querySelector(".lesson[data-course-id]");
      if (lessonScope && lessonScope.dataset.courseId) {
        courseTitle = lessonScope.dataset.courseId;
      } else {
        courseTitle = "课程目录";
      }
    }

    // Optional short course code
    var courseCode = (navData && navData.code) || "";
    if (!courseCode && navData && navData.course_id && navData.course_id.length <= 10 && !navData.course_id.includes("-")) {
      courseCode = navData.course_id;
    }

    // Optional unit meta
    var unitMeta = (navData && navData.unit) || "";
    if (!unitMeta) {
      var kickerEl = document.querySelector(".course-header .course-kicker, .kit-header .course-kicker");
      if (kickerEl) {
        var kickerText = kickerEl.textContent.trim();
        var unitMatch = kickerText.match(/(?:UNIT|单元|第\s*[一二三四五六七八九十\d]+\s*单元)\s*[\d\w]*[\s·\/:：-]*[^\s·\/:：-]+/i);
        if (unitMatch) {
          unitMeta = unitMatch[0];
        }
      }
    }

    var currentEntry = currentIndex >= 0 ? lessons[currentIndex] : null;
    var homeLink = "index.html";
    if (isLessonPage) {
      homeLink = (currentEntry && currentEntry.home) || (navData && navData.home) || "../index.html";
    }

    var html = [];
    html.push('<div class="kit-sidebar__brand">');
    html.push('  <a href="' + homeLink + '" class="kit-sidebar__home-link">');
    if (courseCode) {
      html.push('    <span class="kit-sidebar__code">' + courseCode + '</span>');
      html.push('    <span class="kit-sidebar__sep">·</span>');
    }
    html.push('    <span class="kit-sidebar__course-name">' + courseTitle + '</span>');
    html.push('  </a>');
    if (unitMeta) {
      html.push('  <div class="kit-sidebar__unit-meta">' + unitMeta + '</div>');
    }
    html.push('  <div class="kit-sidebar__progress-row">');
    html.push('    <span class="kit-sidebar__progress-label">课程进度</span>');
    html.push('    <span class="kit-sidebar__progress-count">' + completedCount + ' / ' + totalLessons + '</span>');
    html.push('  </div>');
    html.push('  <div class="kit-sidebar__progress-track" aria-hidden="true">');
    html.push('    <div class="kit-sidebar__progress-bar" style="width: ' + progressPercent + '%;"></div>');
    html.push('  </div>');
    html.push('</div>');

    html.push('<nav class="kit-sidebar__tree" aria-label="课时列表">');
    html.push('  <div class="kit-sidebar__tree-title">章节目录</div>');

    var hrefFromFile = "";
    if (isLessonPage) {
      hrefFromFile = pageFile || (currentIndex >= 0 && lessons[currentIndex] ? lessons[currentIndex].file : "");
    }

    function renderLessonItem(it, idx, indent) {
      var isCurrent = (idx === currentIndex);
      var isCompleted = isLessonCompleted(it, idx);
      var itemClass = "kit-sidebar__item" + (isCurrent ? " is-current" : "") + (isCompleted ? " is-completed" : "");

      var numLabel = it.number ? String(Number(it.number)) : String(idx + 1);
      if (numLabel.length < 2) numLabel = "0" + numLabel;

      var statusMarker = isCurrent
        ? '<span class="kit-sidebar__marker is-current" aria-label="当前课时">●</span>'
        : (isCompleted
            ? '<span class="kit-sidebar__marker is-done" aria-label="已完成">✓</span>'
            : '<span class="kit-sidebar__marker is-todo">' + numLabel + '</span>');

      var lessonHref;
      if (!it.file) {
        lessonHref = "#";
      } else if (hrefFromFile) {
        // Lesson page: relative to the current lesson's chapter directory
        lessonHref = relLessonHref(hrefFromFile, it.file);
      } else if (it.href) {
        // Course index: the stored index-relative path keeps the chapter segment
        lessonHref = it.href;
      } else {
        lessonHref = "lessons/" + it.file;
      }

      var pad = indent ? "  " : "";
      html.push(pad + '    <li class="' + itemClass + '">');
      html.push(pad + '      <a href="' + lessonHref + '" class="kit-sidebar__link"' + (isCurrent ? ' aria-current="page"' : '') + '>');
      html.push(pad + '        ' + statusMarker);
      html.push(pad + '        <span class="kit-sidebar__link-text">');
      html.push(pad + '          <span class="kit-sidebar__link-title" title="' + it.title + '">' + it.title + '</span>');
      html.push(pad + '        </span>');
      html.push(pad + '      </a>');
      html.push(pad + '    </li>');
    }

    function chapterLabel(entry) {
      if (!entry || !entry.chapter) return "";
      for (var c = 0; c < (navData.chapters || []).length; c += 1) {
        var meta = navData.chapters[c];
        if (meta && (meta.label === entry.chapter || meta.id === entry.chapter)) {
          return meta.title && meta.title !== meta.label ? (meta.label + " · " + meta.title) : meta.label;
        }
      }
      return entry.chapter;
    }

    var chapterGroups = [];
    lessons.forEach(function (it, idx) {
      var label = it.chapter ? chapterLabel(it) : "";
      var last = chapterGroups[chapterGroups.length - 1];
      if (!last || last.label !== label) chapterGroups.push({ label: label, items: [] });
      chapterGroups[chapterGroups.length - 1].items.push(idx);
    });
    var grouped = chapterGroups.length > 1 || (chapterGroups.length === 1 && chapterGroups[0].label);

    if (!grouped) {
      html.push('  <ul class="kit-sidebar__list">');
      lessons.forEach(function (it, idx) { renderLessonItem(it, idx, false); });
      html.push('  </ul>');
    } else {
      chapterGroups.forEach(function (group) {
        html.push('  <div class="kit-sidebar__group">');
        html.push('    <div class="kit-sidebar__group-title">' + group.label + '</div>');
        html.push('    <ul class="kit-sidebar__list">');
        group.items.forEach(function (idx) { renderLessonItem(lessons[idx], idx, true); });
        html.push('    </ul>');
        html.push('  </div>');
      });
    }

    html.push('</nav>');

    sidebar.innerHTML = html.join("\n");

    // Close sidebar drawer on link click for mobile/tablet
    sidebar.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (a) {
        sidebar.classList.remove("is-open");
        var b = document.querySelector(".kit-sidebar-backdrop");
        if (b) b.classList.remove("is-open");
      }
    });

    // Add backdrop for mobile/tablet drawer
    var backdrop = document.querySelector(".kit-sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "kit-sidebar-backdrop";
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", function () {
        sidebar.classList.remove("is-open");
        backdrop.classList.remove("is-open");
      });
    }

    // Toggle button in header if present
    var header = document.querySelector(".course-header, .kit-header");
    if (header && !header.querySelector(".kit-sidebar-toggle")) {
      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "kit-sidebar-toggle";
      toggleBtn.innerHTML = "☰ <span>课程大纲</span>";
      toggleBtn.addEventListener("click", function () {
        var isOpen = sidebar.classList.toggle("is-open");
        backdrop.classList.toggle("is-open", isOpen);
      });
      header.insertBefore(toggleBtn, header.firstChild);
    }
  }

  /**
   * Resolve a prev/next reference to its lesson entry.
   *
   * Matching on the number alone is unsafe in a chaptered package (both chapters
   * own a 0001), so the composite key, then file, then number+chapter are tried
   * before falling back to a bare number for flat courses.
   */
  function findLesson(data, ref) {
    if (!data || !Array.isArray(data.lessons) || !ref) return null;
    var lessons = data.lessons;
    var i;
    if (ref.key) {
      for (i = 0; i < lessons.length; i += 1) if (lessonKey(lessons[i]) === ref.key) return lessons[i];
    }
    if (ref.file) {
      for (i = 0; i < lessons.length; i += 1) if (lessons[i].file === ref.file) return lessons[i];
    }
    if (ref.number != null) {
      var targetStr = String(Number(ref.number));
      if (ref.chapter) {
        for (i = 0; i < lessons.length; i += 1) {
          if (lessons[i].chapter === ref.chapter && String(Number(lessons[i].number)) === targetStr) return lessons[i];
        }
      }
      for (i = 0; i < lessons.length; i += 1) {
        var it = lessons[i];
        if (!it.chapter && it.number && (it.number === ref.number || String(Number(it.number)) === targetStr)) return it;
      }
    }
    return ref;
  }

  /**
   * Href from the current lesson page to a prev/next reference.
   *
   * The ref stored beside a lesson carries an href already relative to that
   * lesson. A resolved lesson entry carries an index-relative href, which must
   * not be reused here, so only the reference's own href is trusted.
   */
  function lessonLinkHref(currentLesson, ref, resolved) {
    if (!ref && !resolved) return "#";
    if (ref && ref.href) return ref.href;
    var ownFile = (currentLesson && currentLesson.file) || pageLessonFile();
    var file = (ref && ref.file) || (resolved && resolved.file);
    if (!file) return "#";
    if (ownFile) return relLessonHref(ownFile, file);
    return getLessonHref(file, true);
  }

  function renderLessonPager(data, currentLesson) {
    var lessonEl = document.querySelector(".lesson");
    if (!lessonEl || !currentLesson) return;

    var pagerEl = lessonEl.querySelector(".kit-pager");
    if (!pagerEl) {
      pagerEl = document.createElement("nav");
      pagerEl.className = "kit-pager";
      pagerEl.setAttribute("aria-label", "课时翻页导航");
      var footerEl = lessonEl.querySelector(".lesson-footer");
      if (footerEl) {
        lessonEl.insertBefore(pagerEl, footerEl);
      } else {
        lessonEl.appendChild(pagerEl);
      }
    }

    var isLessonPage = true;
    var homeUrl = currentLesson.home || (data && data.home) || "../index.html";

    var prevLesson = null;
    if (currentLesson.prev) {
      prevLesson = findLesson(data, currentLesson.prev) || currentLesson.prev;
    }

    var nextLesson = null;
    if (currentLesson.next) {
      nextLesson = findLesson(data, currentLesson.next) || currentLesson.next;
    }

    var html = [];
    html.push('<div class="kit-pager__grid">');

    // Prev Card
    if (prevLesson && prevLesson.file) {
      var prevHref = lessonLinkHref(currentLesson, currentLesson.prev, prevLesson);
      var prevNum = prevLesson.number ? ("第 " + prevLesson.number + " 课") : "上一课";
      var prevTitle = prevLesson.title || "上一课";
      html.push('  <a href="' + prevHref + '" class="kit-pager__card kit-pager__card--prev" rel="prev" data-nav-prev="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__arrow">←</span>');
      html.push('      <span class="kit-pager__label">上一课 · ' + prevNum + '</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">' + prevTitle + '</span>');
      html.push('  </a>');
    } else {
      html.push('  <div class="kit-pager__card kit-pager__card--empty" aria-hidden="true"></div>');
    }

    // Next Card
    if (nextLesson && nextLesson.file) {
      var nextHref = lessonLinkHref(currentLesson, currentLesson.next, nextLesson);
      var nextNum = nextLesson.number ? ("第 " + nextLesson.number + " 课") : "下一课";
      var nextTitle = nextLesson.title || "下一课";
      html.push('  <a href="' + nextHref + '" class="kit-pager__card kit-pager__card--next" rel="next" data-nav-next="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__label">下一课 · ' + nextNum + '</span>');
      html.push('      <span class="kit-pager__arrow">→</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">' + nextTitle + '</span>');
      html.push('  </a>');
    } else {
      // Last lesson -> link to course index
      html.push('  <a href="' + homeUrl + '" class="kit-pager__card kit-pager__card--finish" data-nav-home="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__label">本单元完结 · 返回大纲</span>');
      html.push('      <span class="kit-pager__arrow">⊞</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">课程首页与后续规划</span>');
      html.push('  </a>');
    }

    html.push('</div>');

    // Central Home Action
    html.push('<div class="kit-pager__bottom">');
    html.push('  <a href="' + homeUrl + '" class="kit-pager__home-btn" data-nav-home="">');
    html.push('    <span class="kit-pager__home-icon">⊞</span>');
    html.push('    <span>课程首页</span>');
    html.push('  </a>');
    html.push('</div>');

    pagerEl.innerHTML = html.join("\n");
  }

  function initNav() {
    if (typeof document === "undefined") return;

    var navEls = Array.prototype.slice.call(document.querySelectorAll("nav.kit-nav, nav.course-nav, [data-kit-nav]"));
    var lessonEl = document.querySelector(".lesson");
    var currentLessonId = lessonEl ? lessonEl.dataset.lessonId : null;

    var navData = (kit.config && kit.config.navigation) || kit.__NAV_DATA__ || root.__NAV_DATA__;

    function applyNav(data) {
      if (!data || !Array.isArray(data.lessons)) return;
      var currentLesson = null;
      var lessons = data.lessons;
      var pageFile = pageLessonFile();
      var i, it;

      // 1. exact lessons/-relative path — unique even when chapters share numbers
      for (i = 0; i < lessons.length; i += 1) {
        if (pageFile && lessons[i].file === pageFile) { currentLesson = lessons[i]; break; }
      }
      // 2. file name only, when it is not ambiguous across chapters
      if (!currentLesson && pageFile) {
        var base = pageFile.split("/").pop();
        var matches = [];
        for (i = 0; i < lessons.length; i += 1) {
          it = lessons[i];
          if (it.file && it.file.split("/").pop() === base) matches.push(it);
        }
        if (matches.length === 1) currentLesson = matches[0];
      }
      // 3. data-lesson-id plus chapter taken from the URL
      if (!currentLesson && currentLessonId != null) {
        var chapterFromPath = pageFile.indexOf("/") === -1 ? "" : pageFile.split("/")[0];
        for (i = 0; i < lessons.length; i += 1) {
          it = lessons[i];
          var sameNumber = it.number && (it.number === currentLessonId || String(Number(it.number)) === String(Number(currentLessonId)));
          if (!sameNumber) continue;
          if (chapterFromPath && it.chapter === chapterFromPath) { currentLesson = it; break; }
          if (!it.chapter) currentLesson = it;
        }
      }

      // Render Left Global Course Navigator (The Navigator)
      renderSidebar(data, currentLessonId, currentLesson);

      // Render Lesson End Pager
      renderLessonPager(data, currentLesson);

      navEls.forEach(function (nav) {
        if (nav.closest(".course-header, .kit-header")) {
          // Do not inject navigation into headers; moved to lesson footer
          return;
        }
        if (currentLesson) {
          var homeLink = nav.querySelector('[data-nav-home], a[href*="index.html"]');
          var prevLink = nav.querySelector('[data-nav-prev], a[rel="prev"]');
          var nextLink = nav.querySelector('[data-nav-next], a[rel="next"]');

          if (!prevLink && currentLesson.prev) {
            var aPrev = document.createElement("a");
            aPrev.href = lessonLinkHref(currentLesson, currentLesson.prev);
            aPrev.rel = "prev";
            aPrev.dataset.navPrev = "";
            aPrev.className = "nav-prev";
            aPrev.textContent = "← 上一课";
            if (homeLink) nav.insertBefore(aPrev, homeLink);
            else nav.insertBefore(aPrev, nav.firstChild);
          }

          if (!nextLink && currentLesson.next) {
            var aNext = document.createElement("a");
            aNext.href = lessonLinkHref(currentLesson, currentLesson.next);
            aNext.rel = "next";
            aNext.dataset.navNext = "";
            aNext.className = "nav-next";
            aNext.textContent = "下一课 →";
            if (homeLink && homeLink.nextSibling) nav.insertBefore(aNext, homeLink.nextSibling);
            else nav.appendChild(aNext);
          }
        }
      });
    }

    if (navData && Array.isArray(navData.lessons)) {
      applyNav(navData);
    } else if (typeof fetch === "function") {
      var isLesson = !!document.querySelector(".lesson, [data-lesson-id]");
      // nav.json sits at <course>/assets/course/nav.json. Resolving it from the
      // kit.js tag keeps the path correct for chaptered lessons, which sit one
      // directory deeper than the flat layout the literal "../" assumed.
      var navUrl = navJsonUrl(isLesson ? "../assets/course/nav.json" : "assets/course/nav.json");
      fetch(navUrl)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && Array.isArray(data.lessons)) {
            kit.__NAV_DATA__ = data;
            applyNav(data);
          }
        })
        .catch(function () {
          // nav.json is the single navigation source (regenerated by kit.py sync);
          // without it the sidebar shows the static TOC fallback only.
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[kit] nav.json load failed — sidebar navigation unavailable. Re-run kit.py sync or open via kit.py serve.");
          }
        });
    }

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

  function themeLabel(name) {
    var meta = kit.theme && kit.theme.meta ? kit.theme.meta(name) : null;
    return (meta && meta.label) || name;
  }

  function currentTheme() {
    return (kit.theme && kit.theme.getTheme && kit.theme.getTheme()) || "course";
  }

  // 两个主题：单按钮切换；三个及以上：下拉选择。
  function renderSwitcher(container) {
    container.innerHTML = "";
    var themes = kit.theme && kit.theme.list ? kit.theme.list() : ["course", "ink"];

    if (themes.length > 2) {
      var select = document.createElement("select");
      select.className = "kit-theme-select";
      select.setAttribute("aria-label", "切换主题");
      themes.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = themeLabel(name);
        select.appendChild(opt);
      });
      select.value = currentTheme();
      select.addEventListener("change", function () {
        if (kit.theme && kit.theme.setTheme) kit.theme.setTheme(select.value);
      });
      container.appendChild(select);
      kit.on("kit:themechange", function () { select.value = currentTheme(); });
      return;
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kit-theme-toggle";

    function updateLabel() {
      var cur = currentTheme();
      var other = themes[0] === cur ? themes[1] : themes[0];
      var dark = kit.theme && kit.theme.meta && kit.theme.meta(other).scheme === "dark";
      btn.textContent = (dark ? "🌙 " : "☀️ ") + themeLabel(other);
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
    // data-theme-switcher 为课件模板写法；data-theme-switch 为旧写法，两者等价。
    var containers = document.querySelectorAll("[data-theme-switcher], [data-theme-switch]");
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
        el.id = kit.util && kit.util.slugify ? kit.util.slugify(el.textContent) : el.textContent.trim().toLowerCase().replace(/\s+/g, "-");
      }
      var label = el.dataset.tocLabel;
      if (!label) {
        var clone = el.cloneNode(true);
        var mathml = clone.querySelectorAll(".katex-mathml");
        for (var m = 0; m < mathml.length; m++) {
          mathml[m].remove();
        }
        label = clone.textContent.trim();
      }
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

  function buildHeadingTree(headingsList) {
    var tree = [];
    var currentH2 = null;

    headingsList.forEach(function (h) {
      if (!h.isH3) {
        currentH2 = {
          id: h.id,
          label: h.label,
          element: h.element,
          children: []
        };
        tree.push(currentH2);
      } else {
        if (currentH2) {
          currentH2.children.push(h);
        } else {
          currentH2 = {
            id: h.id,
            label: h.label,
            element: h.element,
            children: []
          };
          tree.push(currentH2);
        }
      }
    });

    return tree;
  }

  function setExpanded(li, expand) {
    if (!li) return;
    if (expand) {
      li.classList.remove("is-collapsed");
      li.classList.add("is-expanded");
      var btn = li.querySelector(".kit-toc__toggle, .toc-toggle");
      if (btn) {
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("title", "收起子目录");
        btn.setAttribute("aria-label", "收起子目录");
      }
    } else {
      li.classList.remove("is-expanded");
      li.classList.add("is-collapsed");
      var btn = li.querySelector(".kit-toc__toggle, .toc-toggle");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("title", "展开子目录");
        btn.setAttribute("aria-label", "展开子目录");
      }
    }
  }

  function renderList(targetUl, closeCallback) {
    targetUl.innerHTML = "";
    var tree = buildHeadingTree(headings);

    tree.forEach(function (node) {
      var li = document.createElement("li");
      var hasChildren = node.children && node.children.length > 0;
      // All H3 subsections are collapsed by default
      li.className = "kit-toc__item toc-item is-h2" + (hasChildren ? " has-children is-collapsed" : " no-children");
      li.dataset.sectionId = node.id;

      var row = document.createElement("div");
      row.className = "kit-toc__row toc-row" + (hasChildren ? " has-children" : " no-children");

      if (hasChildren) {
        var toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "kit-toc__toggle toc-toggle";
        toggleBtn.setAttribute("aria-label", "展开子目录");
        toggleBtn.setAttribute("title", "展开子目录");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.innerHTML = '<svg class="kit-toc__chevron" viewBox="0 0 16 16" width="9" height="9" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        toggleBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          e.preventDefault();
          var isCollapsed = li.classList.contains("is-collapsed");
          setExpanded(li, isCollapsed);
        });

        row.appendChild(toggleBtn);
      } else {
        var spacer = document.createElement("span");
        spacer.className = "kit-toc__spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.appendChild(spacer);
      }

      var a = document.createElement("a");
      a.className = "kit-toc__link toc-link is-h2-link";
      a.href = "#" + node.id;
      a.textContent = node.label;
      a.dataset.targetId = node.id;

      a.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(node.id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.pushState) history.pushState(null, "", "#" + node.id);
        }
        if (closeCallback) closeCallback();
      });

      row.appendChild(a);
      li.appendChild(row);
      allLinkNodes.push(a);

      if (hasChildren) {
        var subUl = document.createElement("ul");
        subUl.className = "kit-toc__sublist toc-sublist";

        node.children.forEach(function (child) {
          var subLi = document.createElement("li");
          subLi.className = "kit-toc__item toc-item is-h3";
          subLi.dataset.sectionId = child.id;

          var subA = document.createElement("a");
          subA.className = "kit-toc__link toc-link is-h3-link";
          subA.href = "#" + child.id;
          subA.textContent = child.label;
          subA.dataset.targetId = child.id;
          subA.dataset.parentId = node.id;

          subA.addEventListener("click", function (e) {
            e.preventDefault();
            var target = document.getElementById(child.id);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              if (history.pushState) history.pushState(null, "", "#" + child.id);
            }
            if (closeCallback) closeCallback();
          });

          subLi.appendChild(subA);
          subUl.appendChild(subLi);
          allLinkNodes.push(subA);
        });

        li.appendChild(subUl);
      }

      targetUl.appendChild(li);
    });
  }

  function updateActiveLink(id) {
    if (activeHeadingId === id) return;
    activeHeadingId = id;

    allLinkNodes.forEach(function (a) {
      if (a.dataset.targetId === id) {
        a.setAttribute("aria-current", "location");
        a.classList.add("is-active");

        var visibleTarget = a;
        if (a.dataset.parentId) {
          var parentLi = a.closest(".kit-toc__item.has-children, .toc-item.has-children");
          if (parentLi && parentLi.classList.contains("is-collapsed")) {
            visibleTarget = parentLi;
          }
        }

        // Keep active item in view inside the TOC container without whole-page scroll
        if (desktopScrollBox && desktopScrollBox.contains(visibleTarget)) {
          var containerTop = desktopScrollBox.scrollTop;
          var containerHeight = desktopScrollBox.clientHeight;
          var itemTop = visibleTarget.offsetTop;
          var itemHeight = visibleTarget.offsetHeight;

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

    var allParentLis = document.querySelectorAll(".kit-toc__item.has-children, .toc-item.has-children");
    for (var p = 0; p < allParentLis.length; p++) {
      var pLi = allParentLis[p];
      var hasActiveChild = !!pLi.querySelector(".kit-toc__sublist .is-active, .toc-sublist .is-active");
      if (hasActiveChild) {
        pLi.classList.add("has-active-child");
      } else {
        pLi.classList.remove("has-active-child");
      }
    }

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
      firstTryCorrect: null,
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
              var cur = LearnKit.getPath(s, prefix + ".firstTryCorrect");
              var isFirst = cur === null || cur === undefined;
              s = LearnKit.setPath(s, prefix + ".verdict", action.value);
              if (isFirst && (action.value === "correct" || action.value === "incorrect")) {
                s = LearnKit.setPath(s, prefix + ".firstTryCorrect", action.value === "correct");
              }
              return s;
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

      var firstTry = q.firstTryCorrect;
      var firstTryLabel;
      if (firstTry === true) firstTryLabel = "是";
      else if (firstTry === false) firstTryLabel = "否（错题）";
      else firstTryLabel = result === "not-applicable" ? "不适用" : "未判定";

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
        "- 即时判定: " + result,
        "- 一次做对: " + firstTryLabel
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

    var params = lesson.querySelectorAll("[data-param]");
    if (params.length) {
      lines.push("", "## 参数探索（当前状态；代表探索足迹）");
      params.forEach(function (node) {
        if (node.dataset.kitParamBound !== "true") return;
        lines.push("", "### " + (node.dataset.param || node.id || "param"),
          "- 当前值: " + (node.dataset.paramValue || "unknown"));
      });
    }

    var islands = lesson.querySelectorAll("kit-island, [data-island]");
    if (islands.length) {
      lines.push("", "## 仿真孤岛观察（当前状态；不代表完成练习）");
      islands.forEach(function (node) {
        lines.push("", "### " + (node.id || "island"),
          "- 初始化状态: " + (node.dataset.islandReady || "not-loaded"),
          "- 当前状态: " + (node.dataset.visualState || "unknown"),
          "- 预测记录: " + (node.dataset.predictState || "none"));
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

  var recordsInitialized = false;

  var IDB_NAME = "coursekit_records_v1";
  var IDB_STORE = "queue";

  function getDeviceId() {
    try {
      var k = "kit_device_id";
      var id = localStorage.getItem(k);
      if (!id) {
        id = "dev-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, id);
      }
      return id;
    } catch (e) {
      return "dev-anon";
    }
  }

  function getServeToken() {
    try {
      var params = new URLSearchParams(window.location.search);
      var t = params.get("t");
      if (t) {
        sessionStorage.setItem("kit_serve_token", t);
        return t;
      }
      return sessionStorage.getItem("kit_serve_token") || "";
    } catch (e) {
      return "";
    }
  }

  function openQueueDB(cb) {
    if (typeof indexedDB === "undefined") { cb(null); return; }
    try {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = function (e) { cb(e.target.result); };
      req.onerror = function () { cb(null); };
    } catch (e) {
      cb(null);
    }
  }

  function saveToQueue(entry, done) {
    openQueueDB(function (db) {
      if (!db) {
        try {
          localStorage.setItem("kit_q_" + entry.key, JSON.stringify(entry));
        } catch (e) {}
        if (done) done();
        return;
      }
      try {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(entry);
        tx.oncomplete = function () { if (done) done(); };
        tx.onerror = function () { if (done) done(); };
      } catch (e) {
        if (done) done();
      }
    });
  }

  function buildPayload(lesson, state) {
    var rec = buildLearningRecord(lesson, state);
    var courseId = lesson.dataset.courseId || "unknown";
    var lessonId = lesson.dataset.lessonId || "unknown";
    var deviceId = getDeviceId();
    return {
      key: courseId + "::" + lessonId + "::" + deviceId,
      course_id: courseId,
      lesson: lessonId,
      objective_id: lesson.dataset.objective || "unknown",
      device_id: deviceId,
      user_agent: (typeof navigator !== "undefined" && navigator.userAgent) || "",
      updated_at: new Date().toISOString(),
      has_content: rec.hasContent,
      state: state || {},
      markdown: rec.text
    };
  }

  function removeQueued(key) {
    openQueueDB(function (db) {
      if (!db) {
        try { localStorage.removeItem("kit_q_" + key); } catch (e) {}
        return;
      }
      try {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
      } catch (e) {}
    });
  }

  /* 断网补偿：页面以 http(s) 打开时，把此前 file:// 离线作答暂存在
     IndexedDB / localStorage 里的 payload 逐条补传给 serve，成功即清除。 */
  function flushQueue() {
    if (typeof window === "undefined") return;
    var isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
    if (!isHttp || typeof fetch === "undefined") return;
    openQueueDB(function (db) {
      var entries = [];
      var finish = function () {
        entries.forEach(function (entry) {
          if (!entry || !entry.key) return;
          var headers = { "Content-Type": "application/json" };
          var tok = getServeToken();
          if (tok) headers["X-Kit-Token"] = tok;
          fetch("/api/records", { method: "POST", headers: headers, body: JSON.stringify(entry) })
            .then(function (r) { if (r.ok) removeQueued(entry.key); })
            .catch(function () {});
        });
      };
      if (!db) {
        try {
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf("kit_q_") === 0) {
              try { entries.push(JSON.parse(localStorage.getItem(k))); } catch (e) {}
            }
          });
        } catch (e) {}
        finish();
        return;
      }
      try {
        var tx = db.transaction(IDB_STORE, "readonly");
        var req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = function () { entries = (req.result || []).slice(); finish(); };
        req.onerror = function () { finish(); };
      } catch (e) { finish(); }
    });
  }

  /*
   * 提交按钮（二合一）：点击才提交，不作后台自动同步。
   * 每次点击同时做两件事：
   *   1. 提交 —— http(s) 下 POST /api/records（kit.py serve 实时落盘 records/），
   *      失败或离线时 payload 留在 IndexedDB，下次在线打开页面自动补传（flushQueue）；
   *   2. 复制 —— 把同样的 Markdown 复制到剪贴板，供 file:// 离线粘贴给 Agent。
   */
  function setupSubmitButton(lesson, store) {
    if (typeof document === "undefined") return;
    Array.prototype.slice.call(document.querySelectorAll("[data-submit-feedback]")).forEach(function (button) {
      if (button.dataset.kitBound === "true") return;
      button.dataset.kitBound = "true";

      button.addEventListener("click", function () {
        var status = lesson.querySelector("[data-submit-feedback-status]");
        var setStatus = function (text) { if (status) status.textContent = text; };
        var record = buildLearningRecord(lesson, store ? store.getState() : {});
        if (!record.hasContent) {
          setStatus("请先完成练习或填写反馈");
          return;
        }

        var payload = buildPayload(lesson, store.getState());
        var submitted = false;
        var copied = false;
        var clearTimer = null;
        var report = function () {
          var text;
          if (submitted && copied) text = "✓ 已提交到 records/，并已复制到剪贴板";
          else if (submitted) text = "✓ 已提交到 records/（复制未成功，可再次点击）";
          else if (copied) text = "● 已复制到剪贴板（未检测到本地服务；下次在线打开课件时自动补传）";
          else text = "● 已暂存浏览器（未检测到本地服务，且复制未成功）";
          setStatus(text);
          if (clearTimer) clearTimeout(clearTimer);
          clearTimer = setTimeout(function () { setStatus(""); }, 6000);
        };

        // 先复制（保持用户手势上下文，剪贴板 API 在异步回调里可能被拒）
        kit.util.copyText(record.text, function () { copied = true; report(); }, function () { report(); });

        saveToQueue(payload, function () {
          var isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
          if (!isHttp || typeof fetch === "undefined") { report(); return; }
          var headers = { "Content-Type": "application/json" };
          var tok = getServeToken();
          if (tok) headers["X-Kit-Token"] = tok;
          fetch("/api/records", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
          }).then(function (r) {
            if (r.ok) { submitted = true; removeQueued(payload.key); }
            report();
          }).catch(function () {
            report();
          });
        });
      });
    });
  }

  function initRecords() {
    if (recordsInitialized) return;
    recordsInitialized = true;
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

    getServeToken();
    flushQueue();
    setupSubmitButton(lesson, store);

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

  // Standalone fallback: only listen to DOMContentLoaded if not managed by kit registry
  if (!kit.registerModule && typeof document !== "undefined") {
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

  /* ---- Bundle Initialization ---- */
  if (CourseKit.initAll && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', CourseKit.initAll);
    } else {
      CourseKit.initAll();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
