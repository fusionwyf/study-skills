#!/usr/bin/env python3
"""Regenerate INDEX.md and the course index.html from lessons and course.yaml.

Lessons and records may be organized per chapter (``lessons/<章>/0001-*.html``,
``records/<章>/0001-*.md``) or flat (``lessons/0001-*.html``). Chaptered packages
restart lesson numbering at 0001 per chapter, so progress is keyed by
``<章>/<NNNN>``; flat packages keep the bare ``<NNNN>`` key. See
``course_layout`` for the shared convention.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import course_layout as layout


class LessonMeta(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.h1 = ""
        self.objective = ""
        self._in_title = False
        self._in_h1 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        self._in_title = tag.lower() == "title"
        self._in_h1 = tag.lower() == "h1"
        if not self.objective and attr_map.get("data-objective"):
            self.objective = attr_map["data-objective"] or ""

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title": self._in_title = False
        if tag.lower() == "h1": self._in_h1 = False

    def handle_data(self, data: str) -> None:
        if self._in_title: self.title += data
        if self._in_h1: self.h1 += data


def yaml_value(text: str, key: str, default: str) -> str:
    match = re.search(rf"^\s*{re.escape(key)}\s*:\s*(?:\"([^\"]*)\"|'([^']*)'|(.+?))\s*$", text, re.M)
    if not match: return default
    return next((group for group in match.groups() if group is not None), default).strip()


def read_course_meta(root: Path, state: dict | None = None) -> dict[str, object]:
    """Course metadata from the parsed state mapping.

    ``yaml_value`` is only a fallback for unreadable YAML: its ``^\\s*`` pattern
    also matches nested keys, so a chapter's ``current_lesson`` would win over
    the top-level one. Parsing the document keeps top-level semantics exact.
    """
    text = (root / "course.yaml").read_text(encoding="utf-8", errors="replace") if (root / "course.yaml").is_file() else ""
    plan = (root / "PLAN.md").read_text(encoding="utf-8", errors="replace") if (root / "PLAN.md").is_file() else ""
    plan_title = re.search(r"^#\s+(.+)$", plan, re.M)
    state = state if isinstance(state, dict) else {}

    def pick(key: str, default: str) -> str:
        value = state.get(key)
        if value is None or value == "":
            return yaml_value(text, key, default)
        return str(value)

    learner = state.get("learner") if isinstance(state.get("learner"), dict) else {}
    return {
        "title": pick("title", plan_title.group(1).strip() if plan_title else root.name),
        "course_id": pick("course_id", root.name),
        "status": pick("status", "unknown"),
        "phase": pick("phase", "unknown"),
        "current_lesson": pick("current_lesson", "0"),
        "goal": str(learner.get("goal") or ""),
    }


def collect_lessons(root: Path, chapter_order: list[str] | None = None) -> list[dict[str, str]]:
    """Scan every lesson, recursing into chapter sub-directories."""
    lessons: list[dict[str, str]] = []
    for item in layout.iter_lessons(root, chapter_order):
        parser = LessonMeta()
        try:
            parser.feed(item["path"].read_text(encoding="utf-8", errors="replace"))
        except OSError:
            continue
        fallback = Path(item["file"]).stem.split("-", 1)[-1].replace("-", " ")
        title = (parser.h1 or parser.title or fallback).strip()
        lessons.append({
            "number": item["number"],
            "chapter": item["chapter"] or "",
            "title": title,
            "objective": parser.objective or "—",
            "file": item["file"],
            "key": layout.completion_key(item["chapter"], item["number"]),
        })
    return lessons


def group_by_chapter(lessons: list[dict[str, str]]) -> list[tuple[str, list[dict[str, str]]]]:
    """(chapter label, lessons) pairs; a single ("", lessons) group when flat."""
    groups: list[tuple[str, list[dict[str, str]]]] = []
    for item in lessons:
        label = item["chapter"]
        if not groups or groups[-1][0] != label:
            groups.append((label, []))
        groups[-1][1].append(item)
    return groups


def render_markdown(meta: dict[str, object], lessons: list[dict[str, str]]) -> str:
    lines = [
        f"# {meta['title']}",
        "",
        f"- 状态：`{meta['status']}`",
        f"- 教学阶段：`{meta['phase']}`",
        f"- 已交付课程：`{len(lessons)}`",
        "",
        "## 课程索引",
        "",
    ]
    if not lessons:
        lines.append("| — | 尚未生成课程 | — | — |")
        return "\n".join(lines) + "\n"
    for label, items in group_by_chapter(lessons):
        if label:
            lines += [f"### {label}", ""]
        lines += ["| 课号 | 标题 | 学习成果标识 | 文件 |", "|---:|---|---|---|"]
        for item in items:
            title = item["title"].replace("|", "\\|")
            objective = item["objective"].replace("|", "\\|")
            lines.append(f"| {item['number']} | {title} | `{objective}` | [打开](lessons/{item['file']}) |")
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def lesson_list_items(
    lessons: list[dict[str, str]],
    completed: set[str] | None = None,
    chapters: list[dict[str, object]] | None = None,
    current_key: str | None = None,
) -> str:
    """Course outline: chapter panels with one row per lesson."""
    completed = completed or set()
    chapter_meta = {
        str(chapter.get("label")): chapter
        for chapter in (chapters or [])
        if chapter.get("label")
    }
    blocks: list[str] = []
    for group_index, (label, items) in enumerate(group_by_chapter(lessons), start=1):
        rows = []
        for item in items:
            done = item["key"] in completed
            current = bool(current_key and item["key"] == current_key)
            state_class = " is-done" if done else ""
            if current:
                state_class += " is-current"
            status = "继续" if current else ("已完成" if done else "待反馈")
            rows.append(
                f'<li class="lesson-row{state_class}">'
                f'<a href="lessons/{html.escape(item["file"])}">'
                f'<span class="lesson-row__num">{html.escape(item["number"])}</span>'
                f'<span class="lesson-row__body">'
                f'<span class="lesson-row__title">{html.escape(item["title"])}</span>'
                f'<span class="lesson-row__obj">{html.escape(item["objective"])}</span>'
                f'</span>'
                f'<span class="lesson-row__status">{status}</span>'
                f'<span class="lesson-row__arrow" aria-hidden="true">→</span>'
                f'</a></li>'
            )
        if label:
            chapter = chapter_meta.get(label, {})
            chapter_title = str(chapter.get("title") or "")
            blocks.append(
                f'<section class="outline-chapter">'
                f'<div class="outline-chapter__head">'
                f'<span class="outline-chapter__index">{group_index:02d}</span>'
                f'<div class="outline-chapter__names">'
                f'<h3 class="outline-chapter__title">{html.escape(label)}</h3>'
                f'<p class="outline-chapter__sub">{html.escape(chapter_title)}</p>'
                f'</div>'
                f'<span class="outline-chapter__count">{len(items)} 课</span>'
                f'</div>'
                f'<ol class="lesson-list">{"".join(rows)}</ol>'
                f'</section>'
            )
        else:
            blocks.append(
                f'<section class="outline-chapter outline-chapter--flat">'
                f'<ol class="lesson-list">{"".join(rows)}</ol>'
                f'</section>'
            )
    if not blocks:
        blocks.append('<p class="outline-empty">尚未生成第一课。</p>')
    return "".join(blocks)


def render_html(
    meta: dict[str, object],
    lessons: list[dict[str, str]],
    include_theme: bool = False,
    is_kit: bool = False,
    theme: str = "course",
    completed: set[str] | None = None,
    chapters: list[dict[str, object]] | None = None,
    stats: dict[str, int] | None = None,
) -> str:
    completed = completed or set()
    stats = stats or {}
    total = len(lessons)
    done = sum(1 for item in lessons if item["key"] in completed)
    percent = round(done * 100 / total) if total else 0
    current_key = lessons[-1]["key"] if lessons else None
    items = lesson_list_items(lessons, completed, chapters, current_key)
    next_href = f'lessons/{html.escape(lessons[-1]["file"])}' if lessons else "#"
    due = int(stats.get("due_reviews") or 0)
    due_chip = f'<span class="chip chip--warn">{due} 项复习到期</span>' if due else ""
    goal = str(meta.get("goal") or "").strip()
    if not goal:
        goal = "按课程路线继续学习；每次作答与反馈都会回流到课程状态。"
    course_code = str(meta.get("course_id") or "course").upper()
    if is_kit:
        theme_link = '<link rel="stylesheet" href="assets/course/theme.css">' if not include_theme else '<link rel="stylesheet" href="assets/theme.css">'
        return f'''<!doctype html>
<html lang="zh-CN" data-theme="{html.escape(theme)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(str(meta["title"]))}</title><link rel="icon" href="data:,"><link rel="stylesheet" href="assets/kit/kit.css">{theme_link}<script defer src="assets/kit/kit.js"></script></head>
<body class="kit-page kit-page--index">
<div class="kit-main" data-course-id="{html.escape(str(meta["course_id"]))}">
<header class="course-hero">
<div class="course-hero__top">
<p class="course-hero__eyebrow"><span>{html.escape(course_code)}</span><span class="course-hero__sep">/</span><span class="course-hero__eyebrow-tail">COURSE INDEX</span></p>
<div class="course-hero__tools">
<a class="course-hero__console" href="dashboard">学习仪表盘 <span aria-hidden="true">→</span></a>
</div>
</div>
<div class="course-hero__row">
<div class="course-hero__lead">
<h1 class="course-hero__title">{html.escape(str(meta["title"]))}</h1>
<p class="course-hero__lede">{html.escape(goal)}</p>
</div>
<div class="course-hero__dial" style="--p:{percent}" aria-label="课程进度 {percent}%">
<span class="course-hero__dial-value">{percent}<small>%</small></span>
<span class="course-hero__dial-label">{done} / {total}</span>
</div>
</div>
<div class="course-hero__meta">
<span class="chip">status · {html.escape(str(meta["status"]))}</span>
<span class="chip">phase · {html.escape(str(meta["phase"]))}</span>
<span class="chip chip--accent">{done} / {total} 课已完成</span>
{due_chip}
<a class="course-hero__cta" href="{next_href}">继续学习 <span aria-hidden="true">→</span></a>
</div>
</header>
<section class="course-stats" aria-label="课程统计">
<div class="stat"><span class="stat__value">{total}</span><span class="stat__label">课节总数</span></div>
<div class="stat"><span class="stat__value">{done}</span><span class="stat__label">已完成</span></div>
<div class="stat"><span class="stat__value">{int(stats.get("objectives_total") or 0)}</span><span class="stat__label">学习目标</span></div>
<div class="stat"><span class="stat__value">{int(stats.get("objectives_achieved") or 0)}</span><span class="stat__label">已达标</span></div>
</section>
<main class="course-outline">
<div class="outline-head">
<div><p class="outline-head__eyebrow">OUTLINE</p><h2>课程目录</h2></div>
<span class="outline-head__count">{total} 课</span>
</div>
{items}
</main>
<footer class="course-index__settings">
<span class="course-index__settings-label">主题</span>
<div class="kit-theme-switcher--compact" data-theme-switcher></div>
</footer>
</div>
</body></html>'''
    theme_link = '<link rel="stylesheet" href="assets/theme.css">' if include_theme else ''
    theme_attributes = ' data-theme="course" data-theme-surface="light"' if include_theme else ''
    return f'''<!doctype html>
<html lang="zh-CN"{theme_attributes}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(str(meta["title"]))}</title><link rel="stylesheet" href="assets/course.css">{theme_link}</head>
<body><div class="course-shell" data-course-id="{html.escape(str(meta["course_id"]))}"><header class="course-header"><p class="course-kicker">课程入口</p><h1 class="course-title">{html.escape(str(meta["title"]))}</h1><p class="course-subtitle">状态：{html.escape(str(meta["status"]))} · 阶段：{html.escape(str(meta["phase"]))}</p></header><main><div class="card"><h2>课程目录</h2>{items}</div></main></div></body></html>'''


def write_navigation_data(root: Path, lessons: list[dict[str, str]], meta: dict[str, object] | None = None,
                         chapters: list[dict[str, object]] | None = None) -> Path | None:
    if not (root / "course.yaml").is_file():
        return None
    nav_dir = root / "assets" / "course"
    nav_dir.mkdir(parents=True, exist_ok=True)
    meta_dict = meta or {}
    chapters = chapters or []
    chapter_labels = [chapter.get("label") for chapter in chapters if chapter.get("label")]

    enriched: list[dict[str, object]] = []
    for index, item in enumerate(lessons):
        prev_item = lessons[index - 1] if index > 0 else None
        next_item = lessons[index + 1] if index < len(lessons) - 1 else None
        entry = dict(item)
        entry["href"] = layout.lesson_href(None, item["file"], from_is_lesson=False)
        entry["home"] = layout.home_href(root, item["chapter"] or None)
        for side, other in (("prev", prev_item), ("next", next_item)):
            if other:
                entry[side] = {
                    "number": other["number"],
                    "file": other["file"],
                    "chapter": other["chapter"],
                    "key": other["key"],
                    "href": layout.lesson_href(item["file"], other["file"]),
                }
            else:
                entry[side] = None
        entry.pop("path", None)
        enriched.append(entry)

    completed = layout.completed_lesson_keys(root)
    cur_val = meta_dict.get("current_lesson") or 0
    try:
        cur_num = int(cur_val)
    except (ValueError, TypeError):
        cur_num = len(completed) if completed else len(enriched)

    nav_data: dict[str, object] = {
        "title": meta_dict.get("title") or root.name,
        "course_id": meta_dict.get("course_id") or root.name,
        "current_lesson": cur_num,
        "completed_lessons": completed,
        "completed_count": len(completed),
        "total_count": len(enriched),
        "lessons": enriched,
        "home": "../index.html",
    }
    if chapter_labels:
        nav_data["chapters"] = chapters
        nav_data["chaptered"] = True
    nav_file = nav_dir / "nav.json"
    nav_file.write_text(json.dumps(nav_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return nav_file


def main() -> int:
    layout.ensure_utf8_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--nav", action="store_true", help="Generate assets/course/nav.json navigation manifest")
    parser.add_argument("--nav-only", action="store_true", dest="nav_only",
                        help="Only write nav.json; leave INDEX.md and index.html untouched")
    args = parser.parse_args()
    root = Path(args.course_dir).expanduser().resolve()
    if not root.is_dir(): raise SystemExit(f"course directory does not exist: {root}")
    state = _load_state(root)
    meta = read_course_meta(root, state)
    chapters = layout.chapters_of_state(state)
    chapter_order = [chapter["label"] for chapter in chapters]
    lessons = collect_lessons(root, chapter_order)
    is_kit = (root / "assets/kit/kit.css").is_file()
    theme = "course"
    config_file = root / "assets/course/config.json"
    if config_file.is_file():
        try:
            theme = json.loads(config_file.read_text(encoding="utf-8")).get("theme") or theme
        except Exception:
            pass

    completed = set(layout.completed_lesson_keys(root))
    objectives = state.get("objectives") if isinstance(state.get("objectives"), list) else []
    achieved = sum(
        1 for objective in objectives
        if isinstance(objective, dict) and objective.get("mastery") in {"application", "transfer"}
    )
    today = date.today().isoformat()
    review_queue = state.get("review_queue") if isinstance(state.get("review_queue"), list) else []
    due = sum(
        1 for item in review_queue
        if isinstance(item, dict) and str(item.get("due_at") or "")[:10] and str(item.get("due_at"))[:10] <= today
    )
    stats = {
        "objectives_total": len(objectives),
        "objectives_achieved": achieved,
        "due_reviews": due,
    }
    outputs = {
        root / "INDEX.md": render_markdown(meta, lessons),
        root / "index.html": render_html(
            meta, lessons, (root / "assets/theme.css").is_file(), is_kit, theme,
            completed=completed, chapters=chapters, stats=stats,
        ),
    }
    if args.nav_only:
        outputs = {}
    if args.dry_run:
        for path, content in outputs.items(): print(f"--- {path} ---\n{content}")
    else:
        for path, content in outputs.items(): path.write_text(content, encoding="utf-8", newline="\n")
        if outputs:
            print(root / "INDEX.md")
            print(root / "index.html")
        if args.nav:
            nav_p = write_navigation_data(root, lessons, meta, chapters)
            if nav_p:
                print(nav_p)
    return 0


def _load_state(root: Path) -> dict:
    path = root / "course.yaml"
    if not path.is_file():
        return {}
    try:
        import yaml  # type: ignore
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


if __name__ == "__main__":
    raise SystemExit(main())
