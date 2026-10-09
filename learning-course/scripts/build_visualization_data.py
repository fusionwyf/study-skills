#!/usr/bin/env python3
"""Generate reproducible example plot data without evaluating user expressions."""

import argparse
import json


def reciprocal_config() -> dict:
    # Two separate traces cannot accidentally draw through the singularity at zero.
    negative = [-4 + i / 40 for i in range(157)]
    positive = [0.1 + i / 40 for i in range(157)]
    return {
        "model": "f(x) = 1/x", "domain": "[-4, -0.1] ∪ [0.1, 4]; x = 0 is undefined",
        "precision": "binary64 samples; step 0.025; linear interpolation error ≤ 0.15625 on these intervals",
        "traces": [{"type": "scatter", "mode": "lines", "name": name,
                    "x": xs, "y": [1 / x for x in xs], "connectgaps": False}
                   for name, xs in (("x < 0", negative), ("x > 0", positive))],
        "layout": {"title": {"text": "f(x) = 1/x; exclude x = 0"},
                   "xaxis": {"title": {"text": "x"}, "range": [-4, 4]},
                   "yaxis": {"title": {"text": "1/x"}, "range": [-10, 10]}},
    }


def surface_config() -> dict:
    xs = [-2 + i / 10 for i in range(41)]
    return {
        "model": "z = x² + y²", "domain": "x, y ∈ [-2, 2]",
        "precision": "binary64 samples; grid step 0.1; sampled mesh approximation, not an exact continuous surface",
        "traces": [{"type": "surface", "x": xs, "y": xs,
                    "z": [[x * x + y * y for x in xs] for y in xs], "colorscale": "Viridis"}],
        "layout": {"title": {"text": "z = x² + y²"}, "scene": {
            "xaxis": {"title": {"text": "x"}}, "yaxis": {"title": {"text": "y"}},
            "zaxis": {"title": {"text": "z"}}, "aspectmode": "data"}},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("preset", choices=("reciprocal", "surface"))
    parser.add_argument("--output", type=argparse.FileType("w", encoding="utf-8"), default="-")
    args = parser.parse_args()
    config = reciprocal_config() if args.preset == "reciprocal" else surface_config()
    json.dump(config, args.output, ensure_ascii=False, allow_nan=False, indent=2)
    args.output.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
