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
from build_visualization_data import reciprocal_config, surface_config
from install_optional import InstallError, install
from validate_course import validate_visualizations

KIT = ROOT / "learning-course/assets/visualizations"
HLJS_VERSION = "11.12.0"
HLJS_URL = f"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@{HLJS_VERSION}/build/highlight.min.js"


def fetch_highlight_engine() -> Path | None:
    """Return the pinned highlight.js build, downloading it into tests/.cache once.

    The engine is a large vendor artifact and stays out of the repository, so the
    test fetches it on first use and reuses the cache afterwards. Returning None
    (rather than raising) lets the caller skip when there is no network.
    """
    cache = ROOT / "tests/.cache"
    engine = cache / f"hljs-{HLJS_VERSION}.min.js"
    if engine.is_file():
        return engine
    try:
        import urllib.request

        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(HLJS_URL, timeout=30) as response:
            engine.write_bytes(response.read())
    except Exception:
        return None
    return engine if engine.is_file() else None


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

    def test_sequence_only_install_is_offline_lightweight_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "course.yaml").write_text("schema_version: 3\n")
            notices = install(root, ["sequence"])
            target = root / "assets/visualizations"
            self.assertTrue((target / "visualizations.js").is_file())
            self.assertFalse((target / "vendor/plotly.js-dist-min").exists())
            self.assertEqual(json.loads((target / "vendor/manifest.json").read_text()), {})
            # Notices are human-readable, so match by substring.
            self.assertTrue(any("sequence" in notice for notice in notices))
            with self.assertRaises(InstallError):
                install(root, ["sequence"])
            self.assertFalse((target / "vendor/plotly.js-dist-min").exists())
            install(root, ["chart", "spatial"], force=True)
            self.assertTrue((target / "vendor/jsxgraph/jsxgraphcore.js").is_file())

    def test_unknown_and_legacy_component_names_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "course.yaml").write_text("schema_version: 3\n")
            for name in ("plot", "geometry", "algorithm", "chart-ish"):
                with self.assertRaises(InstallError):
                    install(root, [name])

    def test_self_contained_components_install_without_vendor_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "course.yaml").write_text("schema_version: 3\n")
            install(root, ["code-highlight", "theme"])
            highlight = root / "assets/optional/code-highlight"
            theme = root / "assets/optional/theme"
            self.assertTrue((highlight / "code-highlight.js").is_file())
            self.assertTrue((highlight / "code-highlight.css").is_file())
            self.assertTrue((theme / "theme.js").is_file())
            self.assertTrue((theme / "theme.css").is_file())
            # No visualization kit and no vendor tree should be pulled in.
            self.assertFalse((root / "assets/visualizations").exists())
            # A partial install must not happen: the refusal comes before any copy.
            with self.assertRaises(InstallError):
                install(root, ["theme", "chart"])

    def test_optional_manifest_lists_only_real_files(self):
        registry = json.loads((KIT.parent / "optional/manifest.json").read_text())
        for name, entry in registry["components"].items():
            if name in ("chart", "spatial"):
                continue  # these reuse the visualization kit, checked above
            for relative in entry["files"]:
                self.assertTrue((KIT.parent / "optional" / relative).is_file(), f"{name} -> {relative}")
            self.assertTrue((KIT.parent / "optional" / entry["docs"]).is_file(), f"{name} docs")

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
        self.assertTrue(any("invalid JSON" in e for e in self.validate(demo.replace('"vector":[1,0]', '"vector":[NaN,0]'))))
        self.assertTrue(any("keyboard controls" in e for e in self.validate(demo.replace('for="vector-x"', 'for="missing"'))))
        self.assertTrue(any("unique id" in e for e in self.validate(demo.replace('id="spatial-demo"', 'id="chart-demo"'))))

    def test_showcase_covers_every_registered_kind(self):
        demo = (KIT / "demo.html").read_text()
        registry = json.loads((KIT / "adapters.json").read_text())
        registered = {k for k, v in registry["kinds"].items() if v["renderer"] != "registered extension"}
        shown = set(re.findall(r'data-visualization="([^"]+)"', demo))
        self.assertEqual(registered - shown, set(), "the showcase must exercise each built-in adapter")

    @unittest.skipUnless(shutil.which("node"), "Node is required for numerical/algorithm invariant checks")
    def test_runtime_algebra_trace_invariants_and_malformed_numeric_data(self):
        result = subprocess.run(["node", str(ROOT / "tests/visualization_invariants.cjs")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    @unittest.skipUnless(shutil.which("node"), "Node is required for DOM behaviour checks")
    def test_optional_components_behave_in_a_real_dom(self):
        """code-highlight and theme are exercised against a real DOM.

        The harness needs jsdom (managed node workspace) and the pinned
        highlight.js build. The engine is fetched into tests/.cache/ when missing
        and is never committed; when it cannot be fetched the test skips rather
        than fails, so an offline checkout still runs the rest of the suite.
        """
        harness = ROOT / "tests/optional_components.cjs"
        jsdom = Path("C:/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom")
        if not jsdom.exists():
            self.skipTest("jsdom is required for DOM behaviour checks")
        engine = fetch_highlight_engine()
        if engine is None:
            self.skipTest("highlight.js engine unavailable (no network and no cache)")
        env = dict(os.environ, NODE_PATH=str(jsdom.parent), HLJS_ENGINE_PATH=str(engine))
        result = subprocess.run(["node", str(harness)], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
