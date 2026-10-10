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
SKILL = ROOT / "learning-course"
EXAMPLE = SKILL / "assets/example-course"
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

    def test_universal_kinds_are_supplied_by_init_while_optional_ones_install(self):
        """The two tiers are the contract: universal comes free, optional is asked for."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            install_course = subprocess.run(
                [sys.executable, "-X", "utf8", str(ROOT / "learning-course/scripts/init_course.py"),
                 "--course-dir", str(root), "--title", "t", "--goal", "g"],
                capture_output=True, text=True,
            )
            self.assertEqual(install_course.returncode, 0, install_course.stdout + install_course.stderr)
            target = root / "assets/visualizations"
            # The default package already renders the library-free kinds.
            for name in ("visualizations.js", "visualizations.css", "adapters.json",
                         "kinds/list.js", "kinds/sequence.js", "kinds/table.js"):
                self.assertTrue((target / name).is_file(), f"init_course.py must ship {name}")
            self.assertTrue((root / "assets/asset-manifest.json").is_file())
            # ...and carries no vendor library, so a plain course stays offline.
            self.assertFalse((target / "vendor").exists())
            self.assertFalse((target / "kinds/chart.js").exists())

            # Installing an optional kind adds only that module plus its vendor tree.
            notices = install(root, ["chart"])
            self.assertTrue((target / "kinds/chart.js").is_file())
            self.assertFalse((target / "kinds/spatial.js").exists())
            self.assertTrue((target / "vendor/plotly.js-dist-min/plotly.min.js").is_file())
            self.assertFalse((target / "vendor/jsxgraph").exists())
            self.assertEqual(sorted(json.loads((target / "vendor/manifest.json").read_text())), ["chart"])
            self.assertTrue(any("chart" in notice for notice in notices))

            # Optional installs are composable and preserve the first vendor lock.
            install(root, ["spatial"])
            self.assertTrue((target / "kinds/spatial.js").is_file())
            self.assertTrue((target / "vendor/jsxgraph/jsxgraphcore.js").is_file())
            self.assertEqual(sorted(json.loads((target / "vendor/manifest.json").read_text())), ["chart", "spatial"])
            asset_manifest = json.loads((root / "assets/asset-manifest.json").read_text())
            self.assertEqual(sorted(asset_manifest["visualizations"]["optional_kinds"]), ["chart", "spatial"])

    def test_universal_kind_names_installed_directly_report_instead_of_copying(self):
        """A course asking for a universal kind gets a notice, not a second copy."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "course.yaml").write_text("schema_version: 3\n")
            notices = install(root, ["relation", "timeline", "process", "sequence", "table"])
            self.assertEqual(len(notices), 5)
            for notice in notices:
                self.assertIn("通用 kind", notice)
            # Nothing was written: the universal tier is init_course.py's job.
            self.assertFalse((root / "assets/visualizations").exists())

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
            # Repeating a component and adding a visualization is safe and recorded.
            install(root, ["theme", "chart"])
            self.assertTrue((root / "assets/visualizations/kinds/chart.js").is_file())
            asset_manifest = json.loads((root / "assets/asset-manifest.json").read_text())
            self.assertEqual(asset_manifest["components"], ["code-highlight", "theme"])
            self.assertEqual(asset_manifest["visualizations"]["optional_kinds"], ["chart"])

    def test_declared_visualization_kinds_match_the_shipped_modules(self):
        """`adapters.json` and `kinds/` must agree, so no course references a missing module."""
        registry = json.loads((KIT / "adapters.json").read_text())
        declared = {name: entry for name, entry in registry["kinds"].items() if entry.get("tier") in ("universal", "optional")}
        modules = set()
        for name, entry in declared.items():
            module = KIT / entry["module"]
            self.assertTrue(module.is_file(), f"{name} declares {entry['module']} but it is missing")
            modules.add(entry["module"])
            self.assertEqual(entry["tier"], "optional" if name in ("chart", "spatial") else "universal", f"{name} has the wrong tier")
        shipped = {f"kinds/{path.name}" for path in (KIT / "kinds").glob("*.js")}
        self.assertEqual(modules, shipped, "every shipped kind module must be declared, and vice versa")

    def test_example_course_assets_are_byte_identical_to_their_sources(self):
        """`assets/example-course/` is a smoke test; silent drift makes it lie."""
        sources = {
            "course.css": SKILL / "assets/course-template/course.css",
            "course.js": SKILL / "assets/course-template/course.js",
            "theme.css": SKILL / "assets/course-template/theme.css",
            "theme.js": SKILL / "assets/course-template/theme.js",
            "catalog.json": SKILL / "assets/catalog.json",
            "learnkit/components.json": SKILL / "assets/learnkit/components.json",
            "learnkit/learnkit.js": SKILL / "assets/learnkit/learnkit.js",
            "learnkit/lesson-spec.schema.json": SKILL / "assets/learnkit/lesson-spec.schema.json",
            "visualizations/visualizations.js": KIT / "visualizations.js",
            "visualizations/visualizations.css": KIT / "visualizations.css",
            "visualizations/adapters.json": KIT / "adapters.json",
            "visualizations/kinds/list.js": KIT / "kinds/list.js",
            "visualizations/kinds/sequence.js": KIT / "kinds/sequence.js",
            "visualizations/kinds/table.js": KIT / "kinds/table.js",
        }
        for relative, source in sources.items():
            self.assertTrue((EXAMPLE / "assets" / relative).is_file(), f"example-course is missing {relative}")
            self.assertEqual((EXAMPLE / "assets" / relative).read_bytes(), source.read_bytes(),
                             f"example-course/assets/{relative} drifted from its source")
        state = json.loads((EXAMPLE / "assets/asset-manifest.json").read_text())
        self.assertEqual(state["components"], ["code-highlight", "theme"])

    def test_example_lesson_loads_the_universal_visualization_modules(self):
        """The P0 regression: a lesson template that never loads the kit renders nothing."""
        lesson = (EXAMPLE / "lessons/0001-example.html").read_text()
        for name in ("visualizations.js", "kinds/list.js", "kinds/sequence.js", "kinds/table.js"):
            self.assertIn(f"visualizations/{name}", lesson, f"the example lesson must load {name}")

    def test_lesson_template_wires_the_universal_visualization_modules(self):
        template = (SKILL / "assets/course-template/lesson.html").read_text()
        self.assertIn("visualizations/visualizations.css", template)
        for name in ("visualizations.js", "kinds/list.js", "kinds/sequence.js", "kinds/table.js"):
            self.assertIn(f"visualizations/{name}", template, f"the lesson template must load {name}")
        # Optional kinds must stay out until a course installs them.
        for name in ("kinds/chart.js", "kinds/spatial.js"):
            self.assertNotIn(name, template, f"the default template must not reference {name}")

    def test_course_validator_uses_course_assets_and_installed_optional_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            created = subprocess.run(
                [sys.executable, "-X", "utf8", str(ROOT / "learning-course/scripts/init_course.py"),
                 "--course-dir", str(root), "--title", "t", "--goal", "g"],
                capture_output=True, text=True,
            )
            self.assertEqual(created.returncode, 0, created.stdout + created.stderr)
            lesson = root / "lessons/0001-model.html"
            body = '''<link rel="stylesheet" href="../assets/visualizations/visualizations.css">
<section id="v" data-visualization="chart"><div data-viz-fallback>fallback</div>
<div id="h" data-viz-host hidden></div><p data-viz-status role="status"></p>
<script type="application/json" data-viz-config>{"model":"m","domain":"d","precision":"p","traces":[{"x":[0],"y":[0]}]}</script></section>'''
            lesson.write_text(body, encoding="utf-8")
            errors = []
            validate_visualizations(lesson, body, errors)
            self.assertTrue(any("implementation module is missing" in error for error in errors))
            install(root, ["chart"])
            body += '<script src="../assets/visualizations/visualizations.js"></script><script src="../assets/visualizations/kinds/chart.js"></script>'
            lesson.write_text(body, encoding="utf-8")
            errors = []
            validate_visualizations(lesson, body, errors)
            self.assertEqual(errors, [])

    def test_optional_manifest_lists_only_real_files(self):
        registry = json.loads((KIT.parent / "optional/manifest.json").read_text())
        for name, entry in registry["components"].items():
            # Paths are relative to the optional tree; the visualisation kinds
            # point into `assets/` instead, which the `visualizations/` prefix marks.
            base = KIT.parent if entry["files"][0].startswith("visualizations/") else KIT.parent / "optional"
            for relative in entry["files"]:
                self.assertTrue((base / relative).is_file(), f"{name} -> {relative}")
            self.assertTrue((KIT.parent / "optional" / entry["docs"]).is_file(), f"{name} docs")
        for relative in registry["universal"]["files"]:
            self.assertTrue((SKILL / "assets" / relative).is_file(), f"universal -> {relative}")

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

    @unittest.skipUnless(shutil.which("node"), "Node is required for DOM rendering checks")
    def test_every_kind_renders_in_a_dom_including_the_library_missing_fallbacks(self):
        """Each kind must put something readable on screen, vendor library or not."""
        harness = ROOT / "tests/visualization_dom.cjs"
        jsdom = Path(os.environ.get("JSDOM_PATH", "/mnt/c/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom" if os.name != "nt" else "C:/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom"))
        if not jsdom.exists():
            self.skipTest("jsdom is required for DOM rendering checks")
        env = dict(os.environ, NODE_PATH=str(jsdom.parent))
        result = subprocess.run(["node", str(harness)], capture_output=True, text=True, env=env)
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
        jsdom = Path(os.environ.get("JSDOM_PATH", "/mnt/c/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom" if os.name != "nt" else "C:/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom"))
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
