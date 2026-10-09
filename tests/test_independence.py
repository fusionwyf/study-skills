from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared" / "scripts"))
from validate_record import contract_errors, recent_guided_records


def run(script: str, *args: object):
    return subprocess.run([sys.executable, str(ROOT / script), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8", cwd=ROOT)


def write_record(course: Path, name: str, mastery: str, independence: str | None,
                 attempted_at: str = "2026-10-09", record_id: str = "L0002") -> Path:
    fm = {"record_schema": 1, "assessment_status": "finalized", "record_id": record_id,
          "attempted_at": attempted_at, "source_backed": False, "synthetic": True,
          "lesson": 1, "evidence_type": "application", "evidence_strength": "strong",
          "supported_objectives": [{"id": "variables-and-assignment", "mastery": mastery}]}
    if independence is not None:
        fm["independence"] = independence
    p = course / "records" / name
    p.write_text("---\n" + yaml.safe_dump(fm, sort_keys=False) + "---\n\n## 原始回答\n\n我解释了条件并给出了反例。\n", encoding="utf-8")
    return p


class IndependenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def course(self, name="course"):
        target = self.root / name
        shutil.copytree(ROOT / "learning-course/assets/example-course", target)
        return target

    def test_mastery_update_matrix_refuses_insufficient_or_unknown_independence_without_writes(self):
        for independence in (None, "independent", "with_hints", "ai_guided"):
            for mastery in ("recognition", "application", "transfer"):
                with self.subTest(independence=independence, mastery=mastery):
                    course = self.course(f"{independence}-{mastery}")
                    record = write_record(course, "0002-attempt.md", mastery, independence)
                    before = (course / "course.yaml").read_bytes()
                    record_before = record.read_bytes()
                    result = run("learning-course/scripts/update_progress.py", course,
                                 "--evidence-record", record, "--objective", f"variables-and-assignment={mastery}")
                    allowed = mastery == "recognition" or independence == "independent" or (
                        mastery == "application" and independence == "with_hints")
                    if allowed:
                        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                        validation = run("learning-course/scripts/validate_course.py", course, "--strict-schema")
                        self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)
                    else:
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn("independence", result.stderr)
                        self.assertEqual((course / "course.yaml").read_bytes(), before)
                    self.assertEqual(record.read_bytes(), record_before)

    def test_legacy_application_state_warns_without_rewriting_but_known_guided_state_fails(self):
        course = self.course()
        record = write_record(course, "0002-old.md", "application", None)
        state_path = course / "course.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        state["objectives"][0].update(mastery="application", evidence=[{
            "record": "records/0002-old.md", "type": "application", "strength": "strong", "mastery": "application"}])
        state_path.write_text(yaml.safe_dump(state, sort_keys=False), encoding="utf-8")
        before = state_path.read_bytes(), record.read_bytes()
        result = run("learning-course/scripts/validate_course.py", course, "--strict-schema")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("legacy independence unknown", result.stdout)
        self.assertEqual((state_path.read_bytes(), record.read_bytes()), before)
        write_record(course, record.name, "application", "ai_guided")
        result = run("learning-course/scripts/validate_course.py", course, "--strict-schema")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("mastery application requires independence", result.stdout)

    def test_invalid_independence_rejected_by_all_shared_record_types(self):
        common = {"record_schema": 1, "assessment_status": "finalized", "record_id": "R0001",
                  "attempted_at": "2026-10-09", "source_backed": False, "synthetic": False,
                  "independence": "assumed_independent"}
        cases = [{"mode": "drill"}, {"lesson": 1, "evidence_type": "application", "evidence_strength": "strong",
                  "supported_objectives": []}, {"review_kind": "retrieval", "performance": "good", "hint_used": False,
                  "evidence_strength": "strong", "next_action": "retry", "objective_id": "test"}]
        for fields in cases:
            errors = contract_errors(common | fields)
            self.assertTrue(any("independence" in error for error in errors), errors)
        review = common | cases[-1] | {"independence": "independent", "hint_used": True}
        self.assertIn("independent evidence cannot have hint_used true", contract_errors(review))

    def test_new_course_completion_cannot_bypass_unknown_independence(self):
        course = self.course()
        record = write_record(course, "0002-legacy.md", "transfer", None)
        state_path = course / "course.yaml"
        state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
        state["objectives"][0].update(mastery="transfer", evidence=[{
            "record": "records/0002-legacy.md", "type": "application", "strength": "strong", "mastery": "transfer"}])
        state_path.write_text(yaml.safe_dump(state, sort_keys=False), encoding="utf-8")
        before = state_path.read_bytes()
        result = run("learning-course/scripts/update_progress.py", course, "--status", "complete")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("independence-qualified", result.stderr)
        self.assertEqual(state_path.read_bytes(), before)
        # Simulate new qualifying evidence, without editing the old finalized record.
        independent = write_record(course, "0003-independent.md", "transfer", "independent", record_id="L0003")
        result = run("learning-course/scripts/update_progress.py", course, "--evidence-record", independent,
                     "--objective", "variables-and-assignment=transfer", "--status", "complete")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("independence", record.read_text(encoding="utf-8"))

    def test_pending_capture_keeps_unknown_or_explicit_observed_independence(self):
        for value in (None, "with_hints"):
            course = self.course(str(value))
            extra = ("--independence", value) if value else ()
            result = run("learning-course/scripts/update_progress.py", course, "--lesson", 1,
                         "--feedback-text", "我的原始回答", *extra)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            record = (course / "records/0001-feedback.md").read_text(encoding="utf-8")
            fm = yaml.safe_load(record.split("---", 2)[1])
            self.assertEqual(fm["independence"], value)
            self.assertEqual(fm["assessment_status"], "pending")
            self.assertIn("我的原始回答", record)

    def test_guided_streak_uses_attempt_chronology_and_new_independent_attempt_breaks_it(self):
        records = [{"path": f"records/{name}.md", "fm": {"attempted_at": day, "record_id": rid, "independence": value}}
                   for name, day, rid, value in [("zzz-old", "2026-01-01", "L0001", "independent"),
                                                ("c", "2026-10-07", "L0002", "ai_guided"),
                                                ("b", "2026-10-08", "L0003", "ai_guided"),
                                                ("a", "2026-10-09", "L0004", "ai_guided")]]
        self.assertEqual([r["path"] for r in recent_guided_records(records)], ["records/c.md", "records/b.md", "records/a.md"])
        records.append({"path": "records/aaa-new.md", "fm": {"attempted_at": "2026-10-10", "record_id": "L0005", "independence": "independent"}})
        self.assertEqual(recent_guided_records(records), [])

    def test_report_does_not_confirm_guided_hinted_or_unknown_strong_evidence(self):
        for value in (None, "ai_guided", "with_hints", "independent"):
            course = self.course(str(value))
            for path in (course / "records").glob("*.md"):
                path.unlink()
            write_record(course, "0002-attempt.md", "recognition", value)
            result = run("study/scripts/build_report.py", course)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            if value == "independent":
                self.assertIn("[confirmed] variables-and-assignment", result.stdout)
            else:
                self.assertNotIn("[confirmed] variables-and-assignment", result.stdout)
                self.assertIn("[inferred] variables-and-assignment", result.stdout)
                self.assertIn(f"independence={value or 'unknown'}", result.stdout)

    def test_report_and_update_warn_after_three_guided_records(self):
        course = self.course()
        for index in range(2, 5):
            write_record(course, f"000{index}-guided.md", "recognition", "ai_guided", f"2026-10-0{index}", f"L{index:04d}")
        report = run("study/scripts/build_report.py", course)
        self.assertEqual(report.returncode, 0, report.stdout + report.stderr)
        self.assertIn("近期缺乏独立验证证据", report.stdout)
        update = run("learning-course/scripts/update_progress.py", course, "--phase", "designing")
        self.assertEqual(update.returncode, 0, update.stdout + update.stderr)
        self.assertIn("近期缺乏独立验证证据", update.stdout)

    def test_guided_review_does_not_extend_interval_and_contradictory_independent_hint_is_refused(self):
        course = self.course()
        initial = yaml.safe_load((course / "course.yaml").read_text(encoding="utf-8"))
        initial["review_queue"] = [{"objective_id": "variables-and-assignment", "due_at": "2026-10-09", "interval_days": 3, "review_count": 0}]
        (course / "course.yaml").write_text(yaml.safe_dump(initial, sort_keys=False), encoding="utf-8")
        args = (course, "--objective-id", "variables-and-assignment", "--review-kind", "transfer", "--performance", "good",
                "--evidence-strength", "strong", "--raw-answer", "在指导下完成")
        before = (course / "course.yaml").read_bytes()
        invalid = run("spaced-review/scripts/complete_review.py", *args, "--hint-used", "true", "--independence", "independent")
        self.assertNotEqual(invalid.returncode, 0)
        self.assertEqual((course / "course.yaml").read_bytes(), before)
        self.assertFalse(list((course / "records").glob("RV*.md")))
        guided = run("spaced-review/scripts/complete_review.py", *args, "--hint-used", "false", "--independence", "ai_guided")
        self.assertEqual(guided.returncode, 0, guided.stdout + guided.stderr)
        state = yaml.safe_load((course / "course.yaml").read_text(encoding="utf-8"))
        self.assertEqual(state["review_queue"][0]["interval_days"], 3)
        record = next((course / "records").glob("RV*.md"))
        fm = yaml.safe_load(record.read_text(encoding="utf-8").split("---", 2)[1])
        self.assertEqual(fm["independence"], "ai_guided")
        self.assertEqual(contract_errors(fm), [])


if __name__ == "__main__":
    unittest.main()
