from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml


ROOT = Path(__file__).resolve().parents[1]
COURSE_UPDATE = ROOT / "learning-course" / "scripts" / "update_progress.py"
COURSE_VALIDATE = ROOT / "learning-course" / "scripts" / "validate_course.py"
EXAM_UPDATE = ROOT / "exam-prep" / "scripts" / "update_exam.py"
EXAM_VALIDATE = ROOT / "exam-prep" / "scripts" / "validate_exam.py"


def run_script(script: Path, *args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *(str(arg) for arg in args)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def dump_yaml(path: Path, data: dict) -> None:
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")


class PackageTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_course(self) -> Path:
        target = self.root / "course"
        shutil.copytree(ROOT / "learning-course" / "assets" / "example-course", target)
        (target / "records").mkdir(exist_ok=True)
        (target / "reference").mkdir(exist_ok=True)
        (target / "exports").mkdir(exist_ok=True)
        return target

    def copy_exam(self) -> Path:
        target = self.root / "exam"
        shutil.copytree(ROOT / "exam-prep" / "assets" / "example-exam", target)
        return target


class LearningCourseInvariantTests(PackageTestCase):
    def finalized_record(
        self,
        course: Path,
        objective: str,
        mastery: str,
        filename: str = "0001-feedback.md",
    ) -> Path:
        path = course / "records" / filename
        path.write_text(
            f"""---
record_schema: 1
assessment_status: finalized
lesson: 1
evidence_type: application
evidence_strength: strong
independence: independent
supported_objectives:
  - id: {objective}
    mastery: {mastery}
---
# Record

## Learner feedback

The learner predicted the output and explained the reassignment.

## Observable behavior

- Correct independent prediction with an explanation.
""",
            encoding="utf-8",
        )
        return path

    def test_feedback_capture_cannot_update_mastery_in_one_step(self) -> None:
        course = self.copy_course()
        result = run_script(
            COURSE_UPDATE,
            course,
            "--lesson",
            1,
            "--feedback-text",
            "I feel confident",
            "--objective",
            "variables-and-assignment=transfer",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((course / "records" / "0001-feedback.md").exists())

    def test_pending_record_cannot_update_mastery(self) -> None:
        course = self.copy_course()
        capture = run_script(COURSE_UPDATE, course, "--lesson", 1, "--feedback-text", "I feel confident")
        self.assertEqual(capture.returncode, 0, capture.stdout + capture.stderr)
        update = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            "records/0001-feedback.md",
            "--objective",
            "variables-and-assignment=transfer",
        )
        self.assertNotEqual(update.returncode, 0)
        state = load_yaml(course / "course.yaml")
        self.assertEqual(state["objectives"][0]["mastery"], "unseen")

    def test_finalized_record_updates_known_objective_and_validates(self) -> None:
        course = self.copy_course()
        self.finalized_record(course, "variables-and-assignment", "application")
        update = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            "records/0001-feedback.md",
            "--objective",
            "variables-and-assignment=application",
        )
        self.assertEqual(update.returncode, 0, update.stdout + update.stderr)
        validation = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_unknown_objective_and_unearned_completion_are_rejected(self) -> None:
        course = self.copy_course()
        self.finalized_record(course, "ghost-objective", "transfer")
        unknown = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            "records/0001-feedback.md",
            "--objective",
            "ghost-objective=transfer",
        )
        self.assertNotEqual(unknown.returncode, 0)
        complete = run_script(COURSE_UPDATE, course, "--status", "complete")
        self.assertNotEqual(complete.returncode, 0)

    def test_historical_evidence_remains_valid_after_mastery_advances(self) -> None:
        course = self.copy_course()
        first = self.finalized_record(course, "variables-and-assignment", "application")
        application = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            first.relative_to(course),
            "--objective",
            "variables-and-assignment=application",
        )
        self.assertEqual(application.returncode, 0, application.stdout + application.stderr)

        second = self.finalized_record(
            course,
            "variables-and-assignment",
            "transfer",
            "0001-transfer.md",
        )
        transfer = run_script(
            COURSE_UPDATE,
            course,
            "--evidence-record",
            second.relative_to(course),
            "--objective",
            "variables-and-assignment=transfer",
        )
        self.assertEqual(transfer.returncode, 0, transfer.stdout + transfer.stderr)
        validation = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_current_lesson_requires_a_lesson_file(self) -> None:
        course = self.copy_course()
        state = load_yaml(course / "course.yaml")
        state["current_lesson"] = 2
        dump_yaml(course / "course.yaml", state)
        result = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no matching lesson file", result.stdout)

    def test_state_replace_failure_rolls_back_new_record(self) -> None:
        course = self.copy_course()
        state_before = (course / "course.yaml").read_bytes()

        spec = importlib.util.spec_from_file_location("update_progress", COURSE_UPDATE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        argv = [
            "update_progress.py",
            str(course),
            "--lesson",
            "1",
            "--feedback-text",
            "I feel confident",
        ]
        with mock.patch.object(module.os, "replace", side_effect=OSError("simulated replace failure")):
            with mock.patch.object(sys, "argv", argv):
                with self.assertRaises(SystemExit):
                    module.main()

        # the pending record is rolled back so the package has no orphan
        # record without a last_feedback association; state stays untouched
        self.assertFalse((course / "records" / "0001-feedback.md").exists())
        self.assertEqual((course / "course.yaml").read_bytes(), state_before)


class ExamPrepInvariantTests(PackageTestCase):
    def test_example_is_valid(self) -> None:
        exam = self.copy_exam()
        result = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_readiness_requires_a_finalized_record(self) -> None:
        exam = self.copy_exam()
        result = run_script(EXAM_UPDATE, exam, "--readiness", "accuracy=100,confidence=high")
        self.assertNotEqual(result.returncode, 0)
        state = load_yaml(exam / "exam.yaml")
        self.assertEqual(state["readiness"]["accuracy"], 67)

    def test_finalized_record_can_update_measured_readiness(self) -> None:
        exam = self.copy_exam()
        result = run_script(
            EXAM_UPDATE,
            exam,
            "--readiness",
            "accuracy=70,confidence=medium",
            "--evidence-record",
            "records/R0001.md",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        validation = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_material_counts_must_match_package(self) -> None:
        exam = self.copy_exam()
        state = load_yaml(exam / "exam.yaml")
        state["materials"]["question_count"] = 999
        dump_yaml(exam / "exam.yaml", state)
        result = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("package contains 3", result.stdout)

    def test_schema_v1_is_not_silently_rewritten(self) -> None:
        exam = self.copy_exam()
        state = load_yaml(exam / "exam.yaml")
        state["schema_version"] = 1
        dump_yaml(exam / "exam.yaml", state)
        result = run_script(EXAM_UPDATE, exam, "--mode", "plan")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(load_yaml(exam / "exam.yaml")["schema_version"], 1)

    def test_synthetic_only_evidence_cannot_set_high_confidence(self) -> None:
        exam = self.copy_exam()
        bank = exam / "question-bank" / "questions.jsonl"
        items = [json.loads(line) for line in bank.read_text(encoding="utf-8").splitlines() if line.strip()]
        for item in items:
            item["synthetic"] = True
            item["source"] = "synthetic"
        bank.write_text("".join(json.dumps(item) + "\n" for item in items), encoding="utf-8")

        state = load_yaml(exam / "exam.yaml")
        state["status"] = "provisional"
        state["readiness"] = {
            "accuracy": 0,
            "speed": 0,
            "coverage": 0,
            "stability": 0,
            "confidence": "low",
        }
        state["readiness_evidence"] = []
        dump_yaml(exam / "exam.yaml", state)
        sync = run_script(EXAM_UPDATE, exam, "--sync-materials")
        self.assertEqual(sync.returncode, 0, sync.stdout + sync.stderr)

        record = exam / "records" / "synthetic.md"
        record.write_text(
            """---
record_schema: 1
assessment_status: finalized
record_id: synthetic
mode: drill
attempted_at: 2026-08-24
metrics:
  - accuracy
source_backed: false
synthetic: true
---
# Synthetic drill
""",
            encoding="utf-8",
        )
        result = run_script(
            EXAM_UPDATE,
            exam,
            "--readiness",
            "accuracy=100,confidence=high",
            "--evidence-record",
            "records/synthetic.md",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(load_yaml(exam / "exam.yaml")["readiness"]["confidence"], "low")


if __name__ == "__main__":
    unittest.main()
