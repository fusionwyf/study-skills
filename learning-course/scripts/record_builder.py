#!/usr/bin/env python3
"""Shared pending-record builder for every evidence capture path.

``kit.py serve``（实时自动落盘）、``kit.py ingest``（离线补偿）和
``update_progress.py``（纯离线兜底）必须产出字节级一致的
``records/<NNNN>-feedback.md``，因此模板、record_id 分配、inbox 合并与
``course.yaml`` 的 ``last_feedback`` 回写都收敛在本模块。
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

RECORD_FILENAME_RE = re.compile(r"^(\d{4})-")
LESSON_ID_RE = re.compile(r"^(\d{1,4})$")
RAW_SECTION_RE = re.compile(r"(## 学习者原始反馈\s*\n)(.*?)(\n## 可观察行为)", re.DOTALL)
ATTEMPTED_AT_RE = re.compile(r"^attempted_at\s*:.*$", re.M)

SKILL_SCRIPTS = Path(__file__).resolve().parent
if str(SKILL_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS))

import course_layout  # noqa: E402


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today() -> str:
    return date.today().isoformat()


def next_record_sequence(records_dir: Path) -> int:
    highest = 0
    if records_dir.is_dir():
        for entry in records_dir.iterdir():
            match = RECORD_FILENAME_RE.match(entry.name)
            if match:
                highest = max(highest, int(match.group(1)))
    return highest + 1


def render_pending_record(
    lesson: int,
    raw_markdown: str,
    record_id: str,
    attempted_at: str,
    independence: str | None = None,
) -> str:
    """The single pending-record template shared by all capture paths."""
    return f"""---
record_schema: 1
assessment_status: pending
record_id: {record_id}
attempted_at: {attempted_at}
source_backed: false
synthetic: false
independence: {independence or 'null'}
lesson: {lesson}
evidence_type: null
evidence_strength: null
supported_objectives: []
---
# 第 {lesson:04d} 课学习记录

## 学习者原始反馈

{raw_markdown.rstrip()}

## 可观察行为

- 回答了什么：待 Agent 根据原始反馈填写。
- 正确性或产物结果：待判断。
- 是否使用提示：待判断。
- 是否包含解释或迁移：待判断。

## Agent 判断

- 仍不确定：待 Agent 补充。完成判断后同步填写 frontmatter，并将 `assessment_status` 设为 `finalized`。

## 下一步

- 下一步动作：待 Agent 补充（next_action 具体到下一次动作）。
"""


def resolve_lesson_target(course_root: Path, lesson_id: str) -> tuple[Path, str | None, int] | None:
    """Map a lesson id ("0001") to (record_dir, chapter_label, lesson_number).

    Chaptered packages restart numbering per chapter, so the id alone is
    ambiguous; the first matching lesson file decides the chapter.
    """
    match = LESSON_ID_RE.match(str(lesson_id or "").strip())
    if not match:
        return None
    number = f"{int(match.group(1)):04d}"
    for entry in course_layout.iter_lessons(course_root):
        if entry["number"] == number:
            chapter = entry["chapter"]
            return course_layout.record_dir_for(course_root, chapter), chapter, int(number)
    return None


def write_atomic(path: Path, content: str) -> None:
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def refresh_raw_section(text: str, raw_markdown: str) -> str:
    """Replace the learner-raw section of a pending record, keep everything else."""
    updated = RAW_SECTION_RE.sub(
        lambda match: match.group(1) + raw_markdown.strip() + match.group(3), text, count=1
    )
    if updated != text:
        updated = ATTEMPTED_AT_RE.sub(f"attempted_at: {today()}", updated, count=1)
    return updated


def merge_inbox_payload(course_root: Path, payload: dict) -> dict:
    """Merge one inbox payload into records/<NNNN>-feedback.md.

    Returns {"record": <relative path> | None, "skipped": <reason> | None}.
    Finalized records are never overwritten; their raw evidence stays in the
    inbox snapshot. Non-numeric lesson ids and empty payloads only leave the
    inbox file behind.
    """
    result: dict = {"record": None, "skipped": None}
    raw = str(payload.get("markdown") or "").strip()
    if payload.get("has_content") is False or not raw:
        result["skipped"] = "payload has no learner content"
        return result
    target = resolve_lesson_target(course_root, str(payload.get("lesson", "")))
    if target is None:
        result["skipped"] = f"unresolvable lesson id: {payload.get('lesson')!r}"
        return result
    record_dir, _, lesson = target
    record_dir.mkdir(parents=True, exist_ok=True)
    record_path = record_dir / f"{lesson:04d}-feedback.md"

    if record_path.exists():
        text = record_path.read_text(encoding="utf-8")
        if re.search(r"^assessment_status\s*:\s*finalized\s*$", text, re.M):
            result["skipped"] = "record already finalized; inbox snapshot kept only"
            return result
        write_atomic(record_path, refresh_raw_section(text, raw))
    else:
        record_id = "L%04d" % next_record_sequence(record_dir)
        write_atomic(record_path, render_pending_record(lesson, raw, record_id, today()))
    result["record"] = record_path.relative_to(course_root).as_posix()
    return result


def update_last_feedback(course_root: Path, record_relative: str) -> bool:
    """Point course.yaml last_feedback at the record; best-effort (needs PyYAML)."""
    try:
        import yaml  # type: ignore
    except ImportError:
        return False
    state_path = course_root / "course.yaml"
    if not state_path.is_file():
        return False
    try:
        state = yaml.safe_load(state_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return False
    if not isinstance(state, dict) or state.get("last_feedback") == record_relative:
        return False
    state["last_feedback"] = record_relative
    state["updated_at"] = now_iso()
    fd, temp_name = tempfile.mkstemp(prefix=f".{state_path.name}.", suffix=".tmp", dir=state_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            yaml.safe_dump(state, handle, allow_unicode=True, sort_keys=False, default_flow_style=False)
        os.replace(temp_name, state_path)
    except Exception:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        return False
    return True


def ingest_inbox(course_root: Path, quiet: bool = False) -> int:
    """Merge every records/inbox/*.json snapshot; returns the merged count."""
    inbox_dir = course_root / "records" / "inbox"
    merged = 0
    if not inbox_dir.is_dir():
        if not quiet:
            print("No records/inbox/ directory found.")
        return 0
    files = sorted(inbox_dir.glob("*.json"))
    if not files:
        if not quiet:
            print("Inbox is empty.")
        return 0
    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"Skipping bad JSON {path.name}: {exc}", file=sys.stderr)
            continue
        outcome = merge_inbox_payload(course_root, payload)
        if outcome["record"]:
            merged += 1
            record_rel = outcome["record"]
            update_last_feedback(course_root, record_rel)
            if not quiet:
                print(f"Merged {path.name} -> {record_rel}")
        elif outcome["skipped"] and not quiet:
            print(f"Skipped {path.name}: {outcome['skipped']}")
    return merged
