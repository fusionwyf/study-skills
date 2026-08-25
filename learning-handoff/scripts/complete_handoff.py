#!/usr/bin/env python3
"""Complete a handoff: mark it returned with verifiable evidence.

Usage (see learning-handoff/SKILL.md step 4):
    python scripts/complete_handoff.py --handoff <H####.md> \
      --returned-record <目标包内记录路径>

Refuses unless the handoff is open and the returned record exists inside the
handoff's to.package directory and parses as a finalized record. On success
the handoff file is updated in place (status: returned, returned_record,
returned_at). Any refusal exits non-zero without writes.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from typing import Any


def reconfigure_streams() -> None:
    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def fail(message: str) -> int:
    print(f"ERROR: {message}", file=sys.stderr)
    return 1


def load_yaml_module():
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError("complete_handoff.py requires PyYAML") from exc
    return yaml


def split_frontmatter(text: str) -> tuple[str | None, str]:
    """Return (raw frontmatter block, body) with the --- delimiters removed."""
    if not text.startswith("---\n"):
        return None, text
    parts = text.split("---", 2)
    if len(parts) != 3:
        return None, text
    return parts[1], parts[2]


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff", required=True)
    parser.add_argument("--returned-record", required=True)
    args = parser.parse_args()

    handoff_path = Path(args.handoff).expanduser().resolve()
    if not handoff_path.is_file():
        return fail(f"handoff file does not exist: {args.handoff}")

    try:
        yaml = load_yaml_module()
    except RuntimeError as exc:
        return fail(str(exc))

    try:
        text = handoff_path.read_text(encoding="utf-8")
    except OSError as exc:
        return fail(f"handoff file cannot be read: {exc}")
    raw_block, body = split_frontmatter(text)
    metadata = None
    if raw_block is not None:
        try:
            loaded = yaml.safe_load(raw_block)
            metadata = loaded if isinstance(loaded, dict) else None
        except Exception as exc:
            return fail(f"handoff frontmatter cannot be parsed: {exc}")
    if metadata is None:
        return fail("handoff file has no valid YAML frontmatter")

    status = metadata.get("status")
    if status != "open":
        return fail(f"handoff must be open to complete; current status: {status!r}")

    to_block = metadata.get("to") or {}
    target_raw = to_block.get("package") if isinstance(to_block, dict) else None
    if not isinstance(target_raw, str) or not target_raw.strip():
        return fail("handoff frontmatter has no to.package; cannot locate the target package directory")
    target_pkg = Path(target_raw).expanduser().resolve()
    if not target_pkg.is_dir():
        return fail(f"target package directory does not exist: {target_pkg}")

    returned_input = Path(args.returned_record)
    returned_path = returned_input if returned_input.is_absolute() else (target_pkg / returned_input).resolve()
    try:
        returned_path.relative_to(target_pkg)
    except ValueError:
        return fail(f"--returned-record must stay inside the target package ({target_pkg})")
    if not returned_path.is_file():
        return fail(f"--returned-record does not exist inside the target package: {args.returned_record}")

    record_text = returned_path.read_text(encoding="utf-8", errors="replace")
    record_block, _ = split_frontmatter(record_text)
    record_meta = None
    if record_block is not None:
        try:
            loaded = yaml.safe_load(record_block)
            record_meta = loaded if isinstance(loaded, dict) else None
        except Exception:
            record_meta = None
    if record_meta is None or record_meta.get("assessment_status") != "finalized":
        return fail(f"--returned-record must be a finalized record: {args.returned_record}")

    # All refusal paths are above this point; update the handoff in place.
    metadata["status"] = "returned"
    metadata["returned_record"] = returned_path.relative_to(target_pkg).as_posix()
    metadata["returned_at"] = dt.date.today().isoformat()
    dumped = yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False, default_flow_style=False)
    try:
        handoff_path.write_text(f"---\n{dumped}---\n{body}", encoding="utf-8", newline="\n")
    except OSError as exc:
        return fail(f"handoff file could not be updated: {exc}")

    print(f"OK {metadata.get('handoff_id', handoff_path.name)} returned with evidence {metadata['returned_record']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
