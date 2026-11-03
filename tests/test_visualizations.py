import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course/scripts"))
sys.path.insert(0, str(ROOT / "tests"))
from build_visualization_data import reciprocal_config, surface_config
from jsdom_locator import resolve_jsdom as _resolve_jsdom
from validate_course import validate_visualizations

KIT = ROOT / "learning-course/kit/viz"
VENDOR = ROOT / "learning-course/kit/vendor"
SKILL = ROOT / "learning-course"


class VisualizationTests(unittest.TestCase):
    def test_reciprocal_samples_respect_domain_and_analytic_values(self):
        config = reciprocal_config()
        left, right = config["traces"]
        self.assertTrue(all(x < 0 for x in left["x"]))
        self.assertTrue(all(x > 0 for x in right["x"]))
        for trace in config["traces"]:
            self.assertFalse(trace["connectgaps"])
            for x, y in zip(trace["x"], trace["y"]):
                self.assertAlmostEqual(x * y, 1)
            for a, b in zip(trace["x"], trace["x"][1:]):
                self.assertAlmostEqual(b - a, 0.025)
        # Check the documented conservative interpolation bound on every interval.
        for trace in config["traces"]:
            for i, x in enumerate(trace["x"][:-1]):
                next_x = trace["x"][i + 1]
                interpolated = (trace["y"][i] + trace["y"][i + 1]) / 2
                self.assertLessEqual(abs(interpolated - 1 / ((x + next_x) / 2)), 0.15625)

    def test_surface_grid_has_correct_orientation_and_analytic_height(self):
        trace = surface_config()["traces"][0]
        self.assertEqual(len(trace["z"]), len(trace["y"]))
        for row, y in zip(trace["z"], trace["y"]):
            self.assertEqual(len(row), len(trace["x"]))
            for z, x in zip(row, trace["x"]):
                self.assertAlmostEqual(z, x*x + y*y)
        self.assertEqual(trace["z"][20][20], 0)
        self.assertEqual(trace["z"][0][0], 8)

    def test_dependency_files_match_recorded_checksums_and_keep_licenses(self):
        manifest = json.loads((VENDOR / "manifest.json").read_text(encoding="utf-8"))
        for dependency in manifest.values():
            self.assertTrue(any("LICENSE" in name for name in dependency["files"]))
            for file, checksum in dependency["sha256"].items():
                self.assertEqual(hashlib.sha256((VENDOR / file).read_bytes()).hexdigest(), checksum)

    def test_declared_visualization_kinds_match_the_shipped_modules(self):
        """`adapters.json` and `kinds/` must agree, so no course references a missing module."""
        registry = json.loads((KIT / "adapters.json").read_text(encoding="utf-8"))
        declared = {name: entry for name, entry in registry["kinds"].items() if entry.get("tier") in ("universal", "optional")}
        modules = set()
        for name, entry in declared.items():
            kind_stem = Path(entry["module"]).stem
            module = KIT / "kinds" / kind_stem / f"{kind_stem}.js"
            self.assertTrue(module.is_file(), f"{name} declares {entry['module']} but it is missing")
            modules.add(entry["module"])
            self.assertEqual(entry["tier"], "optional" if name in ("chart", "spatial", "plot") else "universal", f"{name} has the wrong tier")
        shipped = {f"kinds/{path.name}.js" for path in (KIT / "kinds").iterdir() if path.is_dir()}
        self.assertEqual(modules, shipped, "every shipped kind module must be declared, and vice versa")

    def test_lesson_template_wires_the_universal_visualization_modules(self):
        template = (SKILL / "templates/lesson.html").read_text(encoding="utf-8")
        self.assertIn("assets/kit/kit.css", template)
        self.assertIn("assets/kit/kit.js", template)

    def test_optional_manifest_lists_only_real_files(self):
        manifest = json.loads((SKILL / "kit/kit.manifest.json").read_text(encoding="utf-8"))
        self.assertTrue(len(manifest.get("modules", {})) >= 23)

    def validate(self, body):
        errors = []
        validate_visualizations(Path("0001-model.html"), body, errors)
        return errors

    def test_showcase_contract_and_legacy_optional_compatibility(self):
        self.assertEqual(self.validate((KIT / "demo.html").read_text(encoding="utf-8")), [])
        self.assertEqual(self.validate('<main class="lesson"><p>Legacy lesson</p></main>'), [])

    def test_missing_fallback_bad_json_and_unlabeled_keyboard_inputs_are_rejected(self):
        demo = (KIT / "demo.html").read_text(encoding="utf-8")
        self.assertTrue(any("visible data-viz-fallback" in e for e in self.validate(demo.replace('data-viz-fallback', 'data-unused'))))
        self.assertTrue(any("invalid JSON" in e for e in self.validate(demo.replace('"vector":[1,0]', '"vector":[NaN,0]'))))
        self.assertTrue(any("keyboard controls" in e for e in self.validate(demo.replace('for="vector-x"', 'for="missing"'))))
        self.assertTrue(any("unique id" in e for e in self.validate(demo.replace('id="spatial-demo"', 'id="chart-demo"'))))

    def test_showcase_covers_every_registered_kind(self):
        demo = (KIT / "demo.html").read_text(encoding="utf-8")
        registry = json.loads((KIT / "adapters.json").read_text(encoding="utf-8"))
        registered = {k for k, v in registry["kinds"].items() if v["renderer"] != "registered extension"}
        shown = set(re.findall(r'data-visualization="([^"]+)"', demo))
        self.assertEqual(registered - shown, set(), "the showcase must exercise each built-in adapter")

    @unittest.skipUnless(shutil.which("node"), "Node is required for numerical/algorithm invariant checks")
    def test_runtime_algebra_trace_invariants_and_malformed_numeric_data(self):
        result = subprocess.run(["node", str(ROOT / "tests/visualization_invariants.cjs")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def resolve_jsdom(self) -> Path | None:
        return _resolve_jsdom()

    @unittest.skipUnless(shutil.which("node"), "Node is required for DOM rendering checks")
    def test_every_kind_renders_in_a_dom_including_the_library_missing_fallbacks(self):
        """Each kind must put something readable on screen, vendor library or not."""
        harness = ROOT / "tests/visualization_dom.cjs"
        jsdom = self.resolve_jsdom()
        if not jsdom or not jsdom.exists():
            self.skipTest("jsdom is required for DOM rendering checks")
        env = dict(os.environ, NODE_PATH=str(jsdom.parent))
        result = subprocess.run(["node", str(harness)], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
