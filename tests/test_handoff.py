from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CREATE = ROOT / "learning-handoff" / "scripts" / "create_handoff.py"
COMPLETE = ROOT / "learning-handoff" / "scripts" / "complete_handoff.py"
VALIDATE = ROOT / "learning-handoff" / "scripts" / "validate_handoffs.py"
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


def hash_tree(root: Path) -> dict[str, str]:
    digest = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            digest[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest


class HandoffTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_exam(self, name: str = "exam") -> Path:
        target = self.root / name
        shutil.copytree(EXAMPLE_EXAM, target)
        return target

    def copy_course(self, name: str = "course") -> Path:
        target = self.root / name
        shutil.copytree(EXAMPLE_COURSE, target)
        return target

    def create(self, source: Path, target: Path, record: str = "records/R0001.md", *extra: str):
        return run_script(
            CREATE,
            source,
            "--record",
            record,
            "--target-pkg",
            target,
            "--goal",
            "能区分条件概率的分母和分子",
            "--include",
            "conditional probability",
            "--exclude",
            "full probability course",
            "--return-condition",
            "one finalized application record",
            *extra,
        )

    def handoff_file(self, package: Path) -> Path:
        files = list((package / "handoffs").glob("*.md"))
        assert len(files) == 1, files
        return files[0]


class CreateHandoffTests(HandoffTestCase):
    def test_create_writes_h0001_and_validates_green(self) -> None:
        exam = self.copy_exam()
        course = self.copy_course()
        result = self.create(exam, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("H0001", result.stdout)

        handoff = self.handoff_file(exam)
        text = handoff.read_text(encoding="utf-8")
        self.assertIn("handoff_id: H0001", text)
        self.assertIn("status: open", text)
        self.assertIn("record: records/R0001.md", text)
        self.assertIn("include:", text)
        self.assertIn("exclude:", text)

        validation = run_script(VALIDATE, exam)
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)
        self.assertIn("handoffs=1 open=1", validation.stdout)

    def test_refusals_write_nothing(self) -> None:
        exam = self.copy_exam()
        course = self.copy_course()

        missing = self.create(exam, course, record="records/ghost.md")
        self.assertNotEqual(missing.returncode, 0)

        pending = exam / "records" / "R9999.md"
        pending.write_text(
            "---\nrecord_schema: 1\nassessment_status: pending\nmode: drill\n---\n# pending\n",
            encoding="utf-8",
        )
        unfinalized = self.create(exam, course, record="records/R9999.md")
        self.assertNotEqual(unfinalized.returncode, 0)

        no_condition = run_script(
            CREATE,
            exam,
            "--record",
            "records/R0001.md",
            "--target-pkg",
            course,
            "--goal",
            "目标",
        )
        self.assertNotEqual(no_condition.returncode, 0)
        self.assertIn("--return-condition", no_condition.stderr)

        self.assertFalse((exam / "handoffs").exists())

    def test_source_package_stays_byte_identical_except_handoffs(self) -> None:
        exam = self.copy_exam()
        course = self.copy_course()
        before = hash_tree(exam)
        result = self.create(exam, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        after = hash_tree(exam)
        new_files = set(after) - set(before)
        self.assertEqual(len(new_files), 1)
        self.assertTrue(new_files.pop().startswith("handoffs/"))
        for path, digest in before.items():
            self.assertEqual(after.get(path), digest, path)


class CompleteHandoffTests(HandoffTestCase):
    def prepare_open_handoff(self) -> tuple[Path, Path, Path]:
        exam = self.copy_exam()
        course = self.copy_course()
        result = self.create(exam, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return exam, course, self.handoff_file(exam)

    def test_complete_flow_returns_and_both_packages_validate(self) -> None:
        exam, course, handoff = self.prepare_open_handoff()
        result = run_script(COMPLETE, "--handoff", handoff, "--returned-record", "records/0001-example-feedback.md")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        text = handoff.read_text(encoding="utf-8")
        self.assertIn("status: returned", text)
        self.assertIn("returned_record: records/0001-example-feedback.md", text)
        self.assertIn("returned_at:", text)

        for package in (exam, course):
            validation = run_script(VALIDATE, package)
            self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)
        summary = run_script(VALIDATE, exam).stdout
        self.assertIn("open=0 returned=1 closed=0", summary)

    def test_pending_or_missing_returned_record_is_refused_without_writes(self) -> None:
        exam, course, handoff = self.prepare_open_handoff()
        before = hash_tree(exam)

        pending = course / "records" / "pending-evidence.md"
        pending.write_text(
            "---\nrecord_schema: 1\nassessment_status: pending\nlesson: 1\nevidence_type: null\nevidence_strength: null\nsupported_objectives: []\n---\n# pending\n",
            encoding="utf-8",
        )
        pending_result = run_script(COMPLETE, "--handoff", handoff, "--returned-record", "records/pending-evidence.md")
        self.assertNotEqual(pending_result.returncode, 0)
        self.assertIn("finalized", pending_result.stderr)

        missing_result = run_script(COMPLETE, "--handoff", handoff, "--returned-record", "records/ghost.md")
        self.assertNotEqual(missing_result.returncode, 0)

        outside = run_script(COMPLETE, "--handoff", handoff, "--returned-record", str(EXAMPLE_EXAM / "records" / "R0001.md"))
        self.assertNotEqual(outside.returncode, 0)

        self.assertEqual(hash_tree(exam), before)
        self.assertIn("status: open", handoff.read_text(encoding="utf-8"))


class ValidateHandoffTests(HandoffTestCase):
    def inject(self, exam: Path, frontmatter: str) -> Path:
        handoffs = exam / "handoffs"
        handoffs.mkdir(exist_ok=True)
        path = handoffs / "H0042-bad.md"
        path.write_text(f"---\n{frontmatter}---\n\n# bad\n", encoding="utf-8")
        return path

    def test_bad_status_fails_validation(self) -> None:
        exam = self.copy_exam()
        self.inject(
            exam,
            (
                "handoff_schema: 1\nhandoff_id: H0042\nstatus: archived\ncreated_at: '2026-08-24'\n"
                "return_condition:\n- one finalized application record\n"
                "from:\n  skill: exam-prep\n  package: exam\n  record: records/R0001.md\n"
                "to:\n  skill: learning-course\n  goal: 目标\n  boundary:\n    include: []\n    exclude: []\n"
            ),
        )
        result = run_script(VALIDATE, exam)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid status 'archived'", result.stdout)

    def test_missing_boundary_include_fails_validation(self) -> None:
        exam = self.copy_exam()
        self.inject(
            exam,
            (
                "handoff_schema: 1\nhandoff_id: H0042\nstatus: open\ncreated_at: '2026-08-24'\n"
                "return_condition:\n- one finalized application record\n"
                "from:\n  skill: exam-prep\n  package: exam\n  record: records/R0001.md\n"
                "to:\n  skill: learning-course\n  goal: 目标\n  boundary:\n    exclude: []\n"
            ),
        )
        result = run_script(VALIDATE, exam)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("to.boundary.include must be a list", result.stdout)

    def test_absent_handoffs_folder_is_valid_zero(self) -> None:
        course = self.copy_course()
        result = run_script(VALIDATE, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("handoffs=0", result.stdout)


if __name__ == "__main__":
    unittest.main()
