#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


REQUIRED_FILES = ["exam.yaml", "PLAN.md", "SOURCES.md", "error-log.md"]
REQUIRED_DIRS = ["source-materials", "question-bank", "drills", "mock-exams", "records", "exports"]
REQUIRED_QUESTION_FIELDS = [
    "id",
    "source",
    "type",
    "topic",
    "difficulty",
    "estimated_time",
    "prompt",
    "answer_or_rubric",
    "status",
    "synthetic",
]
ALLOWED_STATUS = {"provisional", "confirmed", "archived"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
ALLOWED_QUESTION_STATUS = {"draft", "ready", "attempted", "reviewed", "retired"}
ALLOWED_QUESTION_TYPES = {"choice", "fill", "short", "essay", "calculation", "proof", "code", "other"}
REPO_ROOT = Path(__file__).resolve().parents[2]
RECORD_SCHEMA_PATH = REPO_ROOT / "shared" / "schemas" / "record.schema.yaml"
FINALIZED_STATUS = "finalized"  # member of the record contract's assessment_status vocabulary
# Only used when shared/schemas/record.schema.yaml cannot be read; the schema file stays
# the source of truth and failed loads are reported as errors in --strict-schema
# mode. Non-strict validation never imports PyYAML, so it always uses these values.
FALLBACK_VOCABULARIES = {
    "assessment_status": ["pending", "finalized"],
    "exam_mode": ["diagnose", "plan", "drill", "review", "mock", "cram", "postmortem"],
    "metric": ["accuracy", "speed", "coverage", "stability"],
}
ALLOWED_MODES = set(FALLBACK_VOCABULARIES["exam_mode"])


def load_record_vocabularies(errors):
    """Load enum vocabularies from the unified record schema (source of truth).

    Returns (vocabularies, yaml_module). vocabularies falls back to
    FALLBACK_VOCABULARIES when the schema cannot be read; the failure itself is
    reported as an error so the schema stays the source of truth.
    """
    try:
        import yaml
    except ImportError:
        errors.append("--strict-schema requires PyYAML; install pyyaml or run without --strict-schema")
        return dict(FALLBACK_VOCABULARIES), None
    try:
        schema = yaml.safe_load(RECORD_SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"record schema cannot be loaded from {RECORD_SCHEMA_PATH}: {exc}")
        return dict(FALLBACK_VOCABULARIES), yaml
    vocabularies = schema.get("vocabularies") if isinstance(schema, dict) else None
    if not isinstance(vocabularies, dict):
        errors.append("record schema does not define vocabularies")
        return dict(FALLBACK_VOCABULARIES), yaml
    return vocabularies, yaml


def read_text(path):
    return path.read_text(encoding="utf-8-sig")


def yaml_scalar(text, key):
    match = re.search(r"^" + re.escape(key) + r":\s*(.+?)\s*$", text, re.MULTILINE)
    return match.group(1).strip() if match else None


def parse_number(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def validate_score(name, value, errors):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        errors.append("readiness." + name + " must be numeric")
        return
    if not 0 <= float(value) <= 100:
        errors.append("readiness." + name + " must be between 0 and 100")


def validate_count(name, value, errors):
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        errors.append("materials." + name + " must be a non-negative integer")


def record_path(exam_dir, value, label, errors):
    if not isinstance(value, str) or not value:
        errors.append(label + " must be a records/ path")
        return None
    target = (exam_dir / value).resolve()
    try:
        target.relative_to((exam_dir / "records").resolve())
    except ValueError:
        errors.append(label + " escapes records/")
        return None
    if not target.is_file():
        errors.append(label + " does not exist: " + value)
        return None
    return target


def record_frontmatter(path, yaml, label, errors):
    text = read_text(path)
    if not text.startswith("---\n"):
        errors.append(label + " is missing YAML frontmatter")
        return None
    parts = text.split("---", 2)
    if len(parts) != 3:
        errors.append(label + " has invalid YAML frontmatter")
        return None
    try:
        metadata = yaml.safe_load(parts[1]) or {}
    except Exception as exc:
        errors.append(label + " frontmatter cannot be parsed: " + str(exc))
        return None
    if not isinstance(metadata, dict):
        errors.append(label + " frontmatter must be a mapping")
        return None
    return metadata


def registered_source_count(exam_dir):
    path = exam_dir / "SOURCES.md"
    if not path.is_file():
        return 0
    count = 0
    for line in read_text(path).splitlines():
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            if cells and cells[0] not in {"source_id", "---"} and not set(cells[0]) <= {"-", ":"}:
                count += 1
    return count


def strict_validate_exam_yaml(path, exam_dir, question_counts, errors, warnings):
    vocabularies, yaml = load_record_vocabularies(errors)
    if yaml is None:
        return
    assessment_statuses = set(vocabularies.get("assessment_status") or FALLBACK_VOCABULARIES["assessment_status"])
    exam_modes = set(vocabularies.get("exam_mode") or FALLBACK_VOCABULARIES["exam_mode"])
    evidence_metrics = set(vocabularies.get("metric") or FALLBACK_VOCABULARIES["metric"])
    if FINALIZED_STATUS not in assessment_statuses:
        errors.append(f"record schema does not define assessment_status value: {FINALIZED_STATUS}")

    try:
        data = yaml.safe_load(read_text(path))
    except Exception as exc:
        errors.append("exam.yaml is not valid YAML: " + str(exc))
        return

    if not isinstance(data, dict):
        errors.append("exam.yaml must be a YAML mapping")
        return

    required_top = [
        "schema_version",
        "title",
        "status",
        "mode",
        "created_at",
        "updated_at",
        "exam_date",
        "target_score",
        "time_budget",
        "materials",
        "readiness",
        "readiness_evidence",
        "notes",
    ]
    for key in required_top:
        if key not in data:
            errors.append("exam.yaml missing top-level key: " + key)

    if data.get("schema_version") != 2:
        errors.append("exam.yaml schema_version must be 2")
    if not isinstance(data.get("title"), str) or not data.get("title", "").strip():
        errors.append("exam.yaml title must be a non-empty string")
    if data.get("status") not in ALLOWED_STATUS:
        errors.append("exam.yaml status must be one of: " + ", ".join(sorted(ALLOWED_STATUS)))
    if data.get("mode") not in exam_modes:
        errors.append("exam.yaml mode must be one of: " + ", ".join(sorted(exam_modes)))
    for key in ["created_at", "updated_at"]:
        if not isinstance(data.get(key), str) or not data.get(key, "").strip():
            errors.append("exam.yaml " + key + " must be a non-empty quoted string")

    if data.get("exam_date") is not None and not isinstance(data.get("exam_date"), str):
        errors.append("exam.yaml exam_date must be a string or null")
    if data.get("target_score") is not None and not isinstance(data.get("target_score"), (str, int, float)):
        errors.append("exam.yaml target_score must be string, number, or null")

    time_budget = data.get("time_budget")
    if not isinstance(time_budget, dict):
        errors.append("exam.yaml time_budget must be a mapping")
    else:
        for key in ["total_hours", "sessions_per_week"]:
            if key not in time_budget:
                errors.append("time_budget missing: " + key)
            value = time_budget.get(key)
            if value is not None and (
                not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0
            ):
                errors.append("time_budget." + key + " must be a non-negative number or null")

    materials = data.get("materials")
    if not isinstance(materials, dict):
        errors.append("exam.yaml materials must be a mapping")
    else:
        for key in ["source_count", "question_count", "synthetic_count"]:
            if key not in materials:
                errors.append("materials missing: " + key)
            else:
                validate_count(key, materials.get(key), errors)

    readiness = data.get("readiness")
    if not isinstance(readiness, dict):
        errors.append("exam.yaml readiness must be a mapping")
    else:
        for key in ["accuracy", "speed", "coverage", "stability"]:
            if key not in readiness:
                errors.append("readiness missing: " + key)
            else:
                validate_score(key, readiness.get(key), errors)
        if readiness.get("confidence") not in ALLOWED_CONFIDENCE:
            errors.append("readiness.confidence must be low, medium, or high")

    evidence = data.get("readiness_evidence")
    source_backed_evidence = False
    evidenced_metrics = set()
    if not isinstance(evidence, list):
        errors.append("readiness_evidence must be a list")
    else:
        for index, item in enumerate(evidence):
            label = f"readiness_evidence[{index}]"
            if not isinstance(item, dict):
                errors.append(label + " must be a mapping")
                continue
            target = record_path(exam_dir, item.get("record"), label + ".record", errors)
            metrics = item.get("metrics")
            if not isinstance(metrics, list) or any(metric not in evidence_metrics for metric in metrics):
                errors.append(label + " has invalid metrics")
            else:
                evidenced_metrics.update(metrics)
            if not isinstance(item.get("source_backed"), bool) or not isinstance(item.get("synthetic"), bool):
                errors.append(label + " requires boolean source_backed and synthetic")
            if item.get("source_backed"):
                source_backed_evidence = True
            if target is not None:
                metadata = record_frontmatter(target, yaml, label, errors)
                if metadata is not None:
                    if metadata.get("record_schema") != 1 or metadata.get("assessment_status") != FINALIZED_STATUS:
                        errors.append(label + " must reference a finalized record_schema 1 record")
                    if sorted(metadata.get("metrics", [])) != sorted(metrics or []):
                        errors.append(label + " metrics disagree with record frontmatter")
                    for key in ("source_backed", "synthetic"):
                        if metadata.get(key) != item.get(key):
                            errors.append(label + " " + key + " disagrees with record frontmatter")

    notes = data.get("notes")
    if not isinstance(notes, list) or any(not isinstance(note, str) for note in notes):
        errors.append("exam.yaml notes must be a list of strings")

    total, synthetic, source_backed = question_counts
    sources = registered_source_count(exam_dir)
    if isinstance(materials, dict):
        expected = {"source_count": sources, "question_count": total, "synthetic_count": synthetic}
        for key, value in expected.items():
            if materials.get(key) != value:
                errors.append(f"materials.{key} is {materials.get(key)!r}; package contains {value}")
    if data.get("status") == "confirmed" and (sources == 0 or total == 0 or source_backed == 0):
        errors.append("confirmed status requires registered sources and source-backed questions")
    if isinstance(readiness, dict):
        missing_metrics = sorted(
            key
            for key in ("accuracy", "speed", "coverage", "stability")
            if readiness.get(key, 0) > 0 and key not in evidenced_metrics
        )
        if missing_metrics:
            errors.append("positive readiness values lack evidence for: " + ", ".join(missing_metrics))
        if readiness.get("confidence") != "low" and not evidence:
            errors.append("medium or high confidence requires readiness evidence")
    if isinstance(readiness, dict) and readiness.get("confidence") == "high" and (
        source_backed == 0 or not source_backed_evidence
    ):
        errors.append("high confidence requires source-backed questions and readiness evidence")


def fallback_validate_exam_yaml(path, errors, warnings):
    text = read_text(path)
    if yaml_scalar(text, "schema_version") != "2":
        errors.append("exam.yaml must contain schema_version: 2")

    status = yaml_scalar(text, "status")
    if status not in ALLOWED_STATUS:
        errors.append("exam.yaml status must be one of: " + ", ".join(sorted(ALLOWED_STATUS)))

    mode = yaml_scalar(text, "mode")
    if mode not in ALLOWED_MODES:
        errors.append("exam.yaml mode must be one of: " + ", ".join(sorted(ALLOWED_MODES)))

    for key in ["accuracy", "speed", "coverage", "stability"]:
        match = re.search(r"^\s+" + re.escape(key) + r":\s*(.+?)\s*$", text, re.MULTILINE)
        if match is None:
            errors.append("exam.yaml readiness is missing: " + key)
            continue
        value = parse_number(match.group(1).strip())
        if value is None or not 0 <= value <= 100:
            errors.append("readiness." + key + " must be between 0 and 100")

    confidence = re.search(r"^\s+confidence:\s*(.+?)\s*$", text, re.MULTILINE)
    if confidence and confidence.group(1).strip() not in ALLOWED_CONFIDENCE:
        errors.append("readiness confidence must be low, medium, or high")

    if status == "confirmed" and "question_count: 0" in text:
        warnings.append("exam.yaml is confirmed while question_count is 0")


def validate_question_banks(exam_dir, errors, warnings):
    bank_dir = exam_dir / "question-bank"
    files = sorted(bank_dir.glob("*.jsonl"))
    if not files:
        warnings.append("no question-bank/*.jsonl files found")
        return 0, 0, 0

    ids = set()
    source_backed = 0
    synthetic = 0
    for file in files:
        for number, line in enumerate(read_text(file).splitlines(), start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"{file.name}:{number} invalid JSON: {exc}")
                continue

            missing = [field for field in REQUIRED_QUESTION_FIELDS if field not in item]
            if missing:
                errors.append(f"{file.name}:{number} missing fields: {', '.join(missing)}")
            if item.get("id") in ids:
                errors.append(f"{file.name}:{number} duplicate question id: {item.get('id')}")
            ids.add(item.get("id"))
            if item.get("type") not in ALLOWED_QUESTION_TYPES:
                errors.append(f"{file.name}:{number} invalid type: {item.get('type')}")
            if item.get("status") not in ALLOWED_QUESTION_STATUS:
                errors.append(f"{file.name}:{number} invalid status: {item.get('status')}")
            if item.get("estimated_time") is not None and (
                not isinstance(item.get("estimated_time"), (int, float))
                or item.get("estimated_time") < 0
            ):
                errors.append(f"{file.name}:{number} estimated_time must be non-negative number or null")
            if not isinstance(item.get("synthetic"), bool):
                errors.append(f"{file.name}:{number} synthetic must be boolean")
            elif item.get("synthetic"):
                synthetic += 1
            else:
                source_backed += 1
            if not str(item.get("prompt", "")).strip():
                errors.append(f"{file.name}:{number} prompt is empty")

    if source_backed == 0 and synthetic > 0:
        warnings.append("question bank contains only synthetic questions")
    return source_backed + synthetic, synthetic, source_backed


def validate_error_log(path, errors):
    text = read_text(path)
    for heading in [
        "high-yield_errors",
        "recurring_patterns",
        "one-off_mistakes",
        "needs_relearn",
        "resolved",
    ]:
        if heading not in text:
            errors.append("error-log.md is missing section: " + heading)


def main():
    parser = argparse.ArgumentParser(description="Validate an exam-prep package.")
    parser.add_argument("exam_dir", help="Exam package directory.")
    parser.add_argument("--strict-schema", action="store_true", help="Use PyYAML-backed strict schema checks.")
    args = parser.parse_args()

    exam_dir = Path(args.exam_dir).expanduser().resolve()
    errors = []
    warnings = []

    if not exam_dir.exists() or not exam_dir.is_dir():
        print("ERROR: exam directory not found: " + str(exam_dir), file=sys.stderr)
        return 1

    for rel_path in REQUIRED_FILES:
        if not (exam_dir / rel_path).exists():
            errors.append("missing file: " + rel_path)

    for rel_path in REQUIRED_DIRS:
        if not (exam_dir / rel_path).is_dir():
            errors.append("missing directory: " + rel_path)

    question_counts = validate_question_banks(exam_dir, errors, warnings)

    if (exam_dir / "exam.yaml").exists():
        if args.strict_schema:
            strict_validate_exam_yaml(exam_dir / "exam.yaml", exam_dir, question_counts, errors, warnings)
        else:
            fallback_validate_exam_yaml(exam_dir / "exam.yaml", errors, warnings)
    if (exam_dir / "error-log.md").exists():
        validate_error_log(exam_dir / "error-log.md", errors)

    for warning in warnings:
        print("WARN: " + warning)
    for error in errors:
        print("ERROR: " + error)

    if errors:
        return 1
    print("OK: exam-prep package is structurally valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
