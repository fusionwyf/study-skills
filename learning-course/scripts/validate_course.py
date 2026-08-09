#!/usr/bin/env python3
"""Validate a schema-v3 learning-course package and its explicit HTML contract."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit


REQUIRED_DIRS = ("lessons", "assets", "reference", "records", "exports")
REQUIRED_FILES = ("course.yaml", "PLAN.md", "INDEX.md", "index.html")
LINK_RE = re.compile(r"(?:href|src)\s*=\s*[\"']([^\"']+)[\"']", re.I)
LESSON_RE = re.compile(r"^(\d{4})-[a-z0-9\u4e00-\u9fff-]+\.html$", re.I)
PHASES = {"diagnostic", "designing", "teaching", "awaiting_evidence", "review_due", "recovery"}
STATUSES = {"draft", "active", "paused", "complete"}
MASTERY_VALUES = {"unseen", "recognition", "application", "transfer", "uncertain"}
COGNITIVE_LEVELS = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
EVIDENCE_STRENGTHS = {"weak", "medium", "strong"}
CONDITIONAL_VALUES = {
    "retrieval": {"required", "not-applicable"},
    "feedback": {"required", "not-applicable"},
    "source-status": {"verified", "not-needed", "unverified"},
    "answer-status": {"provided", "not-applicable"},
}


def data_value(body: str, name: str) -> str | None:
    match = re.search(rf"data-{re.escape(name)}\s*=\s*[\"']([^\"']*)[\"']", body, re.I)
    return match.group(1).strip().lower() if match else None


def has_data_role(body: str, role: str) -> bool:
    return re.search(rf"data-role\s*=\s*[\"'][^\"']*\b{re.escape(role)}\b[^\"']*[\"']", body, re.I) is not None


def validate_record(root: Path, value: object, label: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value:
        errors.append(f"{label} must be a records/ path")
        return
    target = (root / value).resolve()
    try:
        target.relative_to((root / "records").resolve())
    except ValueError:
        errors.append(f"{label} escapes records/: {value}")
        return
    if not target.is_file():
        errors.append(f"{label} does not exist: {value}")


def validate_yaml_schema(path: Path, root: Path, errors: list[str], warnings: list[str]) -> None:
    try:
        import yaml  # type: ignore
    except ImportError:
        errors.append("--strict-schema requires PyYAML")
        return
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"course.yaml cannot be parsed: {exc}")
        return
    if not isinstance(state, dict):
        errors.append("course.yaml root must be a mapping")
        return
    if state.get("schema_version") != 3:
        errors.append(f"course.yaml must use schema_version 3, got {state.get('schema_version')!r}")
    if state.get("status") not in STATUSES:
        errors.append(f"invalid status: {state.get('status')!r}")
    if state.get("phase") not in PHASES:
        errors.append(f"invalid phase: {state.get('phase')!r}")
    if not isinstance(state.get("current_lesson"), int):
        errors.append("current_lesson must be an integer")
    if not isinstance(state.get("learner"), dict):
        errors.append("schema v3 requires learner mapping")
    for removed in ("feedback_status", "mode", "roadmap", "next_lesson", "checkpoint", "mastery"):
        if removed in state:
            errors.append(f"schema v3 removed top-level field: {removed}")

    diagnostic = state.get("diagnostic")
    if not isinstance(diagnostic, dict):
        errors.append("diagnostic must be a mapping")
    else:
        if diagnostic.get("status") not in {"pending", "complete", "skipped"}:
            errors.append(f"invalid diagnostic status: {diagnostic.get('status')!r}")
        if diagnostic.get("record") is not None:
            validate_record(root, diagnostic.get("record"), "diagnostic.record", errors)

    last_feedback = state.get("last_feedback")
    if last_feedback is not None:
        validate_record(root, last_feedback, "last_feedback", errors)

    objectives = state.get("objectives", [])
    if not isinstance(objectives, list):
        errors.append("objectives must be a list")
    else:
        for index, objective in enumerate(objectives):
            if not isinstance(objective, dict):
                errors.append(f"objectives[{index}] must be a mapping")
                continue
            mastery = objective.get("mastery")
            if mastery not in MASTERY_VALUES:
                errors.append(f"objectives[{index}] has invalid mastery")
            cognitive = objective.get("cognitive_level")
            if cognitive is not None and cognitive not in COGNITIVE_LEVELS:
                errors.append(f"objectives[{index}] has invalid cognitive_level")
            evidence = objective.get("evidence", [])
            if not isinstance(evidence, list):
                errors.append(f"objectives[{index}].evidence must be a list")
                continue
            if mastery in {"recognition", "application", "transfer"} and not evidence:
                errors.append(f"objectives[{index}] mastery {mastery!r} requires evidence")
            for evidence_index, item in enumerate(evidence):
                if not isinstance(item, dict):
                    errors.append(f"objectives[{index}].evidence[{evidence_index}] must be a mapping")
                    continue
                validate_record(root, item.get("record"), f"objectives[{index}].evidence[{evidence_index}].record", errors)
                if not isinstance(item.get("type"), str) or not item.get("type"):
                    errors.append(f"objectives[{index}].evidence[{evidence_index}] missing type")
                if item.get("strength") not in EVIDENCE_STRENGTHS:
                    errors.append(f"objectives[{index}].evidence[{evidence_index}] invalid strength")

    queue = state.get("review_queue", [])
    if not isinstance(queue, list):
        errors.append("review_queue must be a list")
    else:
        for index, item in enumerate(queue):
            if not isinstance(item, dict):
                errors.append(f"review_queue[{index}] must be a mapping")
                continue
            for key in ("objective_id", "due_at", "interval_days", "review_count"):
                if key not in item:
                    warnings.append(f"review_queue[{index}] missing {key}")


def validate_pedagogy(lesson: Path, body: str, errors: list[str], warnings: list[str]) -> None:
    objective = data_value(body, "objective")
    evidence = data_value(body, "evidence")
    if not objective or not has_data_role(body, "objective"):
        errors.append(f"pedagogical check missing learning objective: {lesson.name}")
    if not evidence or not has_data_role(body, "evidence"):
        errors.append(f"pedagogical check missing evidence opportunity: {lesson.name}")

    cognitive = data_value(body, "cognitive-level")
    if cognitive is not None and cognitive not in COGNITIVE_LEVELS:
        errors.append(f"invalid data-cognitive-level in lesson: {lesson.name}")

    values: dict[str, str | None] = {}
    for name, allowed in CONDITIONAL_VALUES.items():
        value = data_value(body, name)
        values[name] = value
        if value not in allowed:
            errors.append(f"invalid or missing data-{name} in lesson: {lesson.name}")

    if values.get("retrieval") == "required" and not has_data_role(body, "retrieval"):
        errors.append(f"retrieval is required but missing: {lesson.name}")
    if values.get("feedback") == "required" and not has_data_role(body, "learner-feedback"):
        errors.append(f"learner feedback is required but missing: {lesson.name}")
    if values.get("answer-status") == "provided" and not has_data_role(body, "answer-feedback"):
        errors.append(f"answer feedback is provided but missing: {lesson.name}")
    if values.get("source-status") in {"verified", "unverified"} and not has_data_role(body, "sources"):
        errors.append(f"sources are declared but missing: {lesson.name}")
    if values.get("source-status") == "unverified":
        warnings.append(f"lesson contains unverified sources: {lesson.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    parser.add_argument("--pedagogical", action="store_true")
    parser.add_argument("--strict-schema", action="store_true")
    args = parser.parse_args()

    root = Path(args.course_dir).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []
    if not root.is_dir():
        print(f"ERROR: course directory does not exist: {root}")
        return 1
    for name in REQUIRED_DIRS:
        if not (root / name).is_dir():
            errors.append(f"missing directory: {name}/")
    for name in REQUIRED_FILES:
        if not (root / name).is_file():
            errors.append(f"missing file: {name}")

    yaml_path = root / "course.yaml"
    if yaml_path.is_file():
        text = yaml_path.read_text(encoding="utf-8", errors="replace")
        for key in ("schema_version", "course_id", "title", "status", "phase", "current_lesson", "learner", "diagnostic", "objectives", "review_queue", "last_feedback"):
            if not re.search(rf"^{re.escape(key)}\s*:", text, re.M):
                errors.append(f"course.yaml missing top-level key: {key}")
        if args.strict_schema:
            validate_yaml_schema(yaml_path, root, errors, warnings)

    lesson_dir = root / "lessons"
    lessons = sorted(lesson_dir.glob("*.html")) if lesson_dir.is_dir() else []
    numbers: list[int] = []
    for lesson in lessons:
        match = LESSON_RE.match(lesson.name)
        if not match:
            errors.append(f"invalid lesson filename: lessons/{lesson.name}")
        else:
            numbers.append(int(match.group(1)))
        body = lesson.read_text(encoding="utf-8", errors="replace")
        if args.pedagogical:
            validate_pedagogy(lesson, body, errors, warnings)
        for link in LINK_RE.findall(body):
            parsed = urlsplit(link)
            if parsed.scheme or link.startswith("#") or link.startswith("//"):
                if parsed.scheme in {"http", "https"}:
                    warnings.append(f"external network dependency: {lesson.name} -> {link}")
                continue
            target = (lesson.parent / link.split("#", 1)[0]).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                errors.append(f"link escapes course directory: {lesson.name} -> {link}")
                continue
            if link.split("#", 1)[0] and not target.exists():
                errors.append(f"missing local link: {lesson.name} -> {link}")

    if numbers and numbers != list(range(1, len(numbers) + 1)):
        errors.append(f"lesson numbers are not continuous from 0001: {numbers}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    if args.strict and warnings:
        return 1
    print(f"OK: {root} ({len(lessons)} lesson(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
