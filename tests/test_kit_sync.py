"""Kit sync/check regression tests extracted from the retired legacy asset suite."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
KIT_PY = ROOT / "learning-course/kit/build/kit.py"

sys.path.insert(0, str(ROOT / "tests"))
from jsdom_locator import resolve_jsdom  # noqa: E402


def run_kit(*args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(KIT_PY), *(str(a) for a in args)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


class KitSyncTestCase(unittest.TestCase):
    def init(self, root: Path) -> None:
        subprocess.run(
            [sys.executable, str(ROOT / "learning-course/scripts/init_course.py"),
             "--course-dir", str(root), "--title", "t", "--goal", "g"],
            check=True, capture_output=True,
        )


class CatalogProjectionTests(KitSyncTestCase):
    def test_projections_match_catalog_and_kind_modules_and_examples_exist(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "learning-course/scripts/sync_asset_catalog.py"), "--check"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        catalog = json.loads((ROOT / "learning-course/kit/catalog.json").read_text(encoding="utf-8"))
        skill = ROOT / "learning-course"
        for name, spec in catalog["assets"].items():
            for relative in spec["files"]:
                self.assertTrue((skill / relative).is_file(), (name, relative))
            example = spec.get("example", "")
            if example:
                example = example.replace("acceptance-course/", "fixtures/acceptance/")
                self.assertTrue((skill / example).is_file(), name)


class KitSyncTests(KitSyncTestCase):
    def test_kit_sync_and_check_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            lesson = root / "lessons/0001-test.html"
            lesson.write_text("""<!DOCTYPE html>
<html><head><link rel="stylesheet" href="../assets/kit/kit.css"></head>
<body class="lesson" data-course-id="c1" data-lesson-id="1" data-objective="obj1">
  <div class="code-block"><pre><code class="language-python">print('hi')</code></pre></div>
  <script src="../assets/kit/kit.js"></script>
</body></html>""", encoding="utf-8")
            res = run_kit("sync", root)
            self.assertEqual(res.returncode, 0, (res.stdout or "") + (res.stderr or ""))
            res = run_kit("check", root)
            self.assertEqual(res.returncode, 0, (res.stdout or "") + (res.stderr or ""))
            kit_js = root / "assets/kit/kit.js"
            kit_js.write_text("tampered content", encoding="utf-8")
            res = run_kit("check", root)
            self.assertNotEqual(res.returncode, 0)
            self.assertIn("Hash mismatch", (res.stdout or "") + (res.stderr or ""))

    def test_extension_requires_are_bundled_and_locked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            lesson = root / "lessons/0001-nocode.html"
            lesson.write_text("""<!DOCTYPE html>
<html><head><link rel="stylesheet" href="../assets/kit/kit.css"></head>
<body class="lesson" data-course-id="c1" data-lesson-id="1" data-objective="obj1">
  <p>No code block here</p>
  <script src="../assets/kit/kit.js"></script>
</body></html>""", encoding="utf-8")
            cfg_file = root / "assets/course/config.json"
            cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
            ext_css = root / "assets/course/ext.css"
            ext_css.write_text("/* custom ext css */", encoding="utf-8")
            cfg["extensions"] = [{"id": "my-code-ext", "requires": ["content.code"], "css": "ext.css"}]
            cfg_file.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            res = run_kit("sync", root)
            self.assertEqual(res.returncode, 0, (res.stdout or "") + (res.stderr or ""))
            lock_data = json.loads((root / "assets/kit/kit.lock.json").read_text(encoding="utf-8"))
            self.assertIn("content.code", lock_data["modules"])
            self.assertIn("extension:my-code-ext", lock_data["reasons"].get("content.code", []))
            res = run_kit("check", root)
            self.assertEqual(res.returncode, 0, (res.stdout or "") + (res.stderr or ""))
            del lock_data["modules"]["content.code"]
            (root / "assets/kit/kit.lock.json").write_text(json.dumps(lock_data, indent=2), encoding="utf-8")
            res = run_kit("check", root)
            self.assertNotEqual(res.returncode, 0)
            self.assertIn("content.code", (res.stdout or "") + (res.stderr or ""))

    def test_sync_failure_preserves_courseware_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            unnormalized_html = """<!DOCTYPE html>
