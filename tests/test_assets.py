import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "learning-course/scripts"))
from install_optional import install, InstallError
from prepare_acceptance import prepare
from validate_course import validate_visualizations, validate_answers_and_media
from validate_assets import validate_asset_package, validate_wiring


class AssetTests(unittest.TestCase):
    def init(self, root):
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "learning-course/scripts/init_course.py"),
                "--course-dir",
                str(root),
                "--title",
                "t",
                "--goal",
                "g",
            ],
            check=True,
            capture_output=True,
        )

    def test_projections_match_catalog_and_every_declared_file_and_example_exists(self):
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "learning-course/scripts/sync_asset_catalog.py"),
                "--check",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        catalog = json.loads((ROOT / "learning-course/assets/catalog.json").read_text())
        for name, spec in catalog["assets"].items():
            for relative in spec["files"]:
                self.assertTrue(
                    (ROOT / "learning-course/assets" / relative).is_file(),
                    (name, relative),
                )
            self.assertTrue(
                (ROOT / "learning-course/assets" / spec["example"]).is_file(), name
            )

    def test_late_conflict_leaves_all_assets_and_manifest_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            target = root / "assets/optional/theme/theme.css"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("user modified")
            before = {
                p.relative_to(root): p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
            }
            with self.assertRaises(InstallError):
                install(root, ["chart", "theme"])
            after = {
                p.relative_to(root): p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
            }
            self.assertEqual(before, after)

    def test_optional_install_preserves_customized_default_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            css = root / "assets/course.css"
            css.write_text("custom course theme")
            theme = root / "assets/theme.css"
            theme.write_text(":root { --course-accent: purple; }")
            install(root, ["media"])
            self.assertEqual(css.read_text(), "custom course theme")
            self.assertEqual(theme.read_text(), ":root { --course-accent: purple; }")
            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "learning-course/scripts/build_index.py"),
                    str(root),
                ],
                check=True,
                capture_output=True,
            )
            self.assertIn("assets/theme.css", (root / "index.html").read_text())

    def test_mid_write_failure_rolls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            before = {
                p.relative_to(root): p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
            }
            real = os.replace
            count = 0

            def fail_once(*args):
                nonlocal count
                count += 1
                if count == 2:
                    raise OSError("simulated disk failure")
                return real(*args)

            with patch("install_optional.os.replace", side_effect=fail_once):
                with self.assertRaisesRegex(InstallError, "rolled back"):
                    install(root, ["media"])
            self.assertEqual(
                before,
                {
                    p.relative_to(root): p.read_bytes()
                    for p in root.rglob("*")
                    if p.is_file()
                },
            )

    def test_catalog_drives_new_component_without_editing_installer(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            import install_optional

            entries = install_optional.catalogue()
            entries["custom-display"] = {**entries["media"], "dependencies": []}
            with patch("install_optional.catalogue", return_value=entries):
                install(root, ["custom-display"])
            self.assertTrue((root / "assets/optional/media/media.js").is_file())
            self.assertIn(
                "custom-display",
                json.loads((root / "assets/asset-manifest.json").read_text())[
                    "components"
                ],
            )

    def test_malformed_installed_metadata_reports_errors_without_crashing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            lesson = root / "lessons/0001-test.html"
            for state in (
                [],
                {"visualizations": [], "components": []},
                {
                    "visualizations": {"universal_kinds": [], "optional_kinds": [{}]},
                    "components": None,
                },
            ):
                (root / "assets/asset-manifest.json").write_text(json.dumps(state))
                errors = []
                validate_asset_package(root, errors)
                self.assertTrue(errors, state)
                validate_visualizations(
                    lesson, '<div data-visualization="chart"></div>', errors
                )
                validate_wiring(lesson, "<figure data-media></figure>", errors)
            (root / "assets/visualizations/adapters.json").write_text("[]")
            errors = []
            validate_visualizations(
                lesson, '<div data-visualization="chart"></div>', errors
            )
            self.assertTrue(any("registry" in e for e in errors), errors)
            errors = []
            validate_answers_and_media(
                lesson,
                "<figure data-media><script data-media-config>[]</script></figure>",
                errors,
            )
            self.assertTrue(any("hotspot config" in e for e in errors), errors)

    def test_real_sample_assets_validate_and_tampered_vendor_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = prepare(Path(tmp) / "course")
            errors = []
            validate_asset_package(root, errors)
            self.assertEqual(errors, [])
            target = (
                root / "assets/visualizations/vendor/plotly.js-dist-min/plotly.min.js"
            )
            target.write_text("changed")
            errors = []
            validate_asset_package(root, errors)
            self.assertTrue(any("checksum" in e for e in errors), errors)

    def test_missing_and_reversed_core_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            lesson = root / "lessons/0001-model.html"
            module = '<script src="../assets/visualizations/kinds/list.js"></script>'
            body = '<div data-visualization="relation"></div>' + module
            errors = []
            validate_wiring(lesson, body, errors)
            self.assertTrue(any("missing script" in e for e in errors))
            errors = []
            validate_wiring(
                lesson,
                body
                + '<script src="../assets/visualizations/visualizations.js"></script>',
                errors,
            )
            self.assertTrue(any("before kind" in e for e in errors))

    def test_invalid_answers_and_hotspot_bounds_fail(self):
        errors = []
        validate_answers_and_media(
            Path("0001-a.html"),
            '<section data-answer-kind="numeric" data-expected="NaN"></section><figure data-media><script data-media-config>{"hotspots":[{"id":"a","label":"a","x":101,"y":10}]}</script></figure>',
            errors,
        )
        self.assertTrue(any("expected/tolerance" in e for e in errors))
        self.assertTrue(any("hotspot" in e for e in errors))

    @unittest.skipUnless(shutil.which("node"), "Node required")
    def test_real_dom_asset_behaviour(self):
        jsdom = os.environ.get(
            "JSDOM_PATH",
            (
                "/mnt/c/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom"
                if os.name != "nt"
                else "C:/Users/wy/.workbuddy/binaries/node/workspace/node_modules/jsdom"
            ),
        )
        if not Path(jsdom).is_dir():
            self.skipTest("jsdom unavailable")
        env = dict(os.environ, NODE_PATH=str(Path(jsdom).parent))
        result = subprocess.run(
            ["node", str(ROOT / "tests/asset_behaviour.cjs")],
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
