#!/usr/bin/env python3
"""Update schema-v2 exam state from finalized records and package contents."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 2
ALLOWED_STATUS = {"provisional", "confirmed", "archived"}
ALLOWED_MODES = {"diagnose", "plan", "drill", "review", "mock", "cram", "postmortem"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
READINESS_KEYS = {"accuracy", "speed", "coverage", "stability", "confidence"}


def load_state(path: Path) -> tuple[dict[str, Any], Any]:
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise SystemExit("update_exam.py requires PyYAML") from exc
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        raise SystemExit(f"exam.yaml cannot be parsed; enter recovery: {exc}") from exc
    if not isinstance(state, dict):
        raise SystemExit("exam.yaml root must be a mapping; enter recovery")
    if state.get("schema_version") != SCHEMA_VERSION:
        raise SystemExit(
            f"exam.yaml must use schema_version {SCHEMA_VERSION}; enter recovery instead of migrating automatically"
        )
    return state, yaml


def atomic_dump(path: Path, state: dict[str, Any], yaml: Any) -> None:
    handle, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            yaml.safe_dump(state, stream, allow_unicode=True, sort_keys=False, default_flow_style=False)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def parse_pairs(text: str | None) -> dict[str, float | str]:
    updates: dict[str, float | str] = {}
    if not text:
        return updates
    for part in text.split(","):
        if not part.strip():
            continue
        if "=" not in part:
            raise ValueError("Expected key=value in: " + part)
        key, raw = (piece.strip() for piece in part.split("=", 1))
        if key not in READINESS_KEYS:
            raise ValueError("Unknown readiness key: " + key)
        if key == "confidence":
            if raw not in ALLOWED_CONFIDENCE:
                raise ValueError("confidence must be low, medium, or high")
            updates[key] = raw
            continue
        number = float(raw)
        if 0 <= number <= 1 and "." in raw:
            number *= 100
        if not 0 <= number <= 100:
            raise ValueError(key + " must be between 0 and 100, or a 0-1 fraction")
        updates[key] = round(number, 4)
    return updates


def record_relative(root: Path, value: str) -> tuple[Path, str]:
    candidate = Path(value)
    path = (root / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()
    records = (root / "records").resolve()
    try:
        relative = path.relative_to(records)
    except ValueError as exc:
        raise ValueError("readiness evidence must be inside records/") from exc
    if not path.is_file():
        raise ValueError("readiness evidence record does not exist: " + str(path))
    return path, (Path("records") / relative).as_posix()


def record_metadata(path: Path, yaml: Any) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8-sig")
    if not text.startswith("---\n"):
        raise ValueError("readiness evidence is missing YAML frontmatter: " + str(path))
    parts = text.split("---", 2)
    if len(parts) != 3:
        raise ValueError("readiness evidence has invalid YAML frontmatter: " + str(path))
    metadata = yaml.safe_load(parts[1]) or {}
    if not isinstance(metadata, dict):
        raise ValueError("readiness evidence frontmatter must be a mapping: " + str(path))
    if metadata.get("record_schema") != 1 or metadata.get("assessment_status") != "finalized":
        raise ValueError("readiness evidence must use record_schema 1 and assessment_status finalized")
    if not metadata.get("record_id") or metadata.get("mode") not in {"diagnose", "drill", "review", "mock"}:
        raise ValueError("readiness evidence requires record_id and an assessment mode")
    metrics = metadata.get("metrics")
    if not isinstance(metrics, list) or not metrics:
        raise ValueError("readiness evidence must list measured metrics")
    if any(metric not in READINESS_KEYS - {"confidence"} for metric in metrics):
        raise ValueError("readiness evidence contains an invalid metric")
    if not isinstance(metadata.get("source_backed"), bool) or not isinstance(metadata.get("synthetic"), bool):
        raise ValueError("readiness evidence requires boolean source_backed and synthetic fields")
    return metadata


def question_counts(root: Path) -> tuple[int, int, int]:
    total = 0
    synthetic = 0
    source_backed = 0
    for path in sorted((root / "question-bank").glob("*.jsonl")):
        for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path.name}:{number} invalid JSON: {exc}") from exc
            if not isinstance(item.get("synthetic"), bool):
                raise ValueError(f"{path.name}:{number} synthetic must be boolean")
            total += 1
            if item.get("synthetic") is True:
                synthetic += 1
            else:
                source_backed += 1
    return total, synthetic, source_backed


def registered_source_count(root: Path) -> int:
    path = root / "SOURCES.md"
    if not path.is_file():
        return 0
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            if cells and cells[0] not in {"source_id", "---"} and not set(cells[0]) <= {"-", ":"}:
                rows.append(cells)
    return len(rows)


def package_materials(root: Path) -> tuple[dict[str, int], int]:
    question_count, synthetic_count, source_backed = question_counts(root)
    return {
        "source_count": registered_source_count(root),
        "question_count": question_count,
        "synthetic_count": synthetic_count,
    }, source_backed


def validate_state(state: dict[str, Any], source_backed_questions: int) -> None:
    if state.get("status") not in ALLOWED_STATUS:
        raise ValueError("invalid status")
    if state.get("mode") not in ALLOWED_MODES:
        raise ValueError("invalid mode")
    readiness = state.get("readiness")
    if not isinstance(readiness, dict):
        raise ValueError("readiness must be a mapping")
    for key in READINESS_KEYS - {"confidence"}:
        value = readiness.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 100:
            raise ValueError("readiness." + key + " must be 0-100")
    if readiness.get("confidence") not in ALLOWED_CONFIDENCE:
        raise ValueError("readiness.confidence must be low, medium, or high")
    evidence = state.get("readiness_evidence")
    if not isinstance(evidence, list):
        raise ValueError("readiness_evidence must be a list")
    evidenced_metrics = {
        metric
        for item in evidence
        if isinstance(item, dict) and isinstance(item.get("metrics"), list)
        for metric in item["metrics"]
    }
    missing_metrics = sorted(
        key
        for key in READINESS_KEYS - {"confidence"}
        if readiness.get(key, 0) > 0 and key not in evidenced_metrics
    )
    if missing_metrics:
        raise ValueError("positive readiness values lack evidence for: " + ", ".join(missing_metrics))
    if readiness.get("confidence") != "low" and not evidence:
        raise ValueError("medium or high confidence requires readiness evidence")
    if readiness.get("confidence") == "high" and (
        source_backed_questions == 0
        or not any(isinstance(item, dict) and item.get("source_backed") for item in evidence)
    ):
        raise ValueError("high confidence requires source-backed questions and readiness evidence")
    materials = state.get("materials")
    if state.get("status") == "confirmed" and (
        not isinstance(materials, dict)
        or materials.get("source_count", 0) <= 0
        or materials.get("question_count", 0) <= 0
        or source_backed_questions <= 0
    ):
        raise ValueError("confirmed status requires registered sources and source-backed questions")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exam_dir", help="Exam package directory.")
    parser.add_argument("--mode", choices=sorted(ALLOWED_MODES))
    parser.add_argument("--status", choices=sorted(ALLOWED_STATUS))
    parser.add_argument("--readiness", help="Comma-separated updates, e.g. accuracy=70,speed=50")
    parser.add_argument("--evidence-record", help="Finalized record inside records/; required with --readiness")
    parser.add_argument("--sync-materials", action="store_true", help="Recount SOURCES.md and question-bank/*.jsonl")
    parser.add_argument("--title")
    parser.add_argument("--exam-date")
    parser.add_argument("--target-score")
    args = parser.parse_args()

    root = Path(args.exam_dir).expanduser().resolve()
    state_path = root / "exam.yaml"
    if not state_path.is_file():
        print("ERROR: exam.yaml not found: " + str(state_path))
        return 1
    try:
        state, yaml = load_state(state_path)
        readiness_updates = parse_pairs(args.readiness)
        if readiness_updates and not args.evidence_record:
            raise ValueError("--readiness requires --evidence-record")
        if readiness_updates and (state.get("mode") == "postmortem" or args.mode == "postmortem"):
            raise ValueError("postmortem does not update pre-exam readiness")

        materials, source_backed_questions = package_materials(root)
        if args.sync_materials:
            state["materials"] = materials
        elif state.get("materials") != materials:
            raise ValueError("material counts are stale; rerun with --sync-materials")
        if args.mode:
            state["mode"] = args.mode
        if args.title:
            state["title"] = args.title
        if args.exam_date:
            state["exam_date"] = args.exam_date
        if args.target_score:
            state["target_score"] = args.target_score

        if readiness_updates:
            path, relative = record_relative(root, args.evidence_record)
            metadata = record_metadata(path, yaml)
            measured = set(metadata["metrics"])
            numeric_updates = set(readiness_updates) - {"confidence"}
            if not numeric_updates <= measured:
                missing = ", ".join(sorted(numeric_updates - measured))
                raise ValueError("record does not measure requested readiness metrics: " + missing)
            evidence_item = {
                "record": relative,
                "metrics": sorted(measured),
                "source_backed": metadata["source_backed"],
                "synthetic": metadata["synthetic"],
            }
            evidence = state.setdefault("readiness_evidence", [])
            evidence[:] = [
                item for item in evidence if not isinstance(item, dict) or item.get("record") != relative
            ]
            evidence.append(evidence_item)
            state["readiness"].update(readiness_updates)

        if args.status:
            state["status"] = args.status
        state["updated_at"] = dt.date.today().isoformat()
        validate_state(state, source_backed_questions)
        atomic_dump(state_path, state, yaml)
    except (ValueError, OSError) as exc:
        print("ERROR: " + str(exc))
        return 1

    print("Updated " + str(state_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
