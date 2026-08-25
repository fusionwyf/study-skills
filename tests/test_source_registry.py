from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml


ROOT = Path(__file__).resolve().parents[1]
REGISTER = ROOT / "source-grounded-study" / "scripts" / "register_source.py"
VALIDATE_SOURCES = ROOT / "source-grounded-study" / "scripts" / "validate_sources.py"
EXAM_VALIDATE = ROOT / "exam-prep" / "scripts" / "validate_exam.py"
EXAM_UPDATE = ROOT / "exam-prep" / "scripts" / "update_exam.py"
EXAMPLE_COURSE = ROOT / "learning-course" / "assets" / "example-course"
EXAMPLE_EXAM = ROOT / "exam-prep" / "assets" / "example-exam"


def run_script(script: Path, *args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *(str(arg) for arg in args)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )


class SourceRegistryTestCase(unittest.TestCase):
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

    def register(self, package: Path, title: str, source_type: str, reliability: str, *extra: str):
        return run_script(
            REGISTER,
            package,
            "--title",
            title,
            "--type",
            source_type,
            "--reliability",
            reliability,
            *extra,
        )


class RegisterSourceTests(SourceRegistryTestCase):
    def test_sequential_course_registrations_get_s001_s002_with_detail_folders(self) -> None:
        course = self.copy_course()
        first = self.register(course, "概率论基础教材", "textbook", "official", "--coverage", "第 1-3 章")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertIn("S001", first.stdout)
        second = self.register(course, "课堂笔记", "user_notes", "user")
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertIn("S002", second.stdout)

        registry = course / "sources" / "SOURCES.md"
        self.assertTrue(registry.is_file())
        rows = [
            line
            for line in registry.read_text(encoding="utf-8").splitlines()
            if line.strip().startswith("| S0")
        ]
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0].startswith("| S001 |"))
        self.assertTrue(rows[1].startswith("| S002 |"))
        for source_id in ("S001", "S002"):
            detail = course / "sources" / source_id
            self.assertTrue((detail / "excerpts.md").is_file(), source_id)
            self.assertTrue((detail / "claims.md").is_file(), source_id)

    def test_exam_registration_appends_root_sources_md_and_validate_exam_stays_green(self) -> None:
        exam = self.copy_exam()
        result = self.register(exam, "官方考纲", "syllabus", "official")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("S002", result.stdout)

        registry = exam / "SOURCES.md"
        text = registry.read_text(encoding="utf-8")
        self.assertIn("| S001 | Example sample paper | past_paper |", text)
        self.assertIn("| S002 | 官方考纲 | syllabus |", text)

        # Registration changes the package contents, so the exam state must be
        # re-synced (documented workflow) before validation.
        sync = run_script(EXAM_UPDATE, exam, "--sync-materials")
        self.assertEqual(sync.returncode, 0, sync.stdout + sync.stderr)
        validation = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_title_with_pipe_survives_round_trip(self) -> None:
        course = self.copy_course()
        title = "A | B 教材"
        result = self.register(course, title, "textbook", "official")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("S001", result.stdout)

        registry = course / "sources" / "SOURCES.md"
        text = registry.read_text(encoding="utf-8")
        # written escaped so the table stays 6 columns wide
        self.assertIn("| S001 | A \\| B 教材 | textbook |", text)

        # re-registering the same title must parse it back as ONE cell: the
        # duplicate warning proves the title was not split on the escaped pipe
        duplicate = self.register(course, title, "textbook", "official")
        self.assertIn("WARNING: a source titled", duplicate.stderr)
        self.assertIn("S002", duplicate.stdout)

        validation = run_script(VALIDATE_SOURCES, course)
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)


