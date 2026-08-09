#!/usr/bin/env python3
"""Update schema-v3 course state and optionally save one learner record."""

from __future__ import annotations

import argparse
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


MASTERY_VALUES = {"unseen", "recognition", "application", "transfer", "uncertain"}
PHASE_VALUES = {"diagnostic", "designing", "teaching", "awaiting_evidence", "review_due", "recovery"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_yaml(path: Path) -> tuple[Any, Any]:
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise SystemExit("update_progress.py requires PyYAML") from exc
    try:
        with path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}, yaml
    except Exception as exc:
        raise SystemExit(f"course.yaml cannot be parsed; enter recovery: {exc}") from exc


def atomic_dump(path: Path, data: Any, yaml: Any) -> None:
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            yaml.safe_dump(data, handle, allow_unicode=True, sort_keys=False, default_flow_style=False)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def parse_objective(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise SystemExit("--objective expects OBJECTIVE_ID=MASTERY")
    objective_id, mastery = value.split("=", 1)
    objective_id = objective_id.strip()
    if not objective_id:
        raise SystemExit("objective ID cannot be empty")
    if mastery not in MASTERY_VALUES:
        raise SystemExit(f"unknown mastery {mastery!r}; use one of {sorted(MASTERY_VALUES)}")
    return objective_id, mastery


def adjusted_interval(base: int, performance: str | None) -> int:
    base = max(1, base)
    if performance == "good":
        return min(60, base * 2)
    if performance == "poor":
        return max(1, base // 2)
    return base


def record_relative(root: Path, value: str) -> tuple[Path, str]:
    candidate = Path(value)
    path = (root / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()
    records = (root / "records").resolve()
    try:
        relative = path.relative_to(records)
    except ValueError as exc:
        raise SystemExit("evidence records must be inside records/") from exc
    if not path.is_file():
        raise SystemExit(f"evidence record does not exist: {path}")
    return path, (Path("records") / relative).as_posix()


def make_record(args: argparse.Namespace, record_path: Path, objectives: list[tuple[str, str]]) -> str | None:
    if args.feedback_file:
        source = Path(args.feedback_file).expanduser().resolve()
        if not source.is_file():
            raise SystemExit(f"feedback file does not exist: {source}")
        raw = source.read_text(encoding="utf-8")
    elif args.feedback_text:
        raw = args.feedback_text
    else:
        return None

    if record_path.exists() and not args.force:
        raise SystemExit(f"feedback record already exists: {record_path}; pass --force to replace")
    judgments = [f"  - {objective_id}: {mastery}" for objective_id, mastery in objectives] or ["  - 尚未判断 mastery。"]
    content = f"""# 第 {args.lesson:04d} 课学习记录

## 学习者原始反馈

{raw.rstrip()}

## 可观察行为

- 回答了什么：待 Agent 根据原始反馈填写。
- 正确性或产物结果：待判断。
- 是否使用提示：待判断。
- 是否包含解释或迁移：待判断。

## Agent 判断

- evidence_type: {args.evidence_type}
- evidence_strength: {args.evidence_strength}
- 支持的 mastery:
{chr(10).join(judgments)}
- 仍不确定：待 Agent 补充。
"""
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path.write_text(content, encoding="utf-8", newline="\n")
    return record_path.as_posix()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir")
    parser.add_argument("--lesson", type=int, help="Current lesson number")
    parser.add_argument("--phase", choices=tuple(sorted(PHASE_VALUES)))
    parser.add_argument("--status", choices=("draft", "active", "paused", "complete"))
    parser.add_argument("--feedback-file")
    parser.add_argument("--feedback-text")
    parser.add_argument("--evidence-record", help="Existing path inside records/")
    parser.add_argument("--objective", action="append", help="OBJECTIVE_ID=MASTERY; may be repeated")
    parser.add_argument("--evidence-type", default="learner-feedback")
    parser.add_argument("--evidence-strength", choices=("weak", "medium", "strong"), default="medium")
    parser.add_argument("--review", action="append", help="Objective ID to schedule for review")
    parser.add_argument("--review-days", type=int)
    parser.add_argument("--performance", choices=("good", "ok", "poor"))
    parser.add_argument("--due-lesson", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    root = Path(args.course_dir).expanduser().resolve()
    state_path = root / "course.yaml"
    if not state_path.is_file():
        raise SystemExit("course.yaml is missing; enter recovery before updating progress")
    state, yaml = load_yaml(state_path)
    if not isinstance(state, dict):
        raise SystemExit("course.yaml root must be a mapping")
    if state.get("schema_version") != 3:
        raise SystemExit("course.yaml must use schema_version 3; enter recovery instead of migrating automatically")
    if args.performance and not args.review:
        raise SystemExit("--performance requires at least one --review objective")
    if args.feedback_file and args.feedback_text:
        raise SystemExit("use only one of --feedback-file or --feedback-text")
    if args.evidence_record and (args.feedback_file or args.feedback_text):
        raise SystemExit("use either a new feedback record or --evidence-record, not both")

    lesson = args.lesson if args.lesson is not None else int(state.get("current_lesson") or 0)
    parsed_objectives = [parse_objective(raw) for raw in (args.objective or [])]
    if (args.feedback_file or args.feedback_text) and lesson <= 0:
        raise SystemExit("feedback updates require a positive lesson number")
    args.lesson = lesson

    record_path = root / "records" / f"{lesson:04d}-feedback.md"
    generated = make_record(args, record_path, parsed_objectives)
    evidence_relative: str | None = None
    if generated:
        _, evidence_relative = record_relative(root, generated)
    elif args.evidence_record:
        _, evidence_relative = record_relative(root, args.evidence_record)

    for _, mastery in parsed_objectives:
        if mastery != "uncertain" and not evidence_relative:
            raise SystemExit("mastery updates other than uncertain require an existing evidence record")

    changed = False
    if args.lesson is not None and args.lesson != state.get("current_lesson"):
        state["current_lesson"] = args.lesson
        changed = True
    if args.phase:
        state["phase"] = args.phase
        changed = True
    if args.status:
        state["status"] = args.status
        changed = True

    objectives = state.setdefault("objectives", [])
    for objective_id, mastery in parsed_objectives:
        target = next((item for item in objectives if isinstance(item, dict) and item.get("id") == objective_id), None)
        if target is None:
            target = {"id": objective_id, "statement": "unknown", "mastery": "uncertain", "evidence": []}
            objectives.append(target)
        target["mastery"] = mastery
        if evidence_relative:
            target.setdefault("evidence", []).append({"record": evidence_relative, "type": args.evidence_type, "strength": args.evidence_strength})
        changed = True

    if args.review:
        queue = state.setdefault("review_queue", [])
        for objective_id in args.review:
            existing = next((item for item in queue if isinstance(item, dict) and item.get("objective_id") == objective_id), None)
            if existing is None:
                existing = {"objective_id": objective_id}
                queue.append(existing)
            current_interval = int(existing.get("interval_days", 3) or 3)
            interval = adjusted_interval(args.review_days if args.review_days is not None else current_interval, args.performance)
            existing.update({
                "due_at": (date.today() + timedelta(days=interval)).isoformat(),
                "interval_days": interval,
                "review_count": int(existing.get("review_count", 0)) + 1,
            })
            if args.due_lesson is not None:
                existing["due_lesson"] = args.due_lesson
            changed = True

    if evidence_relative:
        state["last_feedback"] = evidence_relative
        if state.get("phase") == "awaiting_evidence":
            state["phase"] = "designing"
        changed = True

    if not changed:
        raise SystemExit("no update requested")
    state["updated_at"] = now_iso()
    atomic_dump(state_path, state, yaml)
    print(state_path)
    if generated:
        print(record_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
