/*
 * Evidence-store invariants for assets/course-template/course.js.
 *
 * Runs the real runtime (learnkit.js + course.js) against a tiny DOM shim and
 * asserts that component state lives in one store and repaints through the
 * shared subscription, rather than drifting across DOM datasets.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* ---------------- Minimal DOM shim ---------------- */

function matches(el, rawSelector) {
  const selector = rawSelector.trim();
  if (selector.includes(",")) return selector.split(",").some((part) => matches(el, part));

  const notSel = selector.match(/:not\(([^)]+)\)/);
  if (notSel) return matches(el, selector.replace(/:not\([^)]+\)/, "")) && !matches(el, notSel[1]);

  const attrMatch = selector.match(/^([a-zA-Z.#]*)\[([^\]=]+)(~?=)?(?:(["']?)([^\]"']*)\4)?\]$/);
  if (attrMatch) {
    const [, , attr, op, , value] = attrMatch;
    const key = attr.trim();
    if (!(key in el.attrs)) return false;
    if (value === undefined) return true;
    if (op === "~=") return String(el.attrs[key]).split(/\s+/).includes(value);
    return String(el.attrs[key]) === value;
  }
  const tagOnly = selector.match(/^([a-zA-Z]+)$/);
  if (tagOnly) return el.tagName === tagOnly[1].toUpperCase();
  const classOnly = selector.match(/^\.([a-zA-Z0-9_-]+)$/);
  if (classOnly) return el.classList.contains(classOnly[1]);
  const idOnly = selector.match(/^#([a-zA-Z0-9_-]+)$/);
  if (idOnly) return el.id === idOnly[1];
  return false;
}

function makeElement(options = {}) {
  const el = {
    tagName: (options.tag || "div").toUpperCase(),
    attrs: {}, dataset: {}, style: {}, hidden: false, disabled: false, readOnly: false,
    id: options.id || "", className: "", children: [], listeners: {},
    textContent: options.text || "", value: options.value || "",
    classList: {
      set: new Set(options.classes || []),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); }
    },
    setAttribute(name, value) { this.attrs[name] = String(value); syncDataset(this); },
    getAttribute(name) { return this.attrs[name]; },
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
    replaceChildren() { this.children = []; },
    addEventListener(type, handler) { (this.listeners[type] = this.listeners[type] || []).push(handler); },
    fire(type) { (this.listeners[type] || []).slice().forEach((handler) => handler({})); },
    querySelector(selector) { return this.findAll(selector)[0] || null; },
    querySelectorAll(selector) { return this.findAll(selector); },
    findAll(selector) {
      const found = [];
      const walk = (node) => node.children.forEach((child) => {
        if (matches(child, selector)) found.push(child);
        walk(child);
      });
      walk(this);
      return found;
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (matches(node, selector)) return node;
        node = node.parentElement;
      }
      return null;
    }
  };
  if (options.classes) el.className = options.classes.join(" ");
  Object.assign(el.attrs, options.attrs || {});
  if (el.attrs.id) el.id = el.attrs.id;
  syncDataset(el);
  return el;
}

// A real DOM exposes data-* attributes through dataset; the shim must too.
function syncDataset(el) {
  Object.keys(el.attrs).forEach((name) => {
    if (!name.startsWith("data-")) return;
    const key = name.slice(5).replace(/-([a-z])/g, (match, ch) => ch.toUpperCase());
    el.dataset[key] = String(el.attrs[name]);
  });
}

/* ---------------- Harness ---------------- */

function boot() {
  const radioWrong = makeElement({ tag: "input", attrs: { type: "radio", "data-correct": "false" } });
  const radioRight = makeElement({ tag: "input", attrs: { type: "radio", "data-correct": "true" } });
  const feedback = makeElement({ classes: ["quiz-feedback"] });
  const submit = makeElement({ tag: "button", attrs: { "data-quiz-submit": "" } });
  const hint = makeElement({ tag: "button", attrs: { "data-hint": "", "aria-controls": "q1-hint" } });
  const hintBody = makeElement({ attrs: { id: "q1-hint" } });
  hintBody.hidden = true;

  const quiz = makeElement({
    classes: ["quiz"],
    attrs: {
      "data-question-id": "q1",
      "data-answer-kind": "standard",
      "data-correct-text": "正确。",
      "data-incorrect-text": "再检查条件。"
    }
  });
  [radioWrong, radioRight, hint, hintBody, submit, feedback].forEach((node) => quiz.appendChild(node));

  const lesson = makeElement({
    classes: ["lesson"],
    attrs: { "data-course-id": "c1", "data-lesson-id": "0001", "data-objective": "obj1" }
  });
  lesson.appendChild(quiz);

  const root = makeElement();
  root.appendChild(lesson);
  lesson.parentElement = root;

  globalThis.document = {
    readyState: "complete",
    documentElement: makeElement(),
    body: makeElement(),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    createElement: (tag) => makeElement({ tag }),
    getElementById: (id) => root.querySelector("#" + id),
    addEventListener: () => {}
  };
  globalThis.window = globalThis;
  globalThis.navigator = {};
  globalThis.location = { search: "" };
  globalThis.URLSearchParams = URLSearchParams;
  globalThis.addEventListener = () => {};

  const rootDir = path.resolve(__dirname, "..");
  eval(fs.readFileSync(path.join(rootDir, "learning-course/assets/learnkit/learnkit.js"), "utf8"));
  eval(fs.readFileSync(path.join(rootDir, "learning-course/assets/course-template/course.js"), "utf8"));

  return { lesson, quiz, feedback, submit, radioWrong, radioRight, hint, hintBody };
}

/* ---------------- Assertions ---------------- */

const { lesson, quiz, feedback, submit, radioWrong, radioRight, hint, hintBody } = boot();

const store = lesson.__evidenceStore;
assert.ok(store, "course.js must expose one evidence store on the lesson root");
assert.ok(store.getState().questions, "evidence store state is keyed by question id");

// Initial paint happens on load, before any interaction.
assert.equal(quiz.dataset.attempts, "0", "quiz attempts render on initial paint");

// A hint records both the hint and the observed assistance level.
hint.fire("click");
assert.equal(hintBody.hidden, false, "hint reveals its controlled region");
assert.equal(quiz.dataset.hintUsed, "true", "hint use renders into the question");
assert.equal(store.getState().questions.q1.observedAssistance, "with_hints",
  "hint records observed assistance in the store, not only the DOM");

// Attempts accumulate and the verdict lives in the store.
radioWrong.checked = true;
submit.fire("click");
assert.equal(quiz.dataset.attempts, "1");
assert.equal(feedback.dataset.state, "incorrect");
assert.equal(store.getState().questions.q1.verdict, "incorrect");

radioWrong.checked = false;
radioRight.checked = true;
submit.fire("click");
assert.equal(quiz.dataset.attempts, "2");
assert.equal(feedback.dataset.state, "correct");
assert.equal(store.getState().questions.q1.verdict, "correct");

// Submitting with nothing selected must not count as an attempt.
radioRight.checked = false;
submit.fire("click");
assert.equal(quiz.dataset.attempts, "2", "an empty submission is not an attempt");

// The store stays the single source of truth: DOM mirrors it, not the reverse.
const q1 = store.getState().questions.q1;
assert.equal(q1.attempts, 2);
assert.equal(q1.hintUsed, true);
assert.equal(q1.observedAssistance, "with_hints");

console.log("Evidence store invariants passed: single store, shared paint, hint and verdict tracking");
