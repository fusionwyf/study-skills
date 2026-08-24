#!/usr/bin/env python3
"""Validate the handoffs/ directory of a package against handoff.schema.yaml.

Usage:
    python learning-handoff/scripts/validate_handoffs.py <package-dir>

An absent handoffs/ folder is valid (zero handoffs). Each handoff file is
checked for: required frontmatter fields, nested from/to blocks with all
required keys, boundary include/exclude present as lists, non-empty
return_condition, id pattern ^H[0-9]{4}$ and cross-file uniqueness, status
vocabulary, returned/closed implying returned_record, and from.record
resolving to an existing file inside THIS package (traceability).

Output: ERROR lines plus one SUMMARY line; exit 0 = valid, 1 = errors,
2 = usage/IO error.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
HANDOFF_SCHEMA_PATH = REPO_ROOT / "shared" / "schemas" / "handoff.schema.yaml"

HANDOFF_ID_RE = re.compile(r"^H[0-9]{4}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
FALLBACK_VOCABULARIES = {"handoff_status": ["open", "returned", "closed"]}


def reconfigure_streams() -> None:
    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def load_schema(errors: list[str]) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except ImportError:
        errors.append(f"PyYAML is required to load {HANDOFF_SCHEMA_PATH}")
        return {"vocabularies": dict(FALLBACK_VOCABULARIES)}
    try:
        schema = yaml.safe_load(HANDOFF_SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"handoff schema cannot be loaded from {HANDOFF_SCHEMA_PATH}: {exc}")
        return {"vocabularies": dict(FALLBACK_VOCABULARIES)}
    if not isinstance(schema, dict):
        errors.append("handoff schema root must be a mapping")
        return {"vocabularies": dict(FALLBACK_VOCABULARIES)}
    return schema


def split_frontmatter(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    parts = text.split("---", 2)
    if len(parts) != 3:
        return None
    return parts[1]


def require_str(metadata: dict, key: str, label: str, errors: list[str]) -> None:
    value = metadata.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label} missing non-empty string field: {key}")


def validate_handoff(path: Path, root: Path, yaml: Any, statuses: list[str], seen_ids: set[str], errors: list[str]) -> str | None:
    label = path.name
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"{label} cannot be read: {exc}")
        return None
    block = split_frontmatter(text)
    metadata = None
    if block is not None:
        try:
            loaded = yaml.safe_load(block)
            metadata = loaded if isinstance(loaded, dict) else None
        except Exception as exc:
            errors.append(f"{label} frontmatter cannot be parsed: {exc}")
            return None
    if metadata is None:
        errors.append(f"{label} has no valid YAML frontmatter")
        return None

    if metadata.get("handoff_schema") != 1:
        errors.append(f"{label} handoff_schema must be 1, got {metadata.get('handoff_schema')!r}")
    handoff_id = metadata.get("handoff_id")
    if not isinstance(handoff_id, str) or not HANDOFF_ID_RE.match(handoff_id):
        errors.append(f"{label} invalid handoff_id {handoff_id!r}; must match ^H[0-9]{{4}}$")
    elif handoff_id in seen_ids:
        errors.append(f"{label} duplicate handoff_id: {handoff_id}")
    else:
        seen_ids.add(handoff_id)

    status = metadata.get("status")
    if status not in statuses:
        errors.append(f"{label} invalid status {status!r}; allowed {statuses}")

    created_at = metadata.get("created_at")
    if not isinstance(created_at, str) or not DATE_RE.match(created_at):
        errors.append(f"{label} created_at must be YYYY-MM-DD, got {created_at!r}")

    conditions = metadata.get("return_condition")
    if not isinstance(conditions, list) or not conditions:
        errors.append(f"{label} return_condition must be a non-empty list")

    from_block = metadata.get("from")
    if not isinstance(from_block, dict):
        errors.append(f"{label} missing from block")
    else:
        for key in ("skill", "package", "record"):
            require_str(from_block, key, label, errors)
        record_ref = from_block.get("record")
        if isinstance(record_ref, str) and record_ref.strip():
            record_path = (root / record_ref).resolve()
            try:
                record_path.relative_to(root)
            except ValueError:
                errors.append(f"{label} from.record escapes this package: {record_ref}")
            else:
                if not record_path.is_file():
                    errors.append(f"{label} from.record does not exist in this package: {record_ref}")

    to_block = metadata.get("to")
    if not isinstance(to_block, dict):
        errors.append(f"{label} missing to block")
    else:
        for key in ("skill", "goal"):
            require_str(to_block, key, label, errors)
        boundary = to_block.get("boundary")
        if not isinstance(boundary, dict):
            errors.append(f"{label} missing to.boundary block")
        else:
            for key in ("include", "exclude"):
                if not isinstance(boundary.get(key), list):
                    errors.append(f"{label} to.boundary.{key} must be a list")

    if status in {"returned", "closed"} and not isinstance(metadata.get("returned_record"), str):
        errors.append(f"{label} status {status!r} requires returned_record")

    return handoff_id if isinstance(handoff_id, str) else None


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    args = parser.parse_args()

    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: package directory does not exist: {root}", file=sys.stderr)
        return 2

    errors: list[str] = []
    schema = load_schema(errors)
    vocabularies = schema.get("vocabularies") or {}
    raw_statuses = vocabularies.get("handoff_status")
    statuses = [str(item) for item in raw_statuses] if isinstance(raw_statuses, list) and raw_statuses else list(FALLBACK_VOCABULARIES["handoff_status"])

    counts = {status: 0 for status in statuses}
    total = 0
    handoffs_dir = root / "handoffs"
    files = sorted(handoffs_dir.glob("*.md")) if handoffs_dir.is_dir() else []
    seen_ids: set[str] = set()
    try:
        import yaml  # type: ignore
    except ImportError:
        print("ERROR: PyYAML is required", file=sys.stderr)
        return 2
    for path in files:
        total += 1
        validate_handoff(path, root, yaml, statuses, seen_ids, errors)
        # Count by status even when other fields are broken.
        block = split_frontmatter(path.read_text(encoding="utf-8", errors="replace"))
        try:
            loaded = yaml.safe_load(block) if block is not None else None
        except Exception:
            loaded = None
        status = loaded.get("status") if isinstance(loaded, dict) else None
        if status in counts:
            counts[status] += 1

    for error in errors:
        print(f"ERROR: {error}")
    summary = " ".join(f"{name}={counts[name]}" for name in counts)
    print(f"SUMMARY: handoffs={total} {summary}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
