const assert = require("node:assert/strict");
const {vectorImage, selectionSortTrace, validateConfig} = require("../learning-course/assets/visualizations/visualizations.js");

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
console.log("Algebra, trace invariants, counters, domain gaps and invalid-data checks passed");
