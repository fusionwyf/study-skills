"""Recovery/corruption regression tests.

Repo principle under test: corrupted or legacy state must be caught by
validators/update scripts with a clear error -- never silently accepted,
never overwritten. Every expected-failure assertion checks the exit code
AND a stable fragment of the script's own error message. Mutation attempts
are additionally proven non-destructive via SHA-256 of the corrupted inputs
before/after the refused run.
"""

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
COURSE_VALIDATE = ROOT / "learning-course" / "scripts" / "validate_course.py"
COURSE_UPDATE = ROOT / "learning-course" / "scripts" / "update_progress.py"
EXAM_VALIDATE = ROOT / "exam-prep" / "scripts" / "validate_exam.py"
RECORD_VALIDATE = ROOT / "shared" / "scripts" / "validate_record.py"


def run_script(script: Path, *args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *(str(arg) for arg in args)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snap(*paths: Path) -> dict[str, str]:
    return {str(path): digest(path) for path in paths}


def output_of(result: subprocess.CompletedProcess[str]) -> str:
    return result.stdout + result.stderr


class RecoveryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_course(self) -> Path:
        target = self.root / "course"
        shutil.copytree(ROOT / "learning-course" / "assets" / "example-course", target)
        return target

    def copy_exam(self) -> Path:
        target = self.root / "exam"
        shutil.copytree(ROOT / "exam-prep" / "assets" / "example-exam", target)
        return target

    def assertUnchanged(self, before: dict[str, str]) -> None:
        for path_str, old in before.items():
            path = Path(path_str)
            self.assertEqual(
                digest(path),
                old,
                f"refused operation modified corrupted input: {path.name}",
            )


class CorruptCourseStateTests(RecoveryTestCase):
    def test_invalid_yaml_syntax_fails_validation_and_update_refuses(self) -> None:
        course = self.copy_course()
        state_path = course / "course.yaml"
        # Append a syntactically broken mapping entry: every original top-level
        # key stays greppable, but yaml.safe_load must fail.
        state_path.write_text(
            state_path.read_text(encoding="utf-8") + "\nbroken: [unclosed\n",
            encoding="utf-8",
        )
        before = snap(state_path)

        validation = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(validation.returncode, 1)
        self.assertIn("course.yaml cannot be parsed", validation.stdout)

        update = run_script(COURSE_UPDATE, course, "--status", "paused")
        self.assertEqual(update.returncode, 1)
        self.assertIn("course.yaml cannot be parsed", update.stderr)

        self.assertUnchanged(before)


class CorruptExamStateTests(RecoveryTestCase):
    def test_missing_required_section_fails_cleanly(self) -> None:
        exam = self.copy_exam()
        state_path = exam / "exam.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        del state["readiness"]
        state_path.write_text(
            yaml.safe_dump(state, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        before = snap(state_path)

        result = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertEqual(result.returncode, 1)
        self.assertIn("ERROR:", result.stdout)
        self.assertIn("missing top-level key: readiness", result.stdout)

        self.assertUnchanged(before)


class BrokenRecordFrontmatterTests(RecoveryTestCase):
    def write_record(self, course: Path, body: str) -> Path:
        record = course / "records" / "0002-broken.md"
        record.write_text(body, encoding="utf-8")
        return record

    def test_missing_delimiter_rejected_by_shared_validator_and_update(self) -> None:
        course = self.copy_course()
        record = self.write_record(
            course,
            "record_schema: 1\nassessment_status: pending\nlesson: 1\n\n# body without frontmatter\n",
        )
        state_path = course / "course.yaml"
        before = snap(record, state_path)

        shared = run_script(RECORD_VALIDATE, record)
        self.assertEqual(shared.returncode, 1)
        self.assertIn("FAIL", shared.stdout)
        self.assertIn("frontmatter", shared.stdout)

        update = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            "records/0002-broken.md",
            "--objective",
            "variables-and-assignment=application",
        )
        self.assertEqual(update.returncode, 1)
        self.assertIn("is missing YAML frontmatter", output_of(update))

        self.assertUnchanged(before)
        self.assertEqual(
            sorted(path.name for path in (course / "records").iterdir()),
            ["0001-example-feedback.md", "0002-broken.md"],
            "refused update must not create or remove records",
        )

    def test_unparsable_frontmatter_rejected_by_shared_validator_and_update(self) -> None:
        course = self.copy_course()
        record = self.write_record(
            course,
            "---\nrecord_schema: [unclosed\n---\n# body\n",
        )
        state_path = course / "course.yaml"
        before = snap(record, state_path)

        shared = run_script(RECORD_VALIDATE, record)
        self.assertEqual(shared.returncode, 2)
        self.assertIn("ERROR:", shared.stdout + shared.stderr)
        self.assertIn("解析失败", shared.stdout + shared.stderr)

        update = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            "records/0002-broken.md",
            "--objective",
            "variables-and-assignment=application",
        )
        self.assertEqual(update.returncode, 1)
        self.assertIn("frontmatter cannot be parsed", output_of(update))

        self.assertUnchanged(before)


class DanglingReferenceTests(RecoveryTestCase):
    def test_objective_evidence_citing_missing_record_fails_validation(self) -> None:
        course = self.copy_course()
        state_path = course / "course.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        state["objectives"][0]["evidence"] = [
            {
                "record": "records/0001-missing.md",
                "type": "application",
                "strength": "strong",
                "mastery": "application",
            }
        ]
        state_path.write_text(
            yaml.safe_dump(state, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        before = snap(state_path)

        result = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(result.returncode, 1)
        self.assertIn("does not exist", result.stdout)
        self.assertIn("records/0001-missing.md", result.stdout)

        self.assertUnchanged(before)

    def test_review_queue_last_record_citing_missing_file_fails_validation(self) -> None:
        course = self.copy_course()
        state_path = course / "course.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        state["review_queue"] = [
            {
                "objective_id": "variables-and-assignment",
                "due_at": "2026-09-01",
                "interval_days": 3,
                "review_count": 1,
                "last_record": "records/9999-review.md",
            }
        ]
        state_path.write_text(
            yaml.safe_dump(state, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        before = snap(state_path)

        result = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(result.returncode, 1)
        self.assertIn("does not exist", result.stdout)
        self.assertIn("records/9999-review.md", result.stdout)

        self.assertUnchanged(before)


class OutOfVocabularyEnumTests(RecoveryTestCase):
    def test_bogus_assessment_status_rejected_by_shared_validator(self) -> None:
        course = self.copy_course()
        record = course / "records" / "0002-bogus.md"
        record.write_text(
            """---
record_schema: 1
assessment_status: bogus
lesson: 1
evidence_type: application
evidence_strength: strong
supported_objectives:
  - id: variables-and-assignment
    mastery: application
---
# body
""",
            encoding="utf-8",
        )
        before = snap(record)

        result = run_script(RECORD_VALIDATE, record)
        self.assertEqual(result.returncode, 1)
        self.assertIn("FAIL", result.stdout)
        self.assertIn("assessment_status", result.stdout)
        self.assertIn("枚举内", result.stdout)

        self.assertUnchanged(before)


if __name__ == "__main__":
    unittest.main()
