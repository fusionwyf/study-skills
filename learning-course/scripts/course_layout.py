#!/usr/bin/env python3
"""Chapter-aware layout helpers for learning-course packages.

Two layouts are supported and both must keep working:

* flat      ``lessons/0001-slug.html``  + ``records/0001-feedback.md``
* chaptered ``lessons/<章>/0001-slug.html`` + ``records/<章>/0001-feedback.md``

A chaptered package is still **one** course: a single ``course.yaml``, one set of
objectives, one ``assets/``. Lesson numbers restart at ``0001`` inside every
chapter, so a bare lesson number is *not* unique. Progress identity is therefore
a composite key: ``"<章>/0001"`` when chaptered, ``"0001"`` when flat.

Every scan in the toolchain goes through this module so the build scripts, the
kit bundler and the progress updater agree on one convention.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path, PurePosixPath

LESSON_NAME_RE = re.compile(r"^(\d{4})-([a-z0-9一-鿿-]+)\.html$", re.I)
SEP = "/"


def ensure_utf8_streams() -> None:
    """Force UTF-8 on stdout/stderr.

    Callers such as ``kit.py sync`` capture this script's output with
    ``text=True``; on a Chinese Windows console the default codec is cp936, so
    course paths containing CJK characters break the parent's reader thread.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def lesson_number(path: Path) -> str | None:
    """Four-digit lesson number taken from the file name."""
    match = LESSON_NAME_RE.match(path.name)
    return match.group(1) if match else None


def is_chaptered(course_root: Path) -> bool:
    """True when any lesson lives in a chapter sub-directory of lessons/."""
    lessons = Path(course_root) / "lessons"
    if not lessons.is_dir():
        return False
    return any(LESSON_NAME_RE.match(path.name) for path in lessons.glob("*/*.html"))


def chapter_of(file_rel: str) -> str | None:
    """Chapter label for a lessons/-relative path, or None when flat."""
    parts = Path(file_rel).parts
    return parts[0] if len(parts) > 1 else None


def completion_key(chapter: str | None, number: str) -> str:
    return f"{chapter}{SEP}{number}" if chapter else str(number)


def split_completion_key(key: str) -> tuple[str | None, str]:
    if SEP in key:
        chapter, _, number = key.rpartition(SEP)
        return (chapter or None), number
    return None, key


def _chapter_rank(order: list[str] | None) -> callable:
    ranking = {label: index for index, label in enumerate(order or [])}
    return lambda label: (ranking.get(label, len(ranking)), label)


def iter_lessons(course_root: Path, chapter_order: list[str] | None = None) -> list[dict]:
    """All lessons, recursing into chapter sub-directories.

    Returns dicts with ``number``, ``chapter`` (None when flat), ``file``
    (lessons/-relative, forward slashes) and ``path``.
    """
    lessons_dir = Path(course_root) / "lessons"
    if not lessons_dir.is_dir():
        return []
    collected: list[dict] = []
    for path in sorted(lessons_dir.rglob("*.html")):
        number = lesson_number(path)
        if not number:
            continue
        rel = path.relative_to(lessons_dir).as_posix()
        collected.append({
            "number": number,
            "chapter": chapter_of(rel),
            "file": rel,
            "path": path,
        })
    rank = _chapter_rank(chapter_order)
    collected.sort(key=lambda item: (rank(item["chapter"]), item["number"]) if item["chapter"] else ("", item["number"]))
    return collected


def iter_record_files(course_root: Path) -> list[Path]:
    """All record markdown files, recursing into chapter sub-directories."""
    records_dir = Path(course_root) / "records"
    if not records_dir.is_dir():
        return []
    return sorted(records_dir.rglob("*.md"))


FINALIZED_RE = re.compile(r"^\s*assessment_status\s*:\s*(\w+)", re.M)
RECORD_LESSON_RE = re.compile(r"^\s*lesson\s*:\s*[\"']?(\d+)[\"']?", re.M)
RECORD_NAME_RE = re.compile(r"^(\d{4})-")


