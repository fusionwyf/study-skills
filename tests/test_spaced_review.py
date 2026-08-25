from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

import yaml


ROOT = Path(__file__).resolve().parents[1]
BUILD_SESSION = ROOT / "spaced-review" / "scripts" / "build_review_session.py"
COMPLETE_REVIEW = ROOT / "spaced-review" / "scripts" / "complete_review.py"
SHARED_VALIDATE = ROOT / "shared" / "scripts" / "validate_record.py"
COURSE_VALIDATE = ROOT / "learning-course" / "scripts" / "validate_course.py"
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


def inject_due_entry(state_path: Path, key: str, target: str) -> None:
    state = load_yaml(state_path)
    state["review_queue"] = [
        {
            key: target,
            "due_at": "2026-01-01T00:00:00Z",
            "interval_days": 3,
            "review_count": 0,
        }
    ]
    dump_yaml(state_path, state)


class SpacedReviewTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def copy_course(self, name: str = "course") -> Path:
        target = self.root / name
        shutil.copytree(ROOT / "learning-course" / "assets" / "example-course", target)
        return target

    def copy_exam(self, name: str = "exam") -> Path:
        target = self.root / name
        shutil.copytree(ROOT / "exam-prep" / "assets" / "example-exam", target)
        return target


class BuildReviewSessionTests(SpacedReviewTestCase):
    def test_due_entry_is_detected_and_first_review_suggests_retrieval(self) -> None:
        course = self.copy_course()
        inject_due_entry(course / "course.yaml", "objective_id", "variables-and-assignment")
        result = run_script(BUILD_SESSION, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        session = yaml.safe_load(result.stdout)
        self.assertEqual(session["kind"], "course")
        self.assertEqual(len(session["items"]), 1)
        item = session["items"][0]
        self.assertEqual(item["target"], "variables-and-assignment")
        self.assertEqual(item["review_count"], 0)
        self.assertEqual(item["suggested_review_kind"], "retrieval")

    def test_empty_queue_yields_empty_items_and_exit_zero(self) -> None:
        course = self.copy_course()
        result = run_script(BUILD_SESSION, course)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        session = yaml.safe_load(result.stdout)
        self.assertEqual(session["items"], [])

    def test_missing_state_fails_with_clear_message(self) -> None:
        empty = self.root / "empty"
        empty.mkdir()
        result = run_script(BUILD_SESSION, empty)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no course.yaml or exam.yaml", result.stderr)


class CompleteReviewCourseTests(SpacedReviewTestCase):
    def complete(self, course: Path, performance: str, kind: str = "variation"):
        return run_script(
            COMPLETE_REVIEW,
            course,
            "--objective-id",
            "variables-and-assignment",
            "--review-kind",
            kind,
            "--performance",
            performance,
            "--hint-used",
            "false",
            "--evidence-strength",
            "strong",
            "--raw-answer",
            "x = 10 后 print(x * 2)，我预测输出 20，并解释了重新赋值会覆盖旧值。",
        )

    def test_happy_path_writes_valid_record_and_updates_queue(self) -> None:
        course = self.copy_course()
        inject_due_entry(course / "course.yaml", "objective_id", "variables-and-assignment")
        result = self.complete(course, "good")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        records = list((course / "records").glob("RV*.md"))
        self.assertEqual(len(records), 1)
        record = records[0]

        shared = run_script(SHARED_VALIDATE, record, "--type", "review")
        self.assertEqual(shared.returncode, 0, shared.stdout + shared.stderr)

        state = load_yaml(course / "course.yaml")
        entry = state["review_queue"][0]
        self.assertEqual(entry["review_count"], 1)
        self.assertEqual(entry["last_record"], ("records/" + record.name))
        self.assertIn("last_reviewed_at", entry)
        due_at = datetime.fromisoformat(entry["due_at"].replace("Z", "+00:00"))
        self.assertGreater(due_at, datetime.now(timezone.utc))

        validation = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_good_and_poor_performance_yield_different_intervals(self) -> None:
        good_course = self.copy_course("course-good")
        inject_due_entry(good_course / "course.yaml", "objective_id", "variables-and-assignment")
        good = self.complete(good_course, "good")
        self.assertEqual(good.returncode, 0, good.stdout + good.stderr)

        poor_course = self.copy_course("course-poor")
        inject_due_entry(poor_course / "course.yaml", "objective_id", "variables-and-assignment")
        poor = self.complete(poor_course, "poor")
        self.assertEqual(poor.returncode, 0, poor.stdout + poor.stderr)

        good_state = load_yaml(good_course / "course.yaml")["review_queue"][0]
        poor_state = load_yaml(poor_course / "course.yaml")["review_queue"][0]
        self.assertGreater(
            int(good_state["interval_days"]),
            int(poor_state["interval_days"]),
        )
        self.assertNotEqual(good_state["due_at"], poor_state["due_at"])

    def test_unknown_objective_is_refused_without_writes(self) -> None:
        course = self.copy_course()
        result = run_script(
            COMPLETE_REVIEW,
            course,
            "--objective-id",
            "ghost-objective",
            "--review-kind",
            "retrieval",
            "--performance",
            "good",
            "--hint-used",
            "false",
            "--evidence-strength",
            "strong",
            "--raw-answer",
            "答案",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(list((course / "records").glob("RV*.md")))
        state = load_yaml(course / "course.yaml")
        self.assertEqual(state.get("review_queue"), [])
        self.assertNotIn("RV", str(state))

    def test_next_action_with_yaml_special_chars_is_serialized_safely(self) -> None:
        course = self.copy_course()
        inject_due_entry(course / "course.yaml", "objective_id", "variables-and-assignment")
        tricky = "复习: 第 5 章 # 重点（P(A|B) ≠ P(B|A)）"
        result = run_script(
            COMPLETE_REVIEW,
            course,
            "--objective-id",
            "variables-and-assignment",
            "--review-kind",
            "variation",
            "--performance",
            "medium",
            "--hint-used",
            "false",
            "--evidence-strength",
            "medium",
            "--raw-answer",
            "答案：变量重新赋值会覆盖旧值。",
            "--next-action",
            tricky,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        records = list((course / "records").glob("RV*.md"))
        self.assertEqual(len(records), 1)
        # the frontmatter must parse, and the value must round-trip unchanged
        frontmatter = yaml.safe_load(records[0].read_text(encoding="utf-8").split("---", 2)[1])
        self.assertEqual(frontmatter["next_action"], tricky)
        self.assertEqual(frontmatter["objective_id"], "variables-and-assignment")

        shared = run_script(SHARED_VALIDATE, records[0], "--type", "review")
        self.assertEqual(shared.returncode, 0, shared.stdout + shared.stderr)
        validation = run_script(COURSE_VALIDATE, course, "--strict-schema", "--pedagogical")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)


class CompleteReviewAtomicityTests(SpacedReviewTestCase):
    def load_module(self):
        spec = importlib.util.spec_from_file_location("complete_review", COMPLETE_REVIEW)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_state_replace_failure_rolls_back_record(self) -> None:
        course = self.copy_course()
        inject_due_entry(course / "course.yaml", "objective_id", "variables-and-assignment")
        state_before = load_yaml(course / "course.yaml")

        module = self.load_module()
        argv = [
            "complete_review.py",
            str(course),
            "--objective-id",
            "variables-and-assignment",
            "--review-kind",
            "variation",
            "--performance",
            "good",
            "--hint-used",
            "false",
            "--evidence-strength",
            "strong",
            "--raw-answer",
            "答案",
        ]
        with mock.patch.object(module.os, "replace", side_effect=OSError("simulated replace failure")):
            with mock.patch.object(sys, "argv", argv):
                rc = module.main()

        self.assertNotEqual(rc, 0)
        # no orphan finalized record, no half-updated queue
        self.assertFalse(list((course / "records").glob("RV*.md")))
        self.assertEqual(load_yaml(course / "course.yaml"), state_before)

    def test_record_write_failure_leaves_no_partial_record(self) -> None:
        course = self.copy_course()
        inject_due_entry(course / "course.yaml", "objective_id", "variables-and-assignment")
        state_before = load_yaml(course / "course.yaml")

        module = self.load_module()
        real_replace = module.os.replace
        calls = {"n": 0}

        def flaky_replace(src, dst):
            calls["n"] += 1
            if calls["n"] == 1:  # first replace is the record write
                raise OSError("simulated record write failure")
            return real_replace(src, dst)

        argv = [
            "complete_review.py",
            str(course),
            "--objective-id",
            "variables-and-assignment",
            "--review-kind",
            "variation",
            "--performance",
            "good",
            "--hint-used",
            "false",
            "--evidence-strength",
            "strong",
            "--raw-answer",
            "答案",
        ]
        with mock.patch.object(module.os, "replace", side_effect=flaky_replace):
            with mock.patch.object(sys, "argv", argv):
                rc = module.main()

        self.assertNotEqual(rc, 0)
        # no partial RV#### file and no leftover temp file; state untouched
        self.assertFalse(list((course / "records").glob("RV*.md")))
        self.assertFalse(list((course / "records").glob(".RV*.tmp")))
        self.assertEqual(load_yaml(course / "course.yaml"), state_before)


class CompleteReviewExamTests(SpacedReviewTestCase):
    def test_topic_upsert_then_validate_exam_passes(self) -> None:
        exam = self.copy_exam()
        inject_due_entry(exam / "exam.yaml", "topic", "conditional-probability")
        result = run_script(
            COMPLETE_REVIEW,
            exam,
            "--topic",
            "conditional-probability",
            "--review-kind",
            "error_discrimination",
            "--performance",
            "poor",
            "--hint-used",
            "true",
            "--evidence-strength",
            "medium",
            "--raw-answer",
            "我把 P(A|B) 和 P(B|A) 的分母搞混了。",
            "--next-action",
            "重做 Q0002 后限时完成一道条件概率新题。",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        records = list((exam / "records").glob("RV*.md"))
        self.assertEqual(len(records), 1)
        shared = run_script(SHARED_VALIDATE, records[0], "--type", "review")
        self.assertEqual(shared.returncode, 0, shared.stdout + shared.stderr)

        state = load_yaml(exam / "exam.yaml")
        entry = state["review_queue"][0]
        self.assertEqual(entry["topic"], "conditional-probability")
        self.assertEqual(entry["review_count"], 1)
        self.assertTrue(entry["last_record"].startswith("records/RV"))

        validation = run_script(EXAM_VALIDATE, exam, "--strict-schema")
        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)


if __name__ == "__main__":
    unittest.main()
