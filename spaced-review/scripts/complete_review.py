#!/usr/bin/env python3
"""Record one completed review and update the package's review queue.

Usage (see spaced-review/SKILL.md step 4; --objective-id and --topic are
mutually exclusive — one per run):
    # course package
    python scripts/complete_review.py <course-dir> --objective-id <id> \
      --review-kind <retrieval|explanation|variation|transfer|error_discrimination> \
      --performance <good|medium|poor> --hint-used <true|false> \
      --evidence-strength <strong|medium|weak> \
      --raw-answer "<学习者原话>" [--next-action "<下一步>"] \
      [--source-backed] [--synthetic]
    # exam package
    python scripts/complete_review.py <exam-dir> --topic <t> \
      --review-kind <retrieval|explanation|variation|transfer|error_discrimination> \
      --performance <good|medium|poor> --hint-used <true|false> \
      --evidence-strength <strong|medium|weak> \
      --raw-answer "<学习者原话>" [--next-action "<下一步>"] \
      [--source-backed] [--synthetic]

Writes records/RV####-<slug>.md as a finalized review record under the shared
record contract, then — in the same run — updates the matching review_queue
entry: review_count+1, last_reviewed_at, last_record, and a new interval_days
/ due_at computed by shared/scripts/spaced_repetition.py. Refusals exit
non-zero without writing anything.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SHARED_SCRIPTS = REPO_ROOT / "shared" / "scripts"
if str(SHARED_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SHARED_SCRIPTS))

from spaced_repetition import next_interval  # noqa: E402

REVIEW_KINDS = ("retrieval", "explanation", "variation", "transfer", "error_discrimination")
PERFORMANCES = ("good", "medium", "poor")
EVIDENCE_STRENGTHS = ("strong", "medium", "weak")
DEFAULT_NEXT_ACTION = "按本次判断安排下一次到期复习；连续两次 medium 及以下则降低任务类型难度。"
RV_SEQUENCE_RE = re.compile(r"^RV(\d{4})-")
SLUG_CLEAN_RE = re.compile(r"[^a-z0-9]+")


def reconfigure_streams() -> None:
    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fail(message: str) -> int:
    print(f"ERROR: {message}", file=sys.stderr)
    return 1


def slugify(value: str) -> str:
    slug = SLUG_CLEAN_RE.sub("-", value.lower()).strip("-")
    return slug[:48] or "review"


def atomic_write_text(path: Path, text: str) -> None:
    """Write text atomically via a same-directory temp file + os.replace.

    A partial RV#### record must never survive a crash or a write error:
    it would block the next attempt that computes the same sequence number.
    """
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def next_rv_sequence(records_dir: Path) -> int:
    highest = 0
    if records_dir.is_dir():
        for entry in records_dir.iterdir():
            match = RV_SEQUENCE_RE.match(entry.name)
            if match:
                highest = max(highest, int(match.group(1)))
    return highest + 1


def load_state(root: Path, filename: str):
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError("complete_review.py requires PyYAML") from exc
    path = root / filename
    if not path.is_file():
        raise RuntimeError(f"{filename} is missing in package: {root}")
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"{filename} cannot be parsed: {exc}") from exc
    if not isinstance(state, dict):
        raise RuntimeError(f"{filename} root must be a mapping")
    return state, yaml


def build_record_text(args: argparse.Namespace, record_id: str, target_key: str, target: str, yaml_module) -> str:
    """Serialize the review record frontmatter through yaml.safe_dump.

    User-supplied strings (--next-action, the objective/topic target) are
    never interpolated into YAML text directly: a value such as ``review:
    chapter`` or ``foo # bar`` would otherwise break parsing. Building the
    mapping first lets safe_dump quote/scalar-encode every value correctly.
    """
    next_action = args.next_action or DEFAULT_NEXT_ACTION
    frontmatter = {
        "record_schema": 1,
        "assessment_status": "finalized",
        "record_id": record_id,
        "attempted_at": dt.date.today().isoformat(),
        "source_backed": bool(args.source_backed),
        "synthetic": bool(args.synthetic),
        "independence": args.independence,
        "record_type": "review",
        "review_kind": args.review_kind,
        "performance": args.performance,
        "hint_used": args.hint_used == "true",
        "evidence_strength": args.evidence_strength,
        "next_action": next_action,
        target_key: target,
    }
    dumped = yaml_module.safe_dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)
    return f"""---
{dumped}---
# 复习记录 {record_id}

## 原始回答

{args.raw_answer.rstrip()}

## Agent 判断

- performance: {args.performance}
- hint_used: {'true' if args.hint_used == 'true' else 'false'}
- review_kind: {args.review_kind}
- evidence_strength: {args.evidence_strength}

## 下一步

