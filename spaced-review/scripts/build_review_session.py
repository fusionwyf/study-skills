#!/usr/bin/env python3
"""Build a due spaced-repetition review session for a course or exam package.

Usage:
    python scripts/build_review_session.py <package-dir> [--limit N]

Detects the package kind (course.yaml vs exam.yaml), collects review_queue
entries whose due_at has passed, and prints a YAML session plan to stdout:
package, kind, generated_at, items[]. Task-type suggestions follow
spaced-review/references/review-session.md:

1. review_count == 0 -> retrieval
2. last performance poor -> error_discrimination
3. otherwise rotate variation / transfer / explanation across the session,
   guaranteeing at least one variation or transfer when the session has 2+
   items (among items eligible for rule 3; rules 1 and 2 take precedence).

Empty items[] is a valid result (exit 0). Unreadable or missing state exits
non-zero with a clear message on stderr.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from typing import Any

import yaml

ROTATION = ("variation", "transfer", "explanation")
RECENT_RECORD_LIMIT = 2
RECORD_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.S)


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


def parse_moment(value: Any) -> dt.datetime | None:
    """Parse date-only strings, ISO datetimes and 'Z' suffixes into naive local datetimes."""
    if isinstance(value, dt.datetime):
        moment = value
    elif isinstance(value, dt.date):
        return dt.datetime(value.year, value.month, value.day)
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            moment = dt.datetime.fromisoformat(text)
        except ValueError:
            try:
                day = dt.date.fromisoformat(text)
            except ValueError:
                return None
            return dt.datetime(day.year, day.month, day.day)
    else:
        return None
    if moment.tzinfo is not None:
        moment = moment.astimezone().replace(tzinfo=None)
    return moment


def load_state(root: Path, filename: str):
    path = root / filename
    if not path.is_file():
        return None
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"{filename} cannot be parsed: {exc}") from exc
    if not isinstance(state, dict):
        raise RuntimeError(f"{filename} root must be a mapping")
    return state


def load_frontmatter(path: Path) -> dict | None:
    try:
        match = RECORD_FRONTMATTER_RE.match(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None
    if match is None:
        return None
    try:
        data = yaml.safe_load(match.group(1))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def recent_records(records_dir: Path, key_field: str, target: str) -> list[str]:
    """Up to the 2 most recent finalized records matching this target."""
    matches: list[str] = []
    if not records_dir.is_dir():
        return []
    for entry in sorted(records_dir.glob("*.md"), reverse=True):
        metadata = load_frontmatter(entry)
        if metadata is None or metadata.get("assessment_status") != "finalized":
            continue
        if metadata.get(key_field) == target:
            matches.append((Path("records") / entry.name).as_posix())
        if len(matches) >= RECENT_RECORD_LIMIT:
            break
    return matches


def last_performance(records_dir: Path, last_record: Any) -> str | None:
    if not isinstance(last_record, str) or not last_record:
        return None
    metadata = load_frontmatter(root_dir_for(last_record, records_dir))
    if metadata is None:
        return None
    performance = metadata.get("performance")
    return performance if isinstance(performance, str) else None


def root_dir_for(last_record: str, records_dir: Path) -> Path:
    return records_dir.parent / last_record


def error_hints(exam_dir: Path) -> list[str]:
    """Excerpt bullet lines from error-log.md recurring_patterns when present."""
    path = exam_dir / "error-log.md"
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    hints: list[str] = []
    in_section = False
    for line in lines:
        if line.startswith("## "):
            in_section = line.strip().lower() == "## recurring_patterns"
            continue
        if in_section and line.strip():
            hints.append(line.strip().lstrip("- ").strip())
    return [hint for hint in hints if hint]


def suggest_kinds(items: list[dict]) -> None:
    """Apply the review-session.md selection rules in place."""
    rule3_indices: list[int] = []
    for index, item in enumerate(items):
        if item["review_count"] == 0:
            item["suggested_review_kind"] = "retrieval"
        elif last_performance(
            Path(item["_records_dir"]), item.get("last_record")
        ) == "poor":
            item["suggested_review_kind"] = "error_discrimination"
        else:
            rule3_indices.append(index)
    for offset, index in enumerate(rule3_indices):
        items[index]["suggested_review_kind"] = ROTATION[offset % len(ROTATION)]
    # Session-level guarantee: at least one variation or transfer when there
    # are 2+ items. Rules 1 and 2 keep precedence, so only a rule-3 slot flips.
    if len(items) >= 2 and rule3_indices:
        kinds = {item["suggested_review_kind"] for item in items}
        if not kinds & {"variation", "transfer"}:
            items[rule3_indices[0]]["suggested_review_kind"] = "variation"


def build_session(root: Path, limit: int | None) -> dict:
    if (root / "course.yaml").is_file():
        kind, state_file, key_field = "course", "course.yaml", "objective_id"
    elif (root / "exam.yaml").is_file():
        kind, state_file, key_field = "exam", "exam.yaml", "topic"
    else:
        raise RuntimeError(f"no course.yaml or exam.yaml in package: {root}")
    state = load_state(root, state_file)
    if not isinstance(state, dict):
        raise RuntimeError(f"{state_file} root must be a mapping")
    queue = state.get("review_queue", [])
    if queue is None:
        queue = []
    if not isinstance(queue, list):
        raise RuntimeError(f"{state_file} review_queue must be a list")

    now = dt.datetime.now()
    pending: list[tuple[dt.datetime, dict]] = []
    for index, entry in enumerate(queue):
        if not isinstance(entry, dict):
            print(f"WARNING: review_queue[{index}] is not a mapping; skipped", file=sys.stderr)
            continue
        target = entry.get(key_field)
        due = parse_moment(entry.get("due_at"))
        if not isinstance(target, str) or not target:
            print(f"WARNING: review_queue[{index}] has no {key_field}; skipped", file=sys.stderr)
            continue
        if due is None:
            print(f"WARNING: review_queue[{index}] has unreadable due_at; skipped", file=sys.stderr)
            continue
        if due <= now:
            pending.append((due, entry))

    pending.sort(key=lambda pair: pair[0])
    if limit is not None:
        pending = pending[:limit]

    records_dir = root / "records"
    items: list[dict] = []
    for _, entry in pending:
        item: dict[str, Any] = {
            "target": entry[key_field],
            "due_at": entry.get("due_at"),
            "interval_days": entry.get("interval_days"),
            "review_count": entry.get("review_count", 0),
            "_records_dir": str(records_dir),
        }
        if entry.get("last_record"):
            item["last_record"] = entry["last_record"]
        item["recent_records"] = recent_records(records_dir, key_field, entry[key_field])
        items.append(item)

    suggest_kinds(items)
    if kind == "exam":
        hints = error_hints(root)
        for item in items:
            if hints:
                item["error_hints"] = hints
    for item in items:
        item.pop("_records_dir")
    return {
        "package": str(root),
        "kind": kind,
        "generated_at": now.isoformat(timespec="seconds"),
        "items": items,
    }


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    parser.add_argument("--limit", type=int, default=None, help="Cap the number of due items")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 0:
        return fail("--limit must be >= 0")
    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        return fail(f"package directory does not exist: {root}")
    try:
        session = build_session(root, args.limit)
    except RuntimeError as exc:
        return fail(str(exc))
    print(yaml.safe_dump(session, allow_unicode=True, sort_keys=False, default_flow_style=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
