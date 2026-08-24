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


def validate_record(root: Path, value: object, label: str, errors: list[str]) -> Path | None:
    if not isinstance(value, str) or not value:
        errors.append(f"{label} must be a records/ path")
        return None
    target = (root / value).resolve()
    try:
        target.relative_to((root / "records").resolve())
    except ValueError:
        errors.append(f"{label} escapes records/: {value}")
        return None
    if not target.is_file():
        errors.append(f"{label} does not exist: {value}")
        return None
    return target


def record_metadata(path: Path, yaml: object, label: str, errors: list[str]) -> dict[str, object] | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        errors.append(f"{label} is missing YAML frontmatter")
        return None
    parts = text.split("---", 2)
    if len(parts) != 3:
        errors.append(f"{label} has invalid YAML frontmatter")
        return None
    try:
        metadata = yaml.safe_load(parts[1]) or {}  # type: ignore[attr-defined]
    except Exception as exc:
        errors.append(f"{label} frontmatter cannot be parsed: {exc}")
        return None
    if not isinstance(metadata, dict):
        errors.append(f"{label} frontmatter must be a mapping")
        return None
    if metadata.get("assessment_status") == "finalized" and any(
        marker in text for marker in ("待 Agent", "待判断", "待补充")
    ):
        errors.append(f"{label} finalized record still contains assessment placeholders")
    return metadata


def validate_yaml_schema(
    path: Path,
    root: Path,
    lesson_numbers: list[int],
    lesson_objectives: set[str],
    errors: list[str],
    warnings: list[str],
) -> None:
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
    current_lesson = state.get("current_lesson")
    if not isinstance(current_lesson, int):
        errors.append("current_lesson must be an integer")
    elif current_lesson < 0:
        errors.append("current_lesson must be >= 0")
    elif current_lesson > 0 and current_lesson not in lesson_numbers:
        errors.append(f"current_lesson {current_lesson:04d} has no matching lesson file")
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
    objective_ids: set[str] = set()
    if not isinstance(objectives, list):
        errors.append("objectives must be a list")
    else:
        for index, objective in enumerate(objectives):
            if not isinstance(objective, dict):
                errors.append(f"objectives[{index}] must be a mapping")
                continue
            objective_id = objective.get("id")
            if not isinstance(objective_id, str) or not objective_id:
                errors.append(f"objectives[{index}] missing id")
            elif objective_id in objective_ids:
                errors.append(f"duplicate objective id: {objective_id}")
            else:
                objective_ids.add(objective_id)
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
            supports_current_mastery = False
            for evidence_index, item in enumerate(evidence):
                if not isinstance(item, dict):
                    errors.append(f"objectives[{index}].evidence[{evidence_index}] must be a mapping")
                    continue
                label = f"objectives[{index}].evidence[{evidence_index}]"
                target = validate_record(root, item.get("record"), f"{label}.record", errors)
                if not isinstance(item.get("type"), str) or not item.get("type"):
                    errors.append(f"{label} missing type")
                if item.get("strength") not in EVIDENCE_STRENGTHS:
                    errors.append(f"{label} invalid strength")
                evidence_mastery = item.get("mastery")
                if evidence_mastery not in MASTERY_VALUES - {"unseen", "uncertain"}:
                    errors.append(f"{label} invalid or missing mastery")
                if evidence_mastery == mastery:
                    supports_current_mastery = True
                if target is not None:
                    metadata = record_metadata(target, yaml, label, errors)
                    if metadata is not None:
                        if metadata.get("record_schema") != 1 or metadata.get("assessment_status") != "finalized":
                            errors.append(f"{label} must reference a finalized record_schema 1 record")
                        if metadata.get("evidence_type") != item.get("type"):
                            errors.append(f"{label} type disagrees with record frontmatter")
                        if metadata.get("evidence_strength") != item.get("strength"):
                            errors.append(f"{label} strength disagrees with record frontmatter")
                        supported = metadata.get("supported_objectives")
                        supported_pairs = {
                            (entry.get("id"), entry.get("mastery"))
                            for entry in supported
                            if isinstance(entry, dict)
                        } if isinstance(supported, list) else set()
                        if (objective_id, evidence_mastery) not in supported_pairs:
                            errors.append(f"{label} record does not support {objective_id}={evidence_mastery}")
            if mastery in {"recognition", "application", "transfer"} and evidence and not supports_current_mastery:
                errors.append(f"objectives[{index}] current mastery {mastery!r} lacks matching evidence")

    missing_objectives = sorted(lesson_objectives - objective_ids)
    for objective_id in missing_objectives:
        errors.append(f"lesson references unknown objective: {objective_id}")

    if state.get("status") == "complete" and (
        not isinstance(objectives, list)
        or not objectives
        or any(
            not isinstance(item, dict)
            or item.get("mastery") in {"unseen", "uncertain", None}
            or not item.get("evidence")
            for item in objectives
        )
    ):
        errors.append("status complete requires evidence-backed mastery for every objective")

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
            if item.get("objective_id") not in objective_ids:
                errors.append(f"review_queue[{index}] references unknown objective")


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
    lesson_dir = root / "lessons"
    lessons = sorted(lesson_dir.glob("*.html")) if lesson_dir.is_dir() else []
    numbers: list[int] = []
    lesson_objectives: set[str] = set()
    for lesson in lessons:
        match = LESSON_RE.match(lesson.name)
        if not match:
            errors.append(f"invalid lesson filename: lessons/{lesson.name}")
        else:
            numbers.append(int(match.group(1)))
        body = lesson.read_text(encoding="utf-8", errors="replace")
        objective = data_value(body, "objective")
        if objective:
            lesson_objectives.add(objective)
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
    if yaml_path.is_file() and args.strict_schema:
        validate_yaml_schema(yaml_path, root, numbers, lesson_objectives, errors, warnings)
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