def record_chapter(path: Path, records_dir: Path) -> str | None:
    """Chapter label a record belongs to, taken from its sub-directory."""
    try:
        parts = Path(path).resolve().relative_to(Path(records_dir).resolve()).parts
    except ValueError:
        return None
    return parts[0] if len(parts) > 1 else None


def completed_lesson_keys(course_root: Path) -> list[str]:
    """Composite progress keys for lessons backed by finalized records.

    Only records carrying YAML frontmatter with ``assessment_status: finalized``
    count. The lesson number comes from the ``lesson`` field, falling back to a
    ``NNNN-`` file-name prefix. The chapter comes from the record's
    sub-directory, so chaptered and flat packages need no record rewrite.
    """
    records_dir = Path(course_root) / "records"
    if not records_dir.is_dir():
        return []
    keys: set[str] = set()
    for path in sorted(records_dir.rglob("*.md")):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if not text.startswith("---"):
            continue
        parts = text.split("---", 2)
        if len(parts) < 3:
            continue
        frontmatter = parts[1]
        status = FINALIZED_RE.search(frontmatter)
        if not status or status.group(1).lower() != "finalized":
            continue
        lesson = RECORD_LESSON_RE.search(frontmatter)
        if lesson:
            number = f"{int(lesson.group(1)):04d}"
        else:
            fallback = RECORD_NAME_RE.match(path.name)
            if not fallback:
                continue
            number = fallback.group(1)
        keys.add(completion_key(record_chapter(path, records_dir), number))
    return sorted(keys)


def record_dir_for(course_root: Path, chapter: str | None) -> Path:
    records_dir = Path(course_root) / "records"
    return records_dir / chapter if chapter else records_dir


def lesson_dir_for(course_root: Path, chapter: str | None) -> Path:
    lessons_dir = Path(course_root) / "lessons"
    return lessons_dir / chapter if chapter else lessons_dir


def chapters_of_state(state: dict) -> list[dict]:
    """Normalized ``chapters`` entries; empty list for a flat course."""
    raw = state.get("chapters") if isinstance(state, dict) else None
    if not isinstance(raw, list):
        return []
    normalized: list[dict] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        label = item.get("label") or item.get("title") or item.get("id") or f"chapter-{index + 1}"
        normalized.append({
            "index": index,
            "id": item.get("id") or label,
            "label": label,
            "title": item.get("title") or label,
            "lesson_dir": item.get("lesson_dir") or f"lessons/{label}",
            "records_dir": item.get("records_dir") or f"records/{label}",
            "current_lesson": item.get("current_lesson"),
            "diagnostic": item.get("diagnostic"),
        })
    return normalized


def chapter_names(state: dict) -> list[str]:
    return [chapter["label"] for chapter in chapters_of_state(state)]


def resolve_chapter(state: dict, wanted: str | None) -> dict | None:
    """Match a chapter by label, id or title."""
    if wanted is None:
        return None
    for chapter in chapters_of_state(state):
        if wanted in (chapter["label"], chapter["id"], chapter["title"]):
            return chapter
    return None


def lesson_exists(course_root: Path, number: int, chapter: str | None = None) -> bool:
    needle = f"{int(number):04d}"
    for item in iter_lessons(course_root):
        if item["number"] != needle:
            continue
        if chapter is None or item["chapter"] == chapter:
            return True
    return False


def lesson_href(from_file: str | None, to_file: str, from_is_lesson: bool = True) -> str:
    """Relative href from one lesson page to another.

    ``from_file``/``to_file`` are lessons/-relative paths; ``from_file`` is None
    when linking from the course index page.
    """
    if not from_is_lesson or from_file is None:
        return f"lessons/{Path(to_file).as_posix()}"
    base = Path(from_file).parent
    target = (Path("lessons") / Path(to_file).as_posix()).as_posix()
    source = (Path("lessons") / base.as_posix()).as_posix() if base.parts else "lessons"
    return PurePosixPath(os.path.relpath(target, source).replace("\\", "/")).as_posix()


def home_href(course_root: Path, chapter: str | None) -> str:
    """Course index link as seen from a lesson page inside ``chapter``."""
    return "../index.html" if not chapter else "../../index.html"
