from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
BUILD_REPORT = ROOT / "study-report" / "scripts" / "build_report.py"
EXAMPLE_COURSE = ROOT / "learning-course" / "assets" / "example-course"
EXAMPLE_EXAM = ROOT / "exam-prep" / "assets" / "example-exam"

SECTION_TITLES = ("当前目标", "证据覆盖率", "已确认能力", "仍不确定能力", "最近错误模式", "到期复习", "风险", "下一步建议")


def run_script(script: Path, *args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *(str(arg) for arg in args)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )


def hash_tree(root: Path) -> dict[str, str]:
    digest = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            digest[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest


class StudyReportTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_course(self, name: str = "course") -> Path:
        target = self.root / name
        shutil.copytree(EXAMPLE_COURSE, target)
        return target

    def copy_exam(self, name: str = "exam") -> Path:
        target = self.root / name
        shutil.copytree(EXAMPLE_EXAM, target)
        return target


class CourseReportTests(StudyReportTestCase):
    def test_report_has_all_sections_and_confirms_strong_objective(self) -> None:
        course = self.copy_course()
        result = run_script(BUILD_REPORT, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for section in SECTION_TITLES:
            self.assertIn(f"## {section}", result.stdout)
        self.assertIn("[confirmed] variables-and-assignment", result.stdout)
        self.assertIn("records/0001-example-feedback.md", result.stdout)
        self.assertRegex(result.stdout, r"generated: \d{4}-\d{2}-\d{2}")

    def test_medium_evidence_only_is_inferred_not_confirmed(self) -> None:
        course = self.copy_course()
        record = course / "records" / "0001-example-feedback.md"
        text = record.read_text(encoding="utf-8")
        text = text.replace("evidence_strength: strong", "evidence_strength: medium")
        record.write_text(text, encoding="utf-8")
        result = run_script(BUILD_REPORT, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[inferred] variables-and-assignment", result.stdout)
        self.assertNotIn("[confirmed]", result.stdout)

    def test_empty_state_reports_unknowns_instead_of_crashing(self) -> None:
        course = self.copy_course()
        for record in (course / "records").glob("*.md"):
            record.unlink()
        state_path = course / "course.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        state["last_feedback"] = None
        state_path.write_text(yaml.safe_dump(state, allow_unicode=True, sort_keys=False), encoding="utf-8")
        result = run_script(BUILD_REPORT, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[unknown] variables-and-assignment", result.stdout)
        self.assertIn("0/1 个目标有至少一条 finalized 记录支撑", result.stdout)


class ExamReportTests(StudyReportTestCase):
    def test_readiness_classification_and_error_log_parsing(self) -> None:
        exam = self.copy_exam()
        result = run_script(BUILD_REPORT, exam)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for metric in ("accuracy", "speed", "coverage", "stability"):
            self.assertIn(f"[confirmed] {metric}", result.stdout)
        self.assertIn("records/R0001.md", result.stdout)
        self.assertIn("2/3 道来源题，1 道合成题", result.stdout)
        self.assertIn("error-log.md", result.stdout)
        self.assertIn("Q0002: confused P(A given B) with P(B given A)", result.stdout)
        self.assertIn("recurring_patterns：暂无记录", result.stdout)


class ReadOnlyAndDeterminismTests(StudyReportTestCase):
    def test_out_run_touches_only_the_report_file(self) -> None:
        course = self.copy_course()
        before = hash_tree(course)
        result = run_script(BUILD_REPORT, course, "--out", "REPORT.md")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        after = hash_tree(course)
        new_files = set(after) - set(before)
        self.assertEqual(new_files, {"exports/REPORT.md"})
        for path, digest in before.items():
            self.assertEqual(after.get(path), digest, path)

    def test_out_accepts_exports_prefixed_relative_path(self) -> None:
        course = self.copy_course()
        result = run_script(BUILD_REPORT, course, "--out", "exports/weekly/report.md")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue((course / "exports" / "weekly" / "report.md").is_file())

    def test_out_rejects_escapes_and_absolute_paths_without_writes(self) -> None:
        course = self.copy_course()
        before = hash_tree(course)
        for bad in (str(course / "course.yaml"), "../outside.md", "exports/../course.yaml"):
            result = run_script(BUILD_REPORT, course, "--out", bad)
            self.assertNotEqual(result.returncode, 0, bad)
        self.assertEqual(hash_tree(course), before)

    def test_same_day_runs_are_byte_identical(self) -> None:
        course = self.copy_course()
        first = run_script(BUILD_REPORT, course)
        second = run_script(BUILD_REPORT, course)
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual(first.stdout, second.stdout)


if __name__ == "__main__":
    unittest.main()
