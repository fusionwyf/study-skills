#!/usr/bin/env python3
import argparse
import datetime as dt
import re
import sys
from pathlib import Path


DIRS = [
    "source-materials",
    "question-bank",
    "drills",
    "mock-exams",
    "records",
    "exports",
]


def yaml_quote(value):
    if value is None:
        return "null"
    text = str(value).replace("\\", "\\\\").replace('"', '\"')
    return '"' + text + '"'


def safe_title_from_path(path):
    name = path.name.strip() or "Exam Prep"
    name = re.sub(r"[-_]+", " ", name)
    return name.title()


def write_if_missing(path, content):
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main():
    parser = argparse.ArgumentParser(description="Initialize an exam-prep package.")
    parser.add_argument("exam_dir", help="Directory for the exam-prep package.")
    parser.add_argument("--title", help="Human-readable exam title.")
    parser.add_argument("--exam-date", default=None, help="Exam date, if known.")
    parser.add_argument("--target-score", default=None, help="Target score, if known.")
    args = parser.parse_args()

    target = Path(args.exam_dir).expanduser().resolve()
    if target.exists() and not target.is_dir():
        print("ERROR: target exists and is not a directory: " + str(target), file=sys.stderr)
        return 1

    target.mkdir(parents=True, exist_ok=True)
    for dirname in DIRS:
        (target / dirname).mkdir(exist_ok=True)

    today = dt.date.today().isoformat()
    title = args.title or safe_title_from_path(target)
    status = "provisional"

    exam_yaml = f"""schema_version: 2
title: {yaml_quote(title)}
status: {status}
mode: diagnose
created_at: {yaml_quote(today)}
updated_at: {yaml_quote(today)}
exam_date: {yaml_quote(args.exam_date)}
target_score: {yaml_quote(args.target_score)}
time_budget:
  total_hours: null
  sessions_per_week: null
materials:
  source_count: 0
  question_count: 0
  synthetic_count: 0
readiness:
  accuracy: 0
  speed: 0
  coverage: 0
  stability: 0
  confidence: low
readiness_evidence: []
notes:
  - "Initial package created by exam-prep."
"""

    plan_md = f"""# {title} Exam Prep Plan

## Exam Profile

- Status: {status}
- Exam date:
- Target score:
- Time budget:
- Known sources:

## Current Readiness

- Accuracy: 0
- Speed: 0
- Coverage: 0
- Stability: 0
- Confidence: low

## Plan

1. Register exam materials.
2. Extract or review question bank.
3. Run diagnostic drill.
4. Review mistakes with user-confirmed causes.
5. Schedule drills, mocks, and cram review.

## Open Questions

- What official scope or syllabus is available?
- What past papers, samples, or question sets should be prioritized?
- What date and target score should drive the schedule?
"""

    sources_md = """# Sources

| source_id | title/file | type | date_received | reliability | coverage_notes |
| --- | --- | --- | --- | --- | --- |
"""

    error_log_md = """# Error Log

## high-yield_errors

## recurring_patterns

## one-off_mistakes

## needs_relearn

## resolved
"""

    created = []
    for rel_path, content in [
        ("exam.yaml", exam_yaml),
        ("PLAN.md", plan_md),
        ("SOURCES.md", sources_md),
        ("error-log.md", error_log_md),
    ]:
        if write_if_missing(target / rel_path, content):
            created.append(rel_path)

    print("Initialized exam package: " + str(target))
    if created:
        print("Created files: " + ", ".join(created))
    else:
        print("No existing files were overwritten.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
