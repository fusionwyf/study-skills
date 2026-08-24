"""Export regression tests for the learning-course derived views.

Covers build_index.py and export_pdf.py on a temp copy of the example course:

- build_index regenerates its documented artifacts (INDEX.md, index.html)
  containing the course title, without touching any source file.
- export_pdf either produces a genuine non-trivial PDF or degrades gracefully
  (repo doctrine: 不能渲染 PDF 时保留 HTML 并说明限制，不创建伪 PDF):
  no zero-byte or placeholder-only .pdf is ever left behind, the lesson HTML
  survives intact, and any limitation is reported on stdout/stderr instead of
  crashing.
- Derived-view purity: hashing every pre-existing package file before/after
  both exports proves exports never mutate sources. INDEX.md/index.html are
  the two views build_index is *supposed* to rewrite, so source hashes are
  taken over everything else (course.yaml, PLAN.md, lessons/, assets/,
  reference/, records/); a second full snapshot taken after build_index proves
  export_pdf itself changes nothing pre-existing.
"""

from __future__ import annotations

import hashlib
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
BUILD_INDEX = ROOT / "learning-course" / "scripts" / "build_index.py"
EXPORT_PDF = ROOT / "learning-course" / "scripts" / "export_pdf.py"
EXAMPLE_COURSE = ROOT / "learning-course" / "assets" / "example-course"


def _load_export_pdf_module():
    spec = importlib.util.spec_from_file_location("_export_pdf_under_test", EXPORT_PDF)
    assert spec is not None and spec.loader is not None  # static path is a real file
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_EXPORT_PDF_MODULE = _load_export_pdf_module()
# Same detection the CLI itself performs. When this is None the script's own
# graceful branch ("No Chromium-family browser found") is the expected outcome,
# so the export sub-case stays exercisable and no unittest.skipIf is needed.
BROWSER = _EXPORT_PDF_MODULE.find_browser(None)


def run_script(script: Path, *args: object, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *(str(arg) for arg in args)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
        timeout=timeout,
    )


def tree_digests(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def source_digests(root: Path) -> dict[str, str]:
    """Hashes of everything that must NEVER change during exports.

    Excludes only the derived views (INDEX.md, index.html) and the exports/
    directory, all of which are regenerable by doctrine.
    """
    return {
        rel: digest
        for rel, digest in tree_digests(root).items()
        if rel not in {"INDEX.md", "index.html"} and not rel.startswith("exports/")
    }


class ExportSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_course(self) -> Path:
        target = self.root / "course"
        shutil.copytree(EXAMPLE_COURSE, target)
        return target

    def test_build_index_regenerates_derived_views_with_course_title(self) -> None:
        course = self.copy_course()
        title = yaml.safe_load((course / "course.yaml").read_text(encoding="utf-8"))["title"]
        sources_before = source_digests(course)

        result = run_script(BUILD_INDEX, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        index_md = (course / "INDEX.md").read_text(encoding="utf-8")
        index_html = (course / "index.html").read_text(encoding="utf-8")
        self.assertTrue(index_md.strip(), "INDEX.md must be non-empty")
        self.assertTrue(index_html.strip(), "index.html must be non-empty")
        self.assertIn(title, index_md)
        self.assertIn(title, index_html)
        self.assertIn("lessons/0001-example.html", index_md)

        # Only the two derived views were rewritten; every source is untouched.
        self.assertEqual(source_digests(course), sources_before)

    def test_export_pdf_keeps_html_and_never_writes_a_placeholder_pdf(self) -> None:
        course = self.copy_course()
        lesson = course / "lessons" / "0001-example.html"
        pdf_path = course / "exports" / "0001-example.pdf"

        sources_before = source_digests(course)
        build = run_script(BUILD_INDEX, course)
        self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
        # Full snapshot AFTER build_index (includes its regenerated views):
        # whatever happens next, export_pdf itself must not change these bytes.
        snapshot_after_build = tree_digests(course)

        result = run_script(EXPORT_PDF, lesson, pdf_path)
        combined = (result.stdout + result.stderr).strip()

        if result.returncode == 0:
            # Success branch: a genuine, non-trivial PDF artifact.
            self.assertTrue(pdf_path.is_file(), "success must leave the PDF it printed")
            data = pdf_path.read_bytes()
            self.assertGreater(len(data), 0, "PDF must not be zero-byte")
            self.assertTrue(data.startswith(b"%PDF"), "artifact must be a real PDF, not a placeholder")
        else:
            # Graceful-degradation branch: explain the limitation off-shell,
            # never crash with a traceback, never leave a fake/empty PDF.
            self.assertNotIn("Traceback", result.stderr)
            self.assertTrue(combined, "failure must explain itself on stdout/stderr")
            for pdf in course.glob("exports/*.pdf"):
                data = pdf.read_bytes()
                self.assertGreater(len(data), 0, f"zero-byte PDF left behind: {pdf.name}")
                self.assertTrue(data.startswith(b"%PDF"), f"placeholder PDF left behind: {pdf.name}")

        # Derived-view purity across both exports: no pre-existing file changed.
        after = tree_digests(course)
        self.assertEqual(
            {rel: h for rel, h in after.items() if rel in snapshot_after_build},
            snapshot_after_build,
            "export_pdf modified pre-existing package files",
        )
        self.assertEqual(
            {rel: h for rel, h in after.items() if rel in sources_before},
            sources_before,
            "exports mutated source files",
        )
        # The lesson HTML survives intact (also covered by the hash equality above).
        self.assertEqual(
            hashlib.sha256(lesson.read_bytes()).hexdigest(),
            sources_before["lessons/0001-example.html"],
        )


if __name__ == "__main__":
    unittest.main()
