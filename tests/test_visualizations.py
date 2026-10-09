import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course/scripts"))
from build_visualization_data import reciprocal_config, surface_config
from install_visualizations import install
from validate_course import validate_visualizations

KIT = ROOT / "learning-course/assets/visualizations"


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
        manifest = json.loads((KIT / "vendor/manifest.json").read_text())
        for dependency in manifest.values():
            self.assertTrue(any("LICENSE" in name for name in dependency["files"]))
            for file, checksum in dependency["sha256"].items():
                self.assertEqual(hashlib.sha256((KIT / "vendor" / file).read_bytes()).hexdigest(), checksum)

    def test_algorithm_only_install_is_offline_lightweight_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "course.yaml").write_text("schema_version: 3\n")
            target = install(root, ["algorithm"])
            self.assertTrue((target / "visualizations.js").is_file())
            self.assertFalse((target / "vendor/plotly.js-dist-min").exists())
            self.assertEqual(json.loads((target / "vendor/manifest.json").read_text()), {})
            with self.assertRaises(FileExistsError):
                install(root, ["plot"])
            self.assertFalse((target / "vendor/plotly.js-dist-min").exists())
            install(root, ["plot", "geometry"], force=True)
            self.assertTrue((target / "vendor/jsxgraph/jsxgraphcore.js").is_file())

    def validate(self, body):
        errors = []
        validate_visualizations(Path("0001-model.html"), body, errors)
        return errors

    def test_showcase_contract_and_legacy_optional_compatibility(self):
        self.assertEqual(self.validate((KIT / "demo.html").read_text()), [])
        self.assertEqual(self.validate('<main class="lesson"><p>Legacy lesson</p></main>'), [])

    def test_missing_fallback_bad_json_and_unlabeled_keyboard_inputs_are_rejected(self):
        demo = (KIT / "demo.html").read_text()
        self.assertTrue(any("visible data-viz-fallback" in e for e in self.validate(demo.replace('data-viz-fallback', 'data-unused'))))
        self.assertTrue(any("invalid JSON" in e for e in self.validate(demo.replace('"matrix": [[1, 1]', '"matrix": [[NaN, 1]'))))
        self.assertTrue(any("keyboard controls" in e for e in self.validate(demo.replace('for="vector-x"', 'for="missing"'))))
        self.assertTrue(any("unique id" in e for e in self.validate(demo.replace('id="surface"', 'id="reciprocal"'))))

    @unittest.skipUnless(shutil.which("node"), "Node is required for numerical/algorithm invariant checks")
    def test_runtime_algebra_trace_invariants_and_malformed_numeric_data(self):
        result = subprocess.run(["node", str(ROOT / "tests/visualization_invariants.cjs")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
