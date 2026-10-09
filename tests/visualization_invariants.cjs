const assert = require("node:assert/strict");
const path = require("node:path");

const KIT = "../learning-course/assets/visualizations";
const core = require(`${KIT}/visualizations.js`);

// The kit is a core plus one module per kind. Under Node there is no `window`,
// so the core exports its API instead of installing it on a global; wire the
// same global a browser would create, then load the modules the way a course
// page does. `document` is stubbed because the modules only touch it at render
// time, which these invariants never reach.
globalThis.CourseVisualizations = core;
globalThis.document = {
  createElement: () => ({setAttribute() {}, appendChild() {}, addEventListener() {}, classList: {add() {}}, dataset: {}, style: {}}),
  createElementNS: () => ({setAttribute() {}, appendChild() {}})
};
for (const module of ["list", "sequence", "table"]) require(path.join(__dirname, KIT, "kinds", `${module}.js`));

assert.deepEqual(core.loaded(), ["process", "relation", "sequence", "table", "timeline"], "the universal tier registers exactly the library-free kinds");
for (const optional of ["chart", "spatial"]) {
  assert.throws(() => core.validateConfig(optional, {model: "m", domain: "d", precision: "p"}), /未知可视化类型/, `${optional} must not be registered until its module is loaded`);
}
for (const module of ["chart", "spatial"]) require(path.join(__dirname, KIT, "kinds", `${module}.js`));
assert.deepEqual(core.loaded(), ["chart", "process", "relation", "sequence", "spatial", "table", "timeline"], "loading the optional modules completes the registry");

const {vectorImage, selectionSortTrace, validateConfig} = core;

// Verify algebraic relations with independent expected results, including singular projections.
assert.deepEqual(vectorImage([[1, 1], [0, 1]], [-2, 3]), [1, 3]);
assert.deepEqual(vectorImage([[0, -1], [1, 0]], [2, 3]), [-3, 2]);
assert.deepEqual(vectorImage([[1, 0], [0, 0]], [2, 3]), [2, 0]);
const sort = xs => xs.slice().sort((a, b) => a - b);
for (const input of [[5, 1, 4, 2, 3], [1, 1, 1], [-3, 0, -7, 4], [2, 1], [0.5, -0.25, 0.5]]) {
  const trace = selectionSortTrace(input), ordered = sort(input);
  for (const state of trace) {
    assert.deepEqual(sort(state.values), ordered, "array multiset is preserved after every operation");
    assert.deepEqual(state.values.slice(0, state.sorted), ordered.slice(0, state.sorted), "fixed prefix is correct");
  }
  const final = trace.at(-1);
  assert.deepEqual(final.values, ordered);
  assert.equal(final.comparisons, input.length * (input.length - 1) / 2);
  assert.ok(final.swaps <= input.length - 1);
  assert.deepEqual(input, trace[0].values, "input must not be mutated");
}
assert.equal(selectionSortTrace([5, 1, 4, 2, 3]).at(-1).swaps, 4);
assert.equal(selectionSortTrace([1, 2, 3]).at(-1).swaps, 0);
assert.throws(() => selectionSortTrace([1, NaN]));
assert.throws(() => selectionSortTrace([Infinity, 2]));
assert.throws(() => selectionSortTrace([1]));
const base = {model: "y=x", domain: "[-1,1]", precision: "binary64"};
// Rejects shape mismatches, non-finite values, wrong grid dimensions and
// unknown kinds; `null` is a deliberate data gap, not an error.
assert.throws(() => validateConfig("chart", {...base, traces: [{type: "scatter", x: [0, 1], y: [0]}]}));
assert.throws(() => validateConfig("chart", {...base, traces: [{type: "scatter", x: [0, 1], y: [0, Infinity]}]}));
assert.throws(() => validateConfig("chart", {...base, traces: [{type: "scatter", x: [0, 1], y: [0, "1"]}]}));
assert.throws(() => validateConfig("chart", {...base, traces: [{type: "surface", x: [0, 1], y: [0, 1], z: [[0, 1]]}]}));
assert.throws(() => validateConfig("chart", {...base, traces: [{type: "radar", x: [0, 1], y: [0, 1]}]}));
assert.throws(() => validateConfig("plot", {...base, traces: [{type: "scatter", x: [0, 1], y: [0, 1]}]}));
assert.throws(() => validateConfig("spatial", {...base, matrix: [[1, 0], [0, NaN]], vector: [0, 1]}));
assert.throws(() => validateConfig("spatial", {...base, matrix: [[1e308, 1e308], [0, 1]], vector: [2, 2]}));
validateConfig("chart", {...base, traces: [{type: "scatter", x: [0, 1, 2], y: [0, null, 2]}]});
console.log("Module registry, algebra, trace invariants, counters, domain gaps and invalid-data checks passed");