<html><head></head>
<body class="lesson" data-course-id="c1" data-lesson-id="1">
  <h3>Un-normalized Heading</h3>
</body></html>"""
            lesson = root / "lessons/0001-unnorm.html"
            lesson.write_text(unnormalized_html, encoding="utf-8")
            cfg_file = root / "assets/course/config.json"
            cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
            cfg["extensions"] = [{"id": "broken-ext", "requires": ["content.code"], "css": "non_existent_file.css"}]
            cfg_file.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            res = run_kit("sync", root)
            self.assertNotEqual(res.returncode, 0)
            self.assertEqual(lesson.read_text(encoding="utf-8"), unnormalized_html,
                             "Courseware HTML must not be modified when sync fails")

    def test_sync_html_write_failure_rolls_back_raw_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.init(root)
            lesson1 = root / "lessons/0001-first.html"
            content1 = "<!DOCTYPE html><html><head></head><body class=\"lesson\" data-course-id=\"c\" data-lesson-id=\"1\"><h3>H1</h3></body></html>"
            lesson1.write_text(content1, encoding="utf-8")
            bytes1 = lesson1.read_bytes()
            lesson2 = root / "lessons/0002-second.html"
            content2 = "<!DOCTYPE html><html><head></head><body class=\"lesson\" data-course-id=\"c\" data-lesson-id=\"2\"><h3>H2</h3></body></html>"
            lesson2.write_text(content2, encoding="utf-8")
            bytes2 = lesson2.read_bytes()

            orig_replace = os.replace

            def faulty_replace(src, dst):
                if Path(src).name.startswith(".tmp_0002"):
                    raise IOError("Simulated disk error during atomic replace of lesson 2")
                return orig_replace(src, dst)

            sys.path.insert(0, str(ROOT / "learning-course/kit/build"))
            import kit as kit_mod

            with patch("os.replace", side_effect=faulty_replace):
                success = kit_mod.sync_course(root)
                self.assertFalse(success, "sync_course must return False on commit error")
            self.assertEqual(lesson1.read_bytes(), bytes1, "lesson 1 must be rolled back to original bytes")
            self.assertEqual(lesson2.read_bytes(), bytes2, "lesson 2 must remain original bytes")
            self.assertEqual(list((root / "lessons").glob(".tmp_*")), [],
                             "No temporary files should be left after rollback")


class AnswerMediaValidatorTests(unittest.TestCase):
    def test_invalid_answers_and_hotspot_bounds_fail(self):
        sys.path.insert(0, str(ROOT / "learning-course/scripts"))
        from validate_course import validate_answers_and_media

        errors: list[str] = []
        validate_answers_and_media(
            Path("0001-a.html"),
            '<section data-answer-kind="numeric" data-expected="NaN"></section>'
            '<figure data-media><script data-media-config>{"hotspots":[{"id":"a","label":"a","x":101,"y":10}]}</script></figure>',
            errors,
        )
        self.assertTrue(any("expected/tolerance" in e for e in errors))
        self.assertTrue(any("hotspot" in e for e in errors))


class AssetBehaviourDomTests(unittest.TestCase):
    @unittest.skipUnless(__import__("shutil").which("node"), "Node required")
    def test_real_dom_asset_behaviour(self):
        jsdom_path = resolve_jsdom()
        if jsdom_path is None:
            self.skipTest("jsdom unavailable")
        env = dict(os.environ, NODE_PATH=str(jsdom_path.parent))
        result = subprocess.run(["node", str(ROOT / "tests/asset_behaviour.cjs")],
                                capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
