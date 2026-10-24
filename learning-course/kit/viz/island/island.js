/*
 * viz.island — 免构建交互仿真孤岛 (Island Component)
 *
 * 底层直接挂在 LearnKit store 上（时间旅行 / 播放控制 / 速度调节全部复用）。
 * 作者在 <script type="text/plain" data-island-model> 内编写模型与视图，
 * 由孤岛运行时编译执行（与页面脚本同一信任级）：
 *
 *   <kit-island id="pendulum" data-island>
 *     <div data-viz-fallback><p>无脚本文字说明（必须存在且可见）</p></div>
 *     <div data-island-host hidden></div>
 *     <div data-island-controls hidden></div>
 *     <script type="text/plain" data-island-model>
 *       kit.island.define("pendulum", {
 *         initialState: () => ({ t: 0, theta: 0.5, omega: 0 }),
 *         tick: (s) => ({ ...s, t: s.t + 0.05, theta: ..., omega: ... }),
 *         actions: { push: { label: "推一下", reduce: (s) => ({...s, omega: s.omega + 0.8}) } },
 *         derive: (s) => ({ summary: "t=" + s.t }),
 *         view: (s, api) => api.html`<p>t = ${s.t}</p>`
 *       });
 *     </script>
 *   </kit-island>
 *
 * 契约：tick/reduce 必须返回新状态对象（不可原地修改）；view 返回 HTML 字符串，
 * 插值默认转义，需要原始 HTML 时用 api.raw()；[data-viz-fallback] 保证无脚本可读。
 */
