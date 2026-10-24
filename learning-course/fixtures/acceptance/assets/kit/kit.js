/**
 * Course Kit v2 Bundled Runtime
 * Built by kit.py. Do not edit directly.
 */
(function (global) {
  "use strict";
  var CourseKit = global.CourseKit = global.CourseKit || {};
  global.kit = global.kit || CourseKit;
  CourseKit.__COURSE_CONFIG__ = {"theme": "course", "vendor": {"mode": "cdn"}, "code": {"themes": {"light": "github", "dark": "github-dark"}}, "modules": ["viz.kinds.spatial", "viz.kinds.chart"]};
  CourseKit.__ACTIVE_MODULES__ = ["core", "foundation", "content._block", "content.code", "content.math", "content.media", "shell.elements", "shell.nav", "shell.progress", "shell.theme-switcher", "shell.toc", "learning.records", "learning.question", "viz.core", "viz.kinds.chart", "viz.kinds.list", "viz.kinds.sequence", "viz.kinds.spatial", "viz.kinds.table"];
  CourseKit.VENDORS = {"hljs": {"id": "hljs", "version": "11.12.0", "js": {"cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js", "local": "../assets/kit/vendor/hljs/highlight.min.js"}}, "katex": {"id": "katex", "version": "0.16.11", "css": {"cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css", "local": "../assets/kit/vendor/katex/katex.min.css"}, "js": {"cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", "local": "../assets/kit/vendor/katex/katex.min.js"}, "autoRender": {"cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js", "local": "../assets/kit/vendor/katex/auto-render.min.js"}}, "plotly": {"id": "plotly", "version": "4.1.2", "js": {"cdn": "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.1.2/plotly.min.js", "local": "../assets/kit/vendor/plotly.js-dist-min/plotly.min.js"}}, "jsxgraph": {"id": "jsxgraph", "version": "1.14.0", "css": {"cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraph.css", "local": "../assets/kit/vendor/jsxgraph/jsxgraph.css"}, "js": {"cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraphcore.js", "local": "../assets/kit/vendor/jsxgraph/jsxgraphcore.js"}}};
  CourseKit.__EXTENSIONS__ = [];
  CourseKit.__NAV_DATA__ = {"title": "通用资产验收课件", "course_id": "acceptance-course", "current_lesson": 6, "completed_lessons": [], "completed_count": 0, "total_count": 6, "lessons": [{"number": "0001", "chapter": "", "title": "数学推导与核对", "objective": "math", "file": "0001-math.html", "key": "0001", "href": "lessons/0001-math.html", "home": "../index.html", "prev": null, "next": {"number": "0002", "file": "0002-probability.html", "chapter": "", "key": "0002", "href": "0002-probability.html"}}, {"number": "0002", "chapter": "", "title": "概率参数实验", "objective": "probability", "file": "0002-probability.html", "key": "0002", "href": "lessons/0002-probability.html", "home": "../index.html", "prev": {"number": "0001", "file": "0001-math.html", "chapter": "", "key": "0001", "href": "0001-math.html"}, "next": {"number": "0003", "file": "0003-algorithm.html", "chapter": "", "key": "0003", "href": "0003-algorithm.html"}}, {"number": "0003", "chapter": "", "title": "算法回放与流程", "objective": "algorithm", "file": "0003-algorithm.html", "key": "0003", "href": "lessons/0003-algorithm.html", "home": "../index.html", "prev": {"number": "0002", "file": "0002-probability.html", "chapter": "", "key": "0002", "href": "0002-probability.html"}, "next": {"number": "0004", "file": "0004-history.html", "chapter": "", "key": "0004", "href": "0004-history.html"}}, {"number": "0004", "chapter": "", "title": "材料分析与时间轴", "objective": "history", "file": "0004-history.html", "key": "0004", "href": "lessons/0004-history.html", "home": "../index.html", "prev": {"number": "0003", "file": "0003-algorithm.html", "chapter": "", "key": "0003", "href": "0003-algorithm.html"}, "next": {"number": "0005", "file": "0005-design.html", "chapter": "", "key": "0005", "href": "0005-design.html"}}, {"number": "0005", "chapter": "", "title": "图像观察与标注", "objective": "design", "file": "0005-design.html", "key": "0005", "href": "lessons/0005-design.html", "home": "../index.html", "prev": {"number": "0004", "file": "0004-history.html", "chapter": "", "key": "0004", "href": "0004-history.html"}, "next": {"number": "0006", "file": "0006-language.html", "chapter": "", "key": "0006", "href": "0006-language.html"}}, {"number": "0006", "chapter": "", "title": "听辨媒体与填空", "objective": "language", "file": "0006-language.html", "key": "0006", "href": "lessons/0006-language.html", "home": "../index.html", "prev": {"number": "0005", "file": "0005-design.html", "chapter": "", "key": "0005", "href": "0005-design.html"}, "next": null}], "home": "../index.html"};

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
    plot: {
      id: "plot",
      version: "0.6.16",
      js: {
        cdn: "https://cdn.jsdelivr.net/combine/npm/d3@7.9.0/dist/d3.min.js,npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js",
        local: "../assets/kit/vendor/observable-plot/plot.umd.min.js"
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
    // Only vendors with actual local distribution packages should use local mode
    var localPackages = ["plotly", "jsxgraph"];
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
   * 主题预设注册表。
   * scheme：页面明暗；code：代码块高亮使用的明暗（可与页面不同，例如浅色页面配深色代码块）；
   * fonts：按需加载的网页字体（fontsource 包名:字重，或完整 URL），失败时回退到 CSS 字体栈。
   */
  var THEMES = {
    course:    { label: "默认",     scheme: "light" },
    paper:     { label: "纸张",     scheme: "light" },
    ink:       { label: "深色",     scheme: "dark" },
    swiss:     { label: "瑞士网格", scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "jetbrains-mono:400,700"] },
    blueprint: { label: "工程蓝图", scheme: "dark",
                 fonts: ["noto-sans-sc:400,700", "jetbrains-mono:400,700"] },
    riso:      { label: "孔版印刷", scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "space-grotesk:500,700"] },
    brutal:    { label: "新粗野",   scheme: "light", code: "dark",
                 fonts: ["noto-sans-sc:400,700,900", "space-grotesk:500,700", "jetbrains-mono:400,700"] },
    field:     { label: "博物志",   scheme: "light", code: "dark",
                 fonts: ["lxgw-wenkai", "jetbrains-mono:400,700"] }
  };

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
    } catch (e) {
      console.error("[kit.math] Render error", e);
      throw e;
    }
  }

  function init() {
    if (typeof document === "undefined") return Promise.resolve();
    if (!hasMathContent()) {
      return Promise.resolve();
    }

    if (typeof window.renderMathInElement === "function") {
      try {
        renderMath();
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    } else if (kit.need) {
      return kit.need("katex").then(function () {
        renderMath();
      }).catch(function (err) {
        console.warn("[kit.math] KaTeX not available, degrading formula blocks", err);
        root.__COURSE_MATH_READY__ = true;
        document.querySelectorAll(".formula, [data-math]").forEach(function (el) {
          if (el.closest(".kit-block")) {
            el.closest(".kit-block").dataset.kitState = "degraded";
          }
        });
        if (kit.ready && kit.ready.markDegraded) {
          kit.ready.markDegraded("content.math", err);
        }
      });
    }
    return Promise.resolve();
  }

  kit.math = {
    init: init,
    render: renderMath
  };

  if (kit.registerModule) {
    kit.registerModule("content.math", kit.math);
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: content.media (media.js) ---- */
  (function () {
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
        .catch(function () {});
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

  /* ---- Question Kind Adapters Registry (Architecture §7.4 & P6) ---- */

  var kindAdapters = {};

  function registerKind(kind, adapter) {
    if (!kind || !adapter) return;
    kindAdapters[kind] = adapter;
    if (adapter.label && !KIND_LABEL[kind]) {
      KIND_LABEL[kind] = adapter.label;
    }
  }

  function getKind(kind) {
    return kindAdapters[kind];
  }

  /* 1. Choice Adapter */
  registerKind("choice", {
    label: "单选",
    mount: function (ctx) {
      var optsSrc = ctx.optsSrc;
      if (!optsSrc) return;
      var ol = el("ol", "q-options");
      var inputs = [];
      Array.prototype.forEach.call(optsSrc.children, function (li, i) {
        var whyNode = li.querySelector("[data-why]");
        var why = whyNode ? whyNode.textContent : "";
        if (whyNode) whyNode.remove();

        var item = el("li", "q-option");
        if (li.hasAttribute("data-correct")) item.dataset.correct = "true";
        var lab = el("label");
        var inp = el("input");
        inp.type = "radio";
        inp.name = ctx.id;

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
          ctx.q.raw = checkedItems.map(function (x) { return x.text; }).join("；");
        });
      });
      optsSrc.remove();
      ctx.body.appendChild(ol);
      ctx.controls.inputs = inputs;
    },
    getRawAnswer: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var checkedItems = inputs.filter(function (x) { return x.input.checked; });
      return checkedItems.map(function (x) { return x.text; }).join("；");
    },
    judge: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var picked = inputs.filter(function (x) { return x.input.checked; });
      if (!picked.length) {
        ctx.feedback.textContent = "先选择答案，再检查。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = picked.map(function (x) { return x.text; }).join("；");
      return picked.length === 1 && picked[0].item.dataset.correct === "true";
    },
    reveal: function (ctx, isReveal) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) {
        var isRight = x.item.dataset.correct === "true";
        var picked = x.input.checked;
        if (picked && isRight) x.item.dataset.result = "right";
        else if (picked && !isRight) x.item.dataset.result = "wrong";
        else if (!picked && isRight && isReveal) x.item.dataset.result = "missed";
        else delete x.item.dataset.result;
      });
    },
    lock: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) { x.input.disabled = true; });
    }
  });

  /* 2. Multi-Choice Adapter */
  registerKind("multi", {
    label: "多选",
    mount: function (ctx) {
      var optsSrc = ctx.optsSrc;
      if (!optsSrc) return;
      var ol = el("ol", "q-options");
      var inputs = [];
      Array.prototype.forEach.call(optsSrc.children, function (li, i) {
        var whyNode = li.querySelector("[data-why]");
        var why = whyNode ? whyNode.textContent : "";
        if (whyNode) whyNode.remove();

        var item = el("li", "q-option");
        if (li.hasAttribute("data-correct")) item.dataset.correct = "true";
        var lab = el("label");
        var inp = el("input");
        inp.type = "checkbox";
        inp.name = ctx.id;

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
          ctx.q.raw = checkedItems.map(function (x) { return x.text; }).join("；");
        });
      });
      optsSrc.remove();
      ctx.body.appendChild(ol);
      ctx.controls.inputs = inputs;
    },
    getRawAnswer: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var checkedItems = inputs.filter(function (x) { return x.input.checked; });
      return checkedItems.map(function (x) { return x.text; }).join("；");
    },
    judge: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      var picked = inputs.filter(function (x) { return x.input.checked; });
      if (!picked.length) {
        ctx.feedback.textContent = "先选择答案，再检查。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = picked.map(function (x) { return x.text; }).join("；");
      var right = inputs.filter(function (x) { return x.item.dataset.correct === "true"; });
      return picked.length === right.length && picked.every(function (x) { return x.item.dataset.correct === "true"; });
    },
    reveal: function (ctx, isReveal) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) {
        var isRight = x.item.dataset.correct === "true";
        var picked = x.input.checked;
        if (picked && isRight) x.item.dataset.result = "right";
        else if (picked && !isRight) x.item.dataset.result = "wrong";
        else if (!picked && isRight && isReveal) x.item.dataset.result = "missed";
        else delete x.item.dataset.result;
      });
    },
    lock: function (ctx) {
      var inputs = ctx.controls.inputs || [];
      inputs.forEach(function (x) { x.input.disabled = true; });
    }
  });

  /* 3. Numeric Adapter */
  registerKind("numeric", {
    label: "数值",
    mount: function (ctx) {
      var field = el("div", "q-field");
      var lab2 = el("label", "q-label", "你的答案");
      lab2.setAttribute("for", ctx.id + "-in");
      var inp2 = el("input", "q-input");
      inp2.id = ctx.id + "-in";
      inp2.autocomplete = "off";
      inp2.inputMode = "decimal";

      field.appendChild(lab2);
      field.appendChild(inp2);
      if (ctx.rootEl.dataset.unit) field.appendChild(el("span", "q-unit", ctx.rootEl.dataset.unit));
      field.appendChild(el("p", "q-note", "允许误差 ±" + (ctx.rootEl.dataset.tolerance || 0) +
        (ctx.rootEl.dataset.unit ? " " + ctx.rootEl.dataset.unit : "") + "。"));
      ctx.body.appendChild(field);
      ctx.controls.input = inp2;
      inp2.addEventListener("input", function () { ctx.q.raw = inp2.value; });
      inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") ctx.bCheck.click(); });
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    judge: function (ctx) {
      var raw = ctx.controls.input ? ctx.controls.input.value : "";
      if (!raw.trim()) {
        ctx.feedback.textContent = "先填写答案。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = raw;
      var v = Number(raw.trim());
      var expected = Number(ctx.rootEl.dataset.expected);
      var tol = Number(ctx.rootEl.dataset.tolerance || 0);
      return Number.isFinite(v) && Number.isFinite(expected) && Number.isFinite(tol) && tol >= 0 && Math.abs(v - expected) <= tol;
    },
    reveal: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.value = ctx.rootEl.dataset.expected || "";
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 4. Fill Adapter */
  registerKind("fill", {
    label: "填空",
    mount: function (ctx) {
      var field = el("div", "q-field");
      var lab2 = el("label", "q-label", "填写答案");
      lab2.setAttribute("for", ctx.id + "-in");
      var inp2 = el("input", "q-input");
      inp2.id = ctx.id + "-in";
      inp2.autocomplete = "off";

      field.appendChild(lab2);
      field.appendChild(inp2);
      if (ctx.rootEl.dataset.unit) field.appendChild(el("span", "q-unit", ctx.rootEl.dataset.unit));
      ctx.body.appendChild(field);
      ctx.controls.input = inp2;
      inp2.addEventListener("input", function () { ctx.q.raw = inp2.value; });
      inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") ctx.bCheck.click(); });
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    judge: function (ctx) {
      var raw = ctx.controls.input ? ctx.controls.input.value : "";
      if (!raw.trim()) {
        ctx.feedback.textContent = "先填写答案。";
        ctx.feedback.dataset.tone = "info";
        return null;
      }
      ctx.q.raw = raw;
      var acc = [];
      try { acc = JSON.parse(ctx.rootEl.dataset.accepted || "[]"); } catch (e) { acc = []; }
      var cs = ctx.rootEl.dataset.caseSensitive === "true";
      return Array.isArray(acc) && acc.some(function (a) { return norm(a, cs) === norm(raw, cs); });
    },
    reveal: function (ctx) {
      try {
        var acc = JSON.parse(ctx.rootEl.dataset.accepted || "[]");
        if (ctx.controls.input && acc.length) ctx.controls.input.value = acc[0];
      } catch (e) {}
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 5. Open Question Adapter */
  registerKind("open", {
    label: "开放",
    checkButtonText: "保存并查看对照要点",
    mount: function (ctx) {
      var field3 = el("div", "q-field");
      var lab3 = el("label", "q-label", "写下你的纠正、条件与反例");
      lab3.setAttribute("for", ctx.id + "-in");
      var ta = el("textarea", "q-textarea");
      ta.id = ctx.id + "-in";
      var cnt = el("span", "q-count", "0 字");
      ta.addEventListener("input", function () {
        cnt.textContent = ta.value.length + " 字";
        ctx.q.raw = ta.value;
      });
      field3.appendChild(lab3);
      field3.appendChild(ta);
      field3.appendChild(cnt);
      ctx.body.appendChild(field3);
      ctx.controls.input = ta;
      if (ctx.keySrc) ctx.keySrc.remove();
    },
    getRawAnswer: function (ctx) {
      return ctx.controls.input ? ctx.controls.input.value : "";
    },
    submit: function (ctx) {
      var rawText = ctx.controls.input ? ctx.controls.input.value : "";
      if (!rawText.trim()) {
        if (ctx.controls.input) ctx.controls.input.focus();
        ctx.feedback.textContent = "先写下自己的回答。";
        ctx.feedback.dataset.tone = "info";
        return;
      }
      ctx.q.raw = rawText;
      ctx.q.attempts = 1;
      ctx.key.hidden = false;
      renderMath(ctx.key);
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
      ctx.bCheck.disabled = true;
      ctx.dispatch({ type: EVIDENCE.RAW_ANSWER, id: ctx.id, value: rawText });
      ctx.dispatch({ type: EVIDENCE.KEY_VIEWED, id: ctx.id });
      ctx.setState("saved", "info", "回答已保存，请对照要点自查差距。");
    },
    lock: function (ctx) {
      if (ctx.controls.input) ctx.controls.input.readOnly = true;
    }
  });

  /* 6. Dialogue Adapter */
  registerKind("dialogue", {
    label: "对话",
    checkButtonText: "保存本轮并继续",
    mount: function (ctx) {
      var wrap = el("div", "q-turns");
      var turns = [];
      if (ctx.turnsSrc) {
        Array.prototype.forEach.call(ctx.turnsSrc.children, function (li, i) {
          var t = el("div", "q-turn");
          t.hidden = i > 0;
          // records.js 按 [data-dialogue-turn] / [data-dialogue-prompt] 收集轮次
          // 原文与追问类型（learning.records 契约），这里同时挂两套属性。
          t.dataset.dialogueTurn = String(i + 1);
          t.dataset.guidance = li.dataset.guidance || "question";
          var promptText = li.dataset.prompt || li.textContent.trim();
          var p = el("label", "q-turn-prompt", promptText);
          p.setAttribute("for", ctx.id + "-t" + i);
          p.setAttribute("data-dialogue-prompt", "");
          var ta2 = el("textarea", "q-textarea");
          ta2.id = ctx.id + "-t" + i;
          t.appendChild(p);
          t.appendChild(ta2);
          wrap.appendChild(t);
          turns.push({ node: t, ta: ta2, guidance: li.dataset.guidance });
        });
        ctx.turnsSrc.remove();
      }
      ctx.body.appendChild(wrap);
      ctx.controls.turns = turns;
      ctx.controls.cur = 0;
    },
    getRawAnswer: function (ctx) {
      var turns = ctx.controls.turns || [];
      var cur = turns[ctx.controls.cur];
      return cur ? cur.ta.value : "";
    },
    submit: function (ctx) {
      var cur = ctx.controls.turns[ctx.controls.cur];
      if (!cur) return;
      var val = cur.ta.value;
      if (!val.trim()) {
        cur.ta.focus();
        ctx.feedback.textContent = "先留下自己的回答，再继续。";
        ctx.feedback.dataset.tone = "info";
        return;
      }
      cur.ta.readOnly = true;
      cur.node.dataset.done = "";
      ctx.q.attempts = ctx.controls.cur + 1;
      var turnId = String(ctx.controls.cur + 1);
      ctx.dispatch({ type: EVIDENCE.TURN_RAW, id: ctx.id, turn: turnId, value: val });
      ctx.dispatch({ type: EVIDENCE.TURN_SUBMITTED, id: ctx.id, turn: turnId });

      if (ctx.controls.cur + 1 < ctx.controls.turns.length) {
        ctx.controls.cur++;
        var nextTurn = ctx.controls.turns[ctx.controls.cur];
        nextTurn.node.hidden = false;
        if (nextTurn.guidance) ctx.setAssistance(nextTurn.guidance);
        nextTurn.ta.focus();
        if (ctx.controls.cur + 1 === ctx.controls.turns.length) ctx.bCheck.textContent = "保存最后一轮";
        ctx.setState("idle", "info", "上一轮已保留。请回答新的追问。");
      } else {
        ctx.bCheck.disabled = true;
        ctx.setState("saved", "info", "各轮回答已保留，点击“复制并提交学习记录”交给老师评估。");
      }
      ctx.meta.textContent = "已完成 " + ctx.q.attempts + "/" + ctx.controls.turns.length + " 轮" + (ctx.q.hints ? " · 提示 " + ctx.q.hints : "");
    },
    lock: function (ctx) {
      if (ctx.controls.turns) {
        ctx.controls.turns.forEach(function (t) { t.ta.readOnly = true; });
      }
    }
  });

  /* ---- Modern Question Enhancer (Architecture §7.4) ---- */

  function enhanceModernQuestion(rootEl, index, store) {
    if (rootEl.dataset.kitEnhanced === "true") return;
    rootEl.dataset.kitEnhanced = "true";

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
      observedAssistance: null,
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

    var adapter = getKind(kind) || getKind("choice");

    var actions = el("div", "q-actions");
    var bHint = el("button", "btn ghost", "需要提示");
    bHint.type = "button";
    var defaultCheckText = adapter && adapter.checkButtonText ? adapter.checkButtonText : "检查答案";
    var bCheck = el("button", "btn primary", defaultCheckText);
    bCheck.type = "button";
    var bReveal = el("button", "btn", "查看答案");
    bReveal.type = "button";
    bReveal.hidden = true;

    if (hintNodes.length) actions.appendChild(bHint);
    actions.appendChild(bCheck);
    actions.appendChild(bReveal);

    function dispatch(action) {
      if (store && store.dispatch) store.dispatch(action);
    }

    function setAssistance(level) {
      if (q.observedAssistance === "ai_guided") return;
      if (level === "ai_guided" || (q.observedAssistance !== "with_hints" && level === "with_hints")) {
        q.observedAssistance = level;
      }
      rootEl.dataset.observedAssistance = q.observedAssistance;
      dispatch({ type: EVIDENCE.OBSERVED_ASSISTANCE, id: id, value: q.observedAssistance });
    }

    function setState(s, tone, msg) {
      q.verdict = s;
      rootEl.dataset.state = s;
      rootEl.dataset.attempts = String(q.attempts);
      rootEl.dataset.hintUsed = q.hints > 0 ? "true" : "false";
      if (q.observedAssistance) {
        rootEl.dataset.observedAssistance = q.observedAssistance;
      }

      stateChip.textContent = STATE_LABEL[s] || s;
      feedback.textContent = msg || "";
      feedback.dataset.tone = tone || "";
      feedback.dataset.state = s;

      var parts = [];
      if (q.attempts) parts.push("第 " + q.attempts + " 次作答");
      if (q.hints) parts.push("提示 " + q.hints + "/" + hintNodes.length);
      if (s === "correct" || s === "saved") {
        parts.push(q.hints > 0 ? (q.observedAssistance === "ai_guided" ? "AI引导" : "用过提示") : "未用提示");
      }
      meta.textContent = parts.join(" · ");
      updateSummary();
    }

    function lock() {
      rootEl.dataset.locked = "";
      actions.querySelectorAll("button").forEach(function (b) {
        if (b !== bReveal) b.disabled = true;
      });
      if (adapter && adapter.lock) {
        adapter.lock(ctx);
      }
      bReveal.hidden = true;
    }

    var ctx = {
      rootEl: rootEl,
      id: id,
      kind: kind,
      body: body,
      stem: stem,
      optsSrc: optsSrc,
      keySrc: keySrc,
      turnsSrc: turnsSrc,
      explain: explain,
      key: key,
      q: q,
      dispatch: dispatch,
      renderMath: renderMath,
      bCheck: bCheck,
      bReveal: bReveal,
      feedback: feedback,
      meta: meta,
      setState: setState,
      setAssistance: setAssistance,
      lock: lock,
      controls: controls
    };

    if (adapter && adapter.mount) {
      adapter.mount(ctx);
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

    bCheck.addEventListener("click", function () {
      if (adapter && adapter.submit) {
        adapter.submit(ctx);
        return;
      }

      if (!adapter || !adapter.judge) return;
      var ok = adapter.judge(ctx);
      if (ok === null) return;
      q.attempts++;

      var rawAns = adapter.getRawAnswer ? adapter.getRawAnswer(ctx) : q.raw;
      q.raw = rawAns;
      dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: rawAns });
      dispatch({ type: EVIDENCE.ATTEMPT, id: id });
      dispatch({ type: EVIDENCE.VERDICT, id: id, value: ok ? "correct" : "incorrect" });

      if (ok) {
        if (adapter.reveal) adapter.reveal(ctx, true);
        explain.hidden = false;
        renderMath(explain);
        lock();
        setState("correct", "correct", "回答正确。请用一句话说明判断依据。");
      } else {
        if (adapter.reveal) adapter.reveal(ctx, false);
        var left = maxAttempts - q.attempts;
        if (left <= 0) bReveal.hidden = false;
        bCheck.textContent = "再检查一次";
        setState("incorrect", "incorrect", left > 0 ?
          "还不对，再检查题干条件。还可以再试 " + left + " 次。" :
          "还不对。可以继续尝试，或查看答案与解析。");
      }
    });

    bReveal.addEventListener("click", function () {
      if (adapter && adapter.reveal) adapter.reveal(ctx, true);
      explain.hidden = false;
      renderMath(explain);
      lock();
      dispatch({ type: EVIDENCE.KEY_VIEWED, id: id });
      setAssistance("answer_revealed");
      setState("incorrect", "incorrect", "已显示答案。回头想想：当时哪一步判断偏了？");
      q.revealed = true;
    });

    setState("idle", "", "");
    meta.textContent = "";
  }

  /* ---- Main Init ---- */

  var questionsInitialized = false;

  function initQuestions() {
    if (questionsInitialized) return;
    questionsInitialized = true;
    if (typeof document === "undefined") return;
    var lesson = document.querySelector(".lesson") || document.body;
    var store = lesson.__evidenceStore;

    if (!store && LearnKit && LearnKit.createStore && kit.records && kit.records.evidenceModel) {
      store = LearnKit.createStore(kit.records.evidenceModel());
      lesson.__evidenceStore = store;
    }

    // Process modern questions
    var modernSelector = "section.question, .question[data-kind], section[data-question-id][data-kind], section[data-question-id]:has([data-stem])";
    var modernEls = Array.prototype.slice.call(document.querySelectorAll(modernSelector));
    modernEls.forEach(function (qEl, i) {
      enhanceModernQuestion(qEl, i, store);
    });

    // Support legacy answer elements ([data-answer-input] + [data-answer-check])
    var legacySelector = "[data-question-id]:has([data-answer-input]), section[data-question-id][data-answer-kind]";
    var legacyEls = Array.prototype.slice.call(document.querySelectorAll(legacySelector));
    legacyEls.forEach(function (task) {
      if (task.dataset.kitEnhanced === "true") return;
      task.dataset.kitEnhanced = "true";
      var id = task.dataset.questionId;
      var input = task.querySelector("[data-answer-input]");
      var button = task.querySelector("[data-answer-check]");
      var feedback = task.querySelector("[data-role~=answer-feedback]") || task.querySelector("[data-role=answer-feedback]");
      function normalize(value) {
        var text = String(value).normalize("NFKC").trim();
        return task.dataset.caseSensitive === "true" ? text : text.toLocaleLowerCase();
      }
      if (input) {
        input.addEventListener("input", function () {
          var curStore = (lesson && lesson.__evidenceStore) || store;
          if (curStore && curStore.dispatch) {
            curStore.dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: input.value });
          }
        });
      }
      if (button && input) {
        button.addEventListener("click", function () {
          var raw = input.value;
          if (!raw.trim()) {
            if (feedback) feedback.textContent = "先填写答案。";
            return;
          }
          var correct = false;
          if (task.dataset.answerKind === "numeric") {
            var value = Number(raw), expected = Number(task.dataset.expected);
            var tolerance = Number(task.dataset.tolerance || 0);
            correct = Number.isFinite(value) && Number.isFinite(expected) && Number.isFinite(tolerance) && tolerance >= 0 && Math.abs(value - expected) <= tolerance;
          } else {
            var accepted = [];
            try { accepted = JSON.parse(task.dataset.accepted || "[]"); } catch (e) { accepted = []; }
            correct = Array.isArray(accepted) && accepted.some(function (answer) {
              return typeof answer === "string" && normalize(answer) === normalize(raw);
            });
          }
          var curStore = (lesson && lesson.__evidenceStore) || store;
          if (curStore && curStore.dispatch) {
            curStore.dispatch({ type: EVIDENCE.RAW_ANSWER, id: id, value: raw });
            curStore.dispatch({ type: EVIDENCE.ATTEMPT, id: id });
            curStore.dispatch({ type: EVIDENCE.VERDICT, id: id, value: correct ? "correct" : "incorrect" });
          }
          if (feedback) {
            feedback.textContent = correct ? (task.dataset.correctText || "本题正确。请解释依据。") : (task.dataset.incorrectText || "再检查条件与方法。");
            feedback.dataset.state = correct ? "correct" : "incorrect";
          }
        });
      }
    });

    updateSummary();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("learning.question");
    }
  }

  kit.question = {
    registerKind: registerKind,
    getKind: getKind,
    adapters: kindAdapters,
    enhance: enhanceModernQuestion,
    updateSummary: updateSummary,
    init: initQuestions
  };

  if (kit.registerModule) {
    kit.registerModule("learning.question", kit.question);
  }

  // Standalone fallback: only listen to DOMContentLoaded if not managed by kit registry
  if (!kit.registerModule && typeof document !== "undefined") {
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

  var initPromise = null;

  function init() {
    if (!document) return Promise.resolve();
    if (initPromise) return initPromise;
    initPromise = (async function () {
      var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-visualization]"));
      await Promise.all(nodes.map(async function (node) {
        if (node.dataset.kitEnhanced === "true") return;
        node.dataset.kitEnhanced = "true";
        try {
          node.dataset.kitState = "pending";
          var configNode = find(node, "[data-viz-config]");
          if (!configNode) throw new Error("缺少 data-viz-config");
          var kind = node.dataset.visualization, config = validateConfig(kind, JSON.parse(configNode.textContent));
          var sourceStore = null;
          if (node.dataset.vizSource) {
            var source = document.querySelector(node.dataset.vizSource);
            sourceStore = source && source.__learnkitStore;
            if (!sourceStore && typeof setTimeout === "function") {
              await new Promise(function (resolve) {
                var checkCount = 0;
                var interval = setInterval(function () {
                  checkCount++;
                  sourceStore = source && source.__learnkitStore;
                  if (sourceStore || checkCount >= 10) {
                    clearInterval(interval);
                    resolve();
                  }
                }, 10);
              });
            }
            if (!sourceStore) throw new Error("data-viz-source 未找到 LearnKit 状态源：" + node.dataset.vizSource);
          }
          var instance = await adapters[kind].render(node, config, { sourceStore: sourceStore });
          // 渲染成功后隐藏无脚本后备：后备只在失败与无 JS 时可见
          var renderedFallback = find(node, "[data-viz-fallback]");
          if (renderedFallback) renderedFallback.hidden = true;
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
    })();
    return initPromise;
  }

  api.init = init;

  if (kit.registerModule) {
    kit.registerModule("viz.core", api);
  }

  // Fallback trigger ONLY in isolated / test harness environments where registry coordinator is absent
  if (!kit.registerModule && !kit.registry && typeof setTimeout === "function" && typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        init();
      }, { once: true });
    } else {
      setTimeout(function () {
        init();
      }, 0);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

  })();

  /* ---- Module: viz.kinds.chart (chart.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function validateChart(config) {
    core.validateCommon(config);
    if (!Array.isArray(config.traces) || !config.traces.length)
      throw new Error("chart 需要 traces");
    config.traces.forEach(function (trace) {
      if (!trace || typeof trace !== "object")
        throw new Error("chart trace 必须是对象");
      var type = trace.type || "scatter";
      if (["scatter", "bar", "surface", "heatmap"].indexOf(type) < 0)
        throw new Error("chart 不支持 " + type);
      if (type === "bar" || type === "scatter") {
        var numeric = h.finiteArray(trace.x);
        var categories =
          Array.isArray(trace.x) &&
          trace.x.length &&
          trace.x.every(function (x) {
            return typeof x === "string" && x.trim();
          });
        if (
          !(numeric || categories) ||
          !Array.isArray(trace.y) ||
          trace.x.length !== trace.y.length ||
          !trace.y.some(h.finite) ||
          trace.y.some(function (v) {
            return v !== null && !h.finite(v);
          })
        )
          throw new Error("chart x 必须同为数值或分类，y 为等长有限数值/空缺数组");
      } else if (
        !h.finiteArray(trace.x) ||
        !h.finiteArray(trace.y) ||
        !Array.isArray(trace.z) ||
        trace.z.length !== trace.y.length ||
        trace.z.some(function (row) {
          return (
            !Array.isArray(row) ||
            row.length !== trace.x.length ||
            row.some(function (v) {
              return v !== null && !h.finite(v);
            })
          );
        })
      )
        throw new Error("chart 网格 z 的形状必须与 x/y 匹配");
    });
    var simple = config.traces.filter(function (t) {
      return ["surface", "heatmap"].indexOf(t.type) < 0;
    });
    if (
      simple.length &&
      simple.some(function (t) {
        return typeof t.x[0] !== typeof simple[0].x[0];
      })
    )
      throw new Error("chart 同一横轴不能混用分类与数值");
    return config;
  }

  function renderSvg(node, config) {
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    if (
      config.traces.some(function (t) {
        return t.type === "surface" || t.type === "heatmap";
      })
    ) {
      var note = document.createElement("p");
      note.textContent = "网格数据已校验；渲染器不可用，请核对静态后备。";
      host.appendChild(note);
      h.status(node, note.textContent);
      return;
    }
    var svg = h.svgEl("svg", {
      viewBox: "0 0 720 380",
      role: "img",
      "aria-label": config.model
    });
    host.appendChild(svg);
    var categories = [], xs = [], ys = [];
    config.traces.forEach(function (t) {
      t.x.forEach(function (x) {
        if (typeof x === "string") {
          if (categories.indexOf(x) < 0) categories.push(x);
        } else xs.push(x);
      });
      t.y.forEach(function (y) {
        if (h.finite(y)) ys.push(y);
      });
    });
    if (categories.length)
      xs = categories.map(function (_, i) { return i; });
    var minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys);
    if (config.traces.some(function (t) { return t.type === "bar"; })) {
      minY = Math.min(0, minY);
      maxY = Math.max(0, maxY);
    }
    if (minX === maxX) maxX = minX + 1;
    if (minY === maxY) maxY = minY + 1;
    function px(x) {
      return 70 + (((typeof x === "string" ? categories.indexOf(x) : x) - minX) / (maxX - minX)) * 580;
    }
    function py(y) {
      return 310 - ((y - minY) / (maxY - minY)) * 270;
    }
    function text(x, y, value) {
      var el = h.svgEl("text", {
        x: x,
        y: y,
        "text-anchor": "middle",
        "font-size": 13,
        fill: "var(--c-text-2, #65738a)"
      });
      el.textContent = value;
      svg.appendChild(el);
    }
    svg.appendChild(h.svgEl("line", { x1: 50, y1: 310, x2: 680, y2: 310, stroke: "var(--c-border, #ccd3df)" }));
    svg.appendChild(h.svgEl("line", { x1: 50, y1: 40, x2: 50, y2: 310, stroke: "var(--c-border, #ccd3df)" }));
    if (categories.length) {
      categories.forEach(function (x) { text(px(x), 335, x); });
    } else {
      text(70, 335, h.fmt(minX));
      text(650, 335, h.fmt(maxX));
    }
    text(28, 310, h.fmt(minY));
    text(28, 44, h.fmt(maxY));
    config.traces.forEach(function (trace, index) {
      var defaultColors = [
        "var(--series-1, #2563eb)",
        "var(--series-2, #059669)",
        "var(--series-3, #d97706)"
      ];
      var color = trace.color || defaultColors[index % 3];
      if (trace.type === "bar") {
        trace.x.forEach(function (x, i) {
          if (h.finite(trace.y[i]))
            svg.appendChild(
              h.svgEl("rect", {
                x: px(x) - 10,
                y: Math.min(py(0), py(trace.y[i])),
                width: 20,
                height: Math.abs(py(0) - py(trace.y[i])),
                fill: color
              })
            );
        });
        return;
      }
      var path = "", segment = false, mode = trace.mode || "lines";
      trace.x.forEach(function (x, i) {
        var y = trace.y[i];
        if (!h.finite(y)) {
          segment = false;
          return;
        }
        path += (segment ? " L " : " M ") + px(x).toFixed(2) + " " + py(y).toFixed(2);
        segment = true;
        if (mode.indexOf("markers") >= 0)
          svg.appendChild(h.svgEl("circle", { cx: px(x), cy: py(y), r: 4, fill: color }));
      });
      if (path && mode.indexOf("lines") >= 0)
        svg.appendChild(h.svgEl("path", {
          d: path,
          fill: "none",
          stroke: color,
          "stroke-width": 2
        }));
    });
    h.status(
      node,
      "静态 SVG 视图：" +
        (categories.length
          ? "分类 " + categories.join("、")
          : "x ∈ [" + h.fmt(minX) + ", " + h.fmt(maxX) + "]") +
        "，y ∈ [" + h.fmt(minY) + ", " + h.fmt(maxY) + "]"
    );
  }

  async function renderChart(node, config) {
    if (!root.Plotly) {
      var needFn = kit.need || (kit.loader && kit.loader.need);
      if (needFn) {
        try {
          await needFn("plotly");
        } catch (e) {
          // Vendor loading failed or running in headless/offline/test environment; fallback to SVG
        }
      } else {
        try {
          await h.loadVendor("plotly.js-dist-min/plotly.min.js", "Plotly");
        } catch (e) {}
      }
    }
    var host = h.find(node, "[data-viz-host]"), current = config, disposed = false;
    var plotting = Promise.resolve();

    function paint(next) {
      validateChart(next);
      current = next;
      h.show(node);
      if (root.Plotly) {
        plotting = plotting
          .catch(function () {})
          .then(function () {
            if (disposed) return;
            return root.Plotly.react(
              host,
              next.traces.map(function (t) {
                return Object.assign({}, t, { connectgaps: false });
              }),
              Object.assign(
                { margin: { t: 35, r: 25, b: 55, l: 55 }, autosize: true },
                next.layout || {}
              ),
              { responsive: true, displaylogo: false }
            );
          });
        h.status(node, "图表已更新，共 " + next.traces.length + " 组数据。");
      } else renderSvg(node, next);
      h.record(node, { kind: "chart", model: next.model, traces: next.traces });
      return plotting;
    }

    paint(config);
    await plotting;
    if (root.Plotly && host.on)
      host.on("plotly_click", function (event) {
        var p = event.points && event.points[0];
        if (p) {
          h.status(node, "选中点：x = " + h.fmt(p.x) + "，y = " + h.fmt(p.y));
          h.record(node, {
            kind: "chart",
            model: current.model,
            selected: {
              curve: p.curveNumber,
              point: p.pointNumber,
              x: p.x,
              y: p.y
            }
          });
        }
      });

    return {
      update: function (el, initial, snapshot) {
        return paint(h.boundConfig(el, initial, snapshot));
      },
      destroy: function () {
        disposed = true;
        if (root.Plotly) root.Plotly.purge(host);
      }
    };
  }

  core.registerKind("chart", { validate: validateChart, render: renderChart });

  if (kit.registerModule) {
    kit.registerModule("viz.kinds.chart", {
      init: function () {
        return Promise.resolve();
      }
    });
  }
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

  /* ---- Module: viz.kinds.spatial (spatial.js) ---- */
  (function () {
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var core = root.CourseVisualizations || kit.viz;
  if (!core) return;
  var h = core.helpers;

  function vectorImage(matrix, vector) {
    return matrix.map(function (row) { return row[0] * vector[0] + row[1] * vector[1]; });
  }

  core.vectorImage = vectorImage;

  function validateSpatial(config) {
    core.validateCommon(config);
    if (config.matrix && (!Array.isArray(config.matrix) || config.matrix.length !== 2 || config.matrix.some(function (r) { return !Array.isArray(r) || r.length !== 2 || !r.every(h.finite); }))) throw new Error("spatial matrix 必须为 2×2 有限数值");
    if (config.vector && (!Array.isArray(config.vector) || config.vector.length !== 2 || !config.vector.every(h.finite))) throw new Error("spatial vector 必须为二维有限数值");
    if (!!config.matrix !== !!config.vector) throw new Error("spatial matrix/vector 必须同时提供");
    if (config.matrix && config.vector) {
      var image = core.vectorImage(config.matrix, config.vector);
      if (!image.every(h.finite)) throw new Error("spatial matrix 与 vector 的乘积必须为有限数值");
    }
    if (!config.matrix && (!Array.isArray(config.shapes) || !config.shapes.length)) throw new Error("spatial 需要 matrix/vector 或 shapes");
    return config;
  }

  function renderShapes(node, shapes) {
    h.show(node);
    var host = h.find(node, "[data-viz-host]"), list = document.createElement("ol");
    h.clear(host);
    list.className = "viz-list";
    shapes.forEach(function (item, index) {
      var li = document.createElement("li");
      li.dataset.index = index;
      li.innerHTML = "<strong>" + h.escape(item.title || item.label || item.name || (item.id || index + 1)) + "</strong>" +
        (item.description || item.summary ? "<p>" + h.escape(item.description || item.summary) + "</p>" : "");
      li.addEventListener("click", function () { h.status(node, item.title || item.label || item.name || item.id); });
      list.appendChild(li);
    });
    host.appendChild(list);
    h.status(node, "共 " + shapes.length + " 项；选择一项查看说明。");
    h.record(node, {kind: "spatial", selected: null});
  }

  function renderTransformFallback(node, config) {
    var output = core.vectorImage(config.matrix, config.vector);
    h.show(node);
    var host = h.find(node, "[data-viz-host]");
    h.clear(host);
    var table = document.createElement("table");
    table.className = "viz-table";
    var rows = [
      ["A", config.matrix.map(function (row) { return "[" + row.map(h.fmt).join(", ") + "]"; }).join(" ")],
      ["v", "(" + config.vector.map(h.fmt).join(", ") + ")"],
      ["Av", "(" + output.map(h.fmt).join(", ") + ")"]
    ];
    rows.forEach(function (pair) {
      var tr = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td");
      th.scope = "row"; th.textContent = pair[0]; td.textContent = pair[1];
      tr.appendChild(th); tr.appendChild(td); table.appendChild(tr);
    });
    host.appendChild(table);
    h.status(node, "当前浏览器未加载几何渲染器；已列出 A、v 与 Av，可按行核对矩阵乘法。");
    h.record(node, {kind: "spatial", vector: config.vector, image: output});
  }

  async function renderSpatial(node, config, context) {
    var controls = h.find(node, "[data-viz-controls]"), inputs = controls
      ? Array.prototype.slice.call(controls.querySelectorAll("input[type=number]")) : [];
    var currentVector = config.vector ? config.vector.slice() : null;
    var currentMatrix = config.matrix;
    var repaint;
    function update(nodeElement, nodeConfig, snapshot) {
      var bound = h.boundConfig(nodeElement, nodeConfig, snapshot);
      validateSpatial(bound);
      if (bound.matrix && bound.vector) {
        currentVector = bound.vector.slice(); currentMatrix = bound.matrix;
        syncInputs(currentVector); if (repaint) repaint();
      }
    }
    function readVector() {
      if (inputs.length !== 2) return currentVector;
      var next = inputs.map(function (input) {
        if (!input.value.trim()) return NaN;
        var value = Number(input.value);
        if (input.min !== "" && value < Number(input.min) || input.max !== "" && value > Number(input.max)) return NaN;
        return value;
      });
      if (!next.every(h.finite) || !core.vectorImage(currentMatrix, next).every(h.finite)) return currentVector;
      return next;
    }
    function syncInputs(vector) {
      inputs.forEach(function (input, index) { input.value = vector[index]; });
    }
    if (config.matrix && config.vector) {
      currentVector = readVector();
      syncInputs(currentVector);
      if (!root.JXG) {
        var needFn = kit.need || (kit.loader && kit.loader.need);
        if (needFn) {
          await needFn("jsxgraph");
        } else {
          await h.loadVendor("jsxgraph/jsxgraphcore.js", "JXG");
          if (root.JXG) await h.loadStylesheet("jsxgraph/jsxgraph.css");
        }
      }
      if (root.JXG) {
        h.show(node);
        var host = h.find(node, "[data-viz-host]");
        var output = core.vectorImage(currentMatrix, currentVector);
        var bound = Math.max(5, Math.max.apply(Math, currentVector.map(Math.abs)), Math.max.apply(Math, output.map(Math.abs))) + 1;
        var board = root.JXG.JSXGraph.initBoard(host.id, {boundingbox: [-bound, bound, bound, -bound], axis: true, keepaspectratio: true, showCopyright: false, showNavigation: false, pan: {enabled: false}, zoom: {enabled: false}, resize: {enabled: true}});
        var point = board.create("point", currentVector, {name: "v", size: 4, color: "var(--c-accent, #3157d5)"});
        var transformed = board.create("point", [
          function () { return core.vectorImage(currentMatrix, [point.X(), point.Y()])[0]; },
          function () { return core.vectorImage(currentMatrix, [point.X(), point.Y()])[1]; }
        ], {name: "Av", fixed: true, size: 4, color: "var(--c-danger, #b42318)"});
        board.create("arrow", [[0, 0], point], {strokeColor: "var(--c-accent, #3157d5)", strokeWidth: 3});
        board.create("arrow", [[0, 0], transformed], {strokeColor: "var(--c-danger, #b42318)", strokeWidth: 3, dash: 2});
        function recordVector(vector) {
          var image = core.vectorImage(currentMatrix, vector);
          h.status(node, "v = (" + vector.map(h.fmt).join(", ") + ")；Av = (" + image.map(h.fmt).join(", ") + ")");
          h.record(node, {kind: "spatial", vector: vector, image: image});
        }
        inputs.forEach(function (input) {
          input.addEventListener("change", function () {
            var vector = readVector();
            currentVector = vector;
            syncInputs(vector);
            if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: vector.slice()});
            point.moveTo(vector, 0);
            board.update();
            recordVector(vector);
          });
        });
        point.on("drag", function () {
          currentVector = [point.X(), point.Y()];
          syncInputs(currentVector);
          if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: currentVector.slice()});
          recordVector(currentVector);
        });
        repaint = function () { point.moveTo(currentVector, 0); board.update(); recordVector(currentVector); };
        recordVector(currentVector);
        return {update: update, destroy: function () { if (board && board.remove) board.remove(); }};
      }
      function paintFallback() {
        var nextConfig = Object.assign({}, config, {matrix: currentMatrix, vector: currentVector.slice()});
        renderTransformFallback(node, nextConfig);
      }
      inputs.forEach(function (input) {
        input.addEventListener("change", function () {
          currentVector = readVector(); syncInputs(currentVector);
          if (context && context.sourceStore) context.sourceStore.dispatch({type: "SET_PARAMETER", name: config.vectorParameter || "vector", value: currentVector.slice()});
          paintFallback();
        });
      });
      repaint = paintFallback;
      paintFallback();
      return {update: update};
    } else {
      renderShapes(node, config.shapes || []);
      return {update: function (nodeElement, nodeConfig, snapshot) {
        var bound = h.boundConfig(nodeElement, nodeConfig, snapshot);
        validateSpatial(bound); renderShapes(nodeElement, bound.shapes || []);
      }};
    }
  }

  var spatialAdapter = {validate: validateSpatial, render: renderSpatial};
  core.registerKind("spatial", spatialAdapter);

  if (kit.registerModule) {
    kit.registerModule("viz.kinds.spatial", {
      init: function () {
        return Promise.resolve();
      }
    });
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

  /* ---- Bundle Initialization ---- */
  if (CourseKit.initAll && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', CourseKit.initAll);
    } else {
      CourseKit.initAll();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
