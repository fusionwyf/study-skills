#!/usr/bin/env python3
import argparse
import datetime as dt
import os
import re
import sys
import tempfile
from pathlib import Path


ALLOWED_STATUS = {"provisional", "confirmed", "archived"}
ALLOWED_MODES = {"diagnose", "plan", "drill", "review", "mock", "cram", "postmortem"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
READINESS_KEYS = {"accuracy", "speed", "coverage", "stability", "confidence"}
MATERIAL_KEYS = {"source_count", "question_count", "synthetic_count"}


def parse_scalar(value):
    value = value.strip()
    if value in {"null", "None", ""}:
        return None
    if value in {"true", "false"}:
        return value == "true"
    if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
        return value[1:-1].replace('\"', '"').replace("\\\\", "\\")
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def quote_scalar(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("\\", "\\\\").replace('"', '\"')
    return '"' + text + '"'


def default_state(title):
    today = dt.date.today().isoformat()
    return {
        "schema_version": 1,
        "title": title,
        "status": "provisional",
        "mode": "diagnose",
        "created_at": today,
        "updated_at": today,
        "exam_date": None,
        "target_score": None,
        "time_budget": {"total_hours": None, "sessions_per_week": None},
        "materials": {"source_count": 0, "question_count": 0, "synthetic_count": 0},
        "readiness": {
            "accuracy": 0,
            "speed": 0,
            "coverage": 0,
            "stability": 0,
            "confidence": "low",
        },
        "notes": ["Updated by exam-prep."],
    }


def read_exam(path):
    state = default_state(path.parent.name)
    current = None
    if not path.exists():
        return state

    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw.startswith(" ") and ":" in raw:
            key, value = raw.split(":", 1)
            key = key.strip()
            if key in {"time_budget", "materials", "readiness", "notes"} and not value.strip():
                current = key
                if key == "notes":
                    state["notes"] = []
                else:
                    state.setdefault(key, {})
                continue
            current = None
            if key in state:
                state[key] = parse_scalar(value)
        elif current in {"time_budget", "materials", "readiness"} and ":" in raw:
            key, value = raw.strip().split(":", 1)
            state[current][key.strip()] = parse_scalar(value)
        elif current == "notes" and raw.strip().startswith("- "):
            note = parse_scalar(raw.strip()[2:])
            state.setdefault("notes", []).append(note)

    return state


def parse_pairs(text, allowed_keys, parser):
    updates = {}
    if not text:
        return updates
    for part in text.split(","):
        if not part.strip():
            continue
        if "=" not in part:
            raise ValueError("Expected key=value in: " + part)
        key, value = part.split("=", 1)
        key = key.strip()
        if key not in allowed_keys:
            raise ValueError("Unknown key: " + key)
        updates[key] = parser(key, value.strip())
    return updates


def parse_score(key, value):
    if key == "confidence":
        if value not in ALLOWED_CONFIDENCE:
            raise ValueError("confidence must be low, medium, or high")
        return value
    number = float(value)
    if 0 <= number <= 1 and "." in value:
        number *= 100
    if not 0 <= number <= 100:
        raise ValueError(key + " must be between 0 and 100, or a 0-1 fraction")
    return round(number, 4)


def parse_count(key, value):
    number = int(value)
    if number < 0:
        raise ValueError(key + " must be >= 0")
    return number


def validate_state(state):
    if state["status"] not in ALLOWED_STATUS:
        raise ValueError("status must be one of: " + ", ".join(sorted(ALLOWED_STATUS)))
    if state["mode"] not in ALLOWED_MODES:
        raise ValueError("mode must be one of: " + ", ".join(sorted(ALLOWED_MODES)))
    if state["readiness"]["confidence"] not in ALLOWED_CONFIDENCE:
        raise ValueError("confidence must be low, medium, or high")
    for key in ["accuracy", "speed", "coverage", "stability"]:
        value = state["readiness"][key]
        if not isinstance(value, (int, float)) or not 0 <= value <= 100:
            raise ValueError("readiness." + key + " must be 0-100")
    for key in MATERIAL_KEYS:
        value = state["materials"][key]
        if not isinstance(value, int) or value < 0:
            raise ValueError("materials." + key + " must be a non-negative integer")


def dump_exam(state):
    lines = [
        "schema_version: " + str(state["schema_version"]),
        "title: " + quote_scalar(state["title"]),
        "status: " + str(state["status"]),
        "mode: " + str(state["mode"]),
        "created_at: " + quote_scalar(state["created_at"]),
        "updated_at: " + quote_scalar(state["updated_at"]),
        "exam_date: " + quote_scalar(state["exam_date"]),
        "target_score: " + quote_scalar(state["target_score"]),
        "time_budget:",
        "  total_hours: " + quote_scalar(state["time_budget"].get("total_hours")),
        "  sessions_per_week: " + quote_scalar(state["time_budget"].get("sessions_per_week")),
        "materials:",
        "  source_count: " + str(state["materials"]["source_count"]),
        "  question_count: " + str(state["materials"]["question_count"]),
        "  synthetic_count: " + str(state["materials"]["synthetic_count"]),
        "readiness:",
        "  accuracy: " + str(state["readiness"]["accuracy"]),
        "  speed: " + str(state["readiness"]["speed"]),
        "  coverage: " + str(state["readiness"]["coverage"]),
        "  stability: " + str(state["readiness"]["stability"]),
        "  confidence: " + str(state["readiness"]["confidence"]),
        "notes:",
    ]
    notes = state.get("notes") or []
    for note in notes:
        lines.append("  - " + quote_scalar(note))
    return "\n".join(lines) + "\n"


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as tmp:
            tmp.write(text)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def main():
    parser = argparse.ArgumentParser(description="Update exam.yaml atomically.")
    parser.add_argument("exam_dir", help="Exam package directory.")
    parser.add_argument("--mode", choices=sorted(ALLOWED_MODES))
    parser.add_argument("--status", choices=sorted(ALLOWED_STATUS))
    parser.add_argument("--readiness", help="Comma-separated updates, e.g. accuracy=70,speed=0.5,confidence=medium")
    parser.add_argument("--materials", help="Comma-separated updates, e.g. source_count=5,question_count=120")
    parser.add_argument("--title")
    parser.add_argument("--exam-date")
    parser.add_argument("--target-score")
    args = parser.parse_args()

    exam_dir = Path(args.exam_dir).expanduser().resolve()
    exam_yaml = exam_dir / "exam.yaml"
    if not exam_dir.exists():
        print("ERROR: exam directory not found: " + str(exam_dir), file=sys.stderr)
        return 1
    if not exam_yaml.exists():
        print("ERROR: exam.yaml not found: " + str(exam_yaml), file=sys.stderr)
        return 1

    try:
        state = read_exam(exam_yaml)
        if args.mode:
            state["mode"] = args.mode
        if args.status:
            state["status"] = args.status
        if args.title:
            state["title"] = args.title
        if args.exam_date:
            state["exam_date"] = args.exam_date
        if args.target_score:
            state["target_score"] = args.target_score
        state["readiness"].update(parse_pairs(args.readiness, READINESS_KEYS, parse_score))
        state["materials"].update(parse_pairs(args.materials, MATERIAL_KEYS, parse_count))
        state["updated_at"] = dt.date.today().isoformat()
        validate_state(state)
        atomic_write(exam_yaml, dump_exam(state))
    except ValueError as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        return 1

    print("Updated " + str(exam_yaml))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