(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;
  var LearnKit = root.LearnKit || kit.store;

  var defs = {};
  var mounted = [];

  function escapeHtml(value) {
    if (value == null) return "";
    if (value && value.__kitRaw) return String(value.value);
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function html(strings) {
    var values = Array.prototype.slice.call(arguments, 1);
    var out = "";
    for (var i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i < values.length) out += escapeHtml(values[i]);
    }
    return out;
  }

  function raw(text) {
    return { __kitRaw: true, value: String(text == null ? "" : text) };
  }

  function fmt(value, digits) {
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toFixed(digits == null ? 2 : digits);
  }

  function define(name, spec) {
    if (!name || !spec || typeof spec.initialState !== "function") {
      throw new Error('kit.island.define("' + name + '") 需要 name 与 initialState()');
    }
    defs[name] = spec;
    mounted.forEach(function (entry) {
      if (!entry.store && entry.name === name) mountNode(entry.node, spec);
    });
    return spec;
  }

  function buildModel(def) {
    return {
      initialState: function () {
        var state = def.initialState();
        if (state == null || typeof state !== "object") {
          throw new Error("island " + (def.name || "") + " initialState() 必须返回状态对象");
        }
        return state;
      },
      reduce: function (state, action) {
        if (action.type === "STEP_NEXT") {
          return typeof def.tick === "function" ? (def.tick(state) || state) : state;
        }
        if (action.type === "RESET") return def.initialState();
        var custom = def.actions && def.actions[action.type];
        if (custom && typeof custom.reduce === "function") {
          return custom.reduce(state, action) || state;
        }
        return state;
      },
      derive: function (state) {
        var derived = { atEnd: false };
        if (typeof def.derive === "function") {
          try {
            var extra = def.derive(state);
            if (extra && typeof extra === "object") Object.keys(extra).forEach(function (key) {
              derived[key] = extra[key];
            });
          } catch (error) { /* derive 失败不影响渲染 */ }
        }
        return derived;
      },
      describe: def.describe
    };
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMathIn(node) {
    if (!node || !root.renderMathInElement) return;
    try {
      root.renderMathInElement(node, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (error) { /* 公式失败不阻断渲染 */ }
  }

  function mountNode(node, def) {
    if (node.dataset.islandMounted === "true") return;
    if (!LearnKit || !LearnKit.createStore) throw new Error("island 需要 LearnKit store 运行时");
    def.name = def.name || node.id || "island";

    var fallback = node.querySelector("[data-viz-fallback]");
    var host = node.querySelector("[data-island-host]");
    var controls = node.querySelector("[data-island-controls]");
    var status = node.querySelector("[data-island-status]");
    if (!host) throw new Error("island 需要 <div data-island-host> 挂载点");
    host.hidden = false;
    if (fallback) fallback.hidden = true;
    if (controls) {
      controls.hidden = false;
      controls.innerHTML = "";
      controls.appendChild(buildControls());
    }

    var interval = Number(node.dataset.islandInterval);
    var store = LearnKit.createStore(buildModel(def), {
      baseInterval: isFinite(interval) && interval >= 30 ? interval : 300
    });

    function draw(snapshot) {
      var state = snapshot.state;
      host.innerHTML = typeof def.view === "function"
        ? String(def.view(state, { html: html, raw: raw, fmt: fmt }))
        : "<p>" + escapeHtml(snapshot.derived.summary || "") + "</p>";
      renderMathIn(host);
      if (status) status.textContent = snapshot.derived.summary || "";
      node.dataset.visualState = JSON.stringify({
        mode: "island",
        name: def.name,
        cursor: snapshot.cursor,
        length: snapshot.length,
        playing: store.isPlaying(),
        summary: snapshot.derived.summary || ""
      });
      refreshControls(snapshot);
    }

    function refreshControls(snapshot) {
      var scope = controls || node;
      var prev = scope.querySelector("[data-island-action='STEP_PREVIOUS']");
      var next = scope.querySelector("[data-island-action='STEP_NEXT']");
      var play = scope.querySelector("[data-island-action='PLAY']");
      var pause = scope.querySelector("[data-island-action='PAUSE']");
      var seek = scope.querySelector("input[data-island-seek]");
      if (prev) prev.disabled = snapshot.cursor === 0;
      if (next) next.disabled = snapshot.cursor < snapshot.length - 1;
      if (play) play.disabled = store.isPlaying();
      if (pause) pause.disabled = !store.isPlaying();
      if (seek) {
        seek.max = String(Math.max(0, snapshot.length - 1));
        seek.value = String(snapshot.cursor);
      }
    }

    function buildControls() {
      var bar = el("div", "kit-island__controls");
      [
        ["STEP_PREVIOUS", "◀ 后退"],
        ["PLAY", "▶ 播放"],
        ["PAUSE", "⏸ 暂停"],
        ["STEP_NEXT", "▶| 前进"],
        ["RESET", "⏮ 重置"]
      ].forEach(function (pair) {
        var btn = el("button", "kit-island__btn", pair[1]);
        btn.type = "button";
        btn.dataset.islandAction = pair[0];
        bar.appendChild(btn);
      });
      var speed = el("select", "kit-island__speed");
      speed.setAttribute("aria-label", "播放速度");
      [["0.5", "0.5×"], ["1", "1×"], ["2", "2×"], ["4", "4×"]].forEach(function (pair) {
        var opt = el("option", null, pair[1]);
        opt.value = pair[0];
        speed.appendChild(opt);
      });
      speed.value = "1";
      speed.addEventListener("change", function () { store.setSpeed(Number(speed.value)); });
      bar.appendChild(speed);
      var seek = el("input");
      seek.type = "range";
      seek.min = "0";
      seek.max = "0";
      seek.value = "0";
      seek.dataset.islandSeek = "true";
      seek.setAttribute("aria-label", "时间旅行滑块");
      bar.appendChild(seek);
      Object.keys(def.actions || {}).forEach(function (actionType) {
        var action = def.actions[actionType] || {};
        var btn = el("button", "kit-island__btn kit-island__btn--action", action.label || actionType);
        btn.type = "button";
        btn.dataset.islandAction = actionType;
        bar.appendChild(btn);
      });
      return bar;
    }

    (controls || node).addEventListener("click", function (event) {
      var btn = event.target && event.target.closest && event.target.closest("[data-island-action]");
      if (!btn) return;
      store.dispatch({ type: btn.dataset.islandAction });
    });
    (controls || node).addEventListener("input", function (event) {
      if (event.target && event.target.matches && event.target.matches("input[data-island-seek]")) {
        store.dispatch({ type: "SEEK", index: Number(event.target.value) });
      }
    });

    store.subscribe(draw);
    draw(store.snapshot());
    node.dataset.islandMounted = "true";
    node.dataset.islandReady = "true";
    node.__islandStore = store;
    node.__islandDef = def;
    mounted.push({ name: def.name, node: node, store: store });
    return store;
  }

  function compileModelScript(code) {
    var factory = new Function("kit", "\"use strict\";\n" + code);
    factory(kit);
  }

  function init() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("kit-island, [data-island]").forEach(function (node) {
      if (node.dataset.islandMounted === "true") return;
      try {
        var script = node.querySelector("script[type='text/plain'][data-island-model]");
        var name = node.dataset.islandName || node.id;
        if (script && !node.dataset.islandCompiled) {
          node.dataset.islandCompiled = "true";
          compileModelScript(script.textContent);
        }
        var def = (name && defs[name]) || null;
        if (!def && script) {
          var names = Object.keys(defs);
          if (names.length === 1) def = defs[names[0]];
        }
        if (!def) throw new Error("island 缺少 kit.island.define 定义");
        mountNode(node, def);
      } catch (error) {
        node.dataset.islandReady = "failed";
        var fallback = node.querySelector("[data-viz-fallback]");
        var status = node.querySelector("[data-island-status]");
        if (status) status.textContent = "孤岛初始化失败：" + error.message;
        if (fallback) fallback.hidden = false;
        console.error("[kit] island init failed:", error);
      }
    });
  }

  kit.island = { define: define, html: html, raw: raw, fmt: fmt, init: init, defs: defs };
  if (kit.registerModule) kit.registerModule("viz.island", kit.island);
  if (!kit.registerModule && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