{next_action}
"""


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--objective-id", help="Course objective being reviewed")
    target_group.add_argument("--topic", help="Exam topic being reviewed")
    parser.add_argument("--review-kind", required=True, choices=REVIEW_KINDS)
    parser.add_argument("--performance", required=True, choices=PERFORMANCES)
    parser.add_argument("--hint-used", required=True, choices=("true", "false"))
    parser.add_argument("--evidence-strength", required=True, choices=EVIDENCE_STRENGTHS)
    parser.add_argument("--independence", choices=("independent", "with_hints", "ai_guided"),
                        help="Observed assistance; omitted by legacy callers means unknown")
    parser.add_argument("--raw-answer", required=True, help="Verbatim learner answer")
    parser.add_argument("--next-action", help="Defaults to a neutral next step")
    parser.add_argument("--source-backed", action="store_true")
    parser.add_argument("--synthetic", action="store_true")
    args = parser.parse_args()
    if args.independence == "independent" and args.hint_used == "true":
        return fail("independent review cannot have --hint-used true")

    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        return fail(f"package directory does not exist: {root}")

    if (root / "course.yaml").is_file():
        kind, state_file, target_key = "course", "course.yaml", "objective_id"
    elif (root / "exam.yaml").is_file():
        kind, state_file, target_key = "exam", "exam.yaml", "topic"
    else:
        return fail(f"no course.yaml or exam.yaml in package: {root}")

    raw_target = args.objective_id if target_key == "objective_id" else args.topic
    if not isinstance(raw_target, str) or not raw_target.strip():
        other = "topic" if kind == "course" else "objective-id"
        return fail(f"{kind} packages use --{other.replace('-', '_')} instead")
    target = raw_target

    try:
        state, yaml = load_state(root, state_file)
    except RuntimeError as exc:
        return fail(str(exc))

    if kind == "course":
        objectives = state.get("objectives")
        ids = {
            item.get("id")
            for item in (objectives or [])
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        if target not in ids:
            return fail(f"unknown objective {target!r}; define it in course.yaml before reviewing")

    queue = state.get("review_queue")
    if queue is None:
        queue = []
    if not isinstance(queue, list):
        return fail(f"{state_file} review_queue must be a list")

    entry = next(
        (item for item in queue if isinstance(item, dict) and item.get(target_key) == target),
        None,
    )
    previous_interval = 0
    if entry is None:
        entry = {target_key: target, "due_at": now_iso(), "interval_days": 0, "review_count": 0}
        queue.append(entry)
        state["review_queue"] = queue
    else:
        raw_interval = entry.get("interval_days")
        previous_interval = int(raw_interval) if isinstance(raw_interval, (int, float)) and not isinstance(raw_interval, bool) else 0

    records_dir = root / "records"
    sequence = next_rv_sequence(records_dir)
    record_id = f"RV{sequence:04d}"
    record_relative = f"records/{record_id}-{slugify(target)}.md"
    record_path = root / record_relative
    if record_path.exists():
        return fail(f"review record already exists: {record_relative}")

    assisted = args.hint_used == "true" or args.independence in {"with_hints", "ai_guided"}
    interval = next_interval(previous_interval, args.performance, args.review_kind, assisted)
    due_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=interval)).isoformat(timespec="seconds").replace("+00:00", "Z")
    today = dt.date.today().isoformat()

    entry.update({
        "due_at": due_at,
        "interval_days": interval,
        "review_count": int(entry.get("review_count", 0) or 0) + 1,
        "last_reviewed_at": today,
        "last_record": record_relative,
    })
    state["updated_at"] = now_iso()

    try:
        dumped = yaml.safe_dump(state, allow_unicode=True, sort_keys=False, default_flow_style=False)
    except Exception as exc:
        return fail(f"{state_file} cannot be serialized: {exc}")

    # Write both artifacts transactionally so the "every interval change
    # traces to a finalized record" invariant survives failures:
    #   1. stage the new state text in a temp file (no visible change yet);
    #   2. write the new record atomically (no partial RV#### file can
    #      survive a mid-write failure or block the next attempt);
    #   3. atomically replace the state file.
    # If step 3 fails, roll the record back: a finalized record must never
    # outlive the queue update it belongs to.
    try:
        fd, temp_name = tempfile.mkstemp(prefix=f".{state_file}.", suffix=".tmp", dir=root)
    except OSError as exc:
        return fail(f"could not create temporary state file: {exc}")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(dumped)
        record_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            atomic_write_text(record_path, build_record_text(args, record_id, target_key, target, yaml))
        except OSError as exc:
            record_path.unlink(missing_ok=True)  # remove any partial record
            return fail(f"review record could not be written: {exc}")
        try:
            os.replace(temp_name, root / state_file)
        except OSError as exc:
            try:
                record_path.unlink(missing_ok=True)
            except OSError as rollback_exc:
                print(
                    f"ERROR: {state_file} could not be updated: {exc}",
                    file=sys.stderr,
                )
                print(
                    f"ERROR: rollback of {record_relative} also failed: {rollback_exc}",
                    file=sys.stderr,
                )
                print(
                    f"RECOVERY: state update failed; delete {record_path} manually before re-running",
                    file=sys.stderr,
                )
                return 1
            return fail(
                f"{state_file} could not be updated: {exc}; rolled back {record_relative}"
            )
    except OSError as exc:
        return fail(f"could not write review artifacts: {exc}")
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)

    print(f"OK {record_relative} review_count={entry['review_count']} interval_days={interval} due_at={due_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