class RegisterSourceRollbackTests(SourceRegistryTestCase):
    def load_module(self):
        spec = importlib.util.spec_from_file_location("register_source", REGISTER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_mid_write_failure_rolls_back_partial_registration(self) -> None:
        course = self.copy_course()
        module = self.load_module()

        real_write = Path.write_text
        state = {"n": 0}

        def flaky_write(path, *args, **kwargs):
            state["n"] += 1
            if state["n"] == 2:  # excerpts.md writes first, claims.md fails second
                raise OSError("simulated write failure")
            return real_write(path, *args, **kwargs)

        argv = [
            "register_source.py",
            str(course),
            "--title",
            "教材",
            "--type",
            "textbook",
            "--reliability",
            "official",
        ]
        with mock.patch.object(Path, "write_text", flaky_write):
            with mock.patch.object(sys, "argv", argv):
                rc = module.main()

        self.assertNotEqual(rc, 0)
        # the orphaned detail folder and the registry must both be gone,
        # so a retry starts clean
        self.assertFalse((course / "sources" / "S001").exists())
        self.assertFalse((course / "sources" / "SOURCES.md").exists())

        retry = self.register(course, "教材", "textbook", "official")
        self.assertEqual(retry.returncode, 0, retry.stdout + retry.stderr)
        self.assertIn("S001", retry.stdout)


class ValidateSourcesTests(SourceRegistryTestCase):
    def test_passes_on_registered_course_package_and_on_example_exam(self) -> None:
        course = self.copy_course()
        registered = self.register(course, "概率论基础教材", "textbook", "official")
        self.assertEqual(registered.returncode, 0, registered.stdout + registered.stderr)
        result = run_script(VALIDATE_SOURCES, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("sources=1", result.stdout)

        shipped = run_script(VALIDATE_SOURCES, EXAMPLE_EXAM)
        self.assertEqual(shipped.returncode, 0, shipped.stdout + shipped.stderr)
        self.assertIn("sources=1", shipped.stdout)

    def test_fails_on_bad_reliability_row(self) -> None:
        course = self.copy_course()
        registered = self.register(course, "概率论基础教材", "textbook", "official")
        self.assertEqual(registered.returncode, 0, registered.stdout + registered.stderr)
        registry = course / "sources" / "SOURCES.md"
        with registry.open("a", encoding="utf-8") as handle:
            handle.write("| S002 | 可疑笔记 | user_notes | 2026-08-24 | official-ish | - |\n")
        result = run_script(VALIDATE_SOURCES, course)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid reliability 'official-ish'", result.stdout)

    def test_fails_on_claim_referencing_unknown_source_id(self) -> None:
        course = self.copy_course()
        registered = self.register(course, "概率论基础教材", "textbook", "official")
        self.assertEqual(registered.returncode, 0, registered.stdout + registered.stderr)
        claims = course / "sources" / "S001" / "claims.md"
        claims.write_text(
            "\n".join(
                [
                    "# Claims — S001",
                    "",
                    "- claim: 条件概率 P(A|B) = P(A∩B)/P(B)",
                    "  source: S999",
                    "  location: §3.2",
                    "  status: sourced",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        result = run_script(VALIDATE_SOURCES, course)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown source id 'S999'", result.stdout)

    def test_summary_reports_unverified_claim_count(self) -> None:
        course = self.copy_course()
        registered = self.register(course, "概率论基础教材", "textbook", "official")
        self.assertEqual(registered.returncode, 0, registered.stdout + registered.stderr)
        claims = course / "sources" / "S001" / "claims.md"
        claims.write_text(
            "\n".join(
                [
                    "# Claims — S001",
                    "",
                    "- claim: 有摘录支撑的主张",
                    "  source: S001",
                    "  location: §3.2",
                    "  status: sourced",
                    "",
                    "- claim: 暂无来源的主张",
                    "  source: S001",
                    "  location: §4.0",
                    "  status: unverified",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        result = run_script(VALIDATE_SOURCES, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("unverified=1", result.stdout)
        self.assertIn("contested=0", result.stdout)


if __name__ == "__main__":
    unittest.main()
