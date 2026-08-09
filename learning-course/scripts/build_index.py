#!/usr/bin/env python3
"""Regenerate INDEX.md and the course index.html from lessons and course.yaml."""

from __future__ import annotations

import argparse
import html
import re
from html.parser import HTMLParser
from pathlib import Path


LESSON_RE = re.compile(r"^(\d{4})-(.+)\.html$", re.I)


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


def read_course_meta(root: Path) -> dict[str, str]:
    state = (root / "course.yaml").read_text(encoding="utf-8", errors="replace") if (root / "course.yaml").is_file() else ""
    plan = (root / "PLAN.md").read_text(encoding="utf-8", errors="replace") if (root / "PLAN.md").is_file() else ""
    plan_title = re.search(r"^#\s+(.+)$", plan, re.M)
    return {
        "title": yaml_value(state, "title", plan_title.group(1).strip() if plan_title else root.name),
        "status": yaml_value(state, "status", "unknown"),
        "phase": yaml_value(state, "phase", "unknown"),
        "current_lesson": yaml_value(state, "current_lesson", "0"),
    }


def collect_lessons(root: Path) -> list[dict[str, str]]:
    lessons: list[dict[str, str]] = []
    lesson_dir = root / "lessons"
    if not lesson_dir.is_dir(): return lessons
    for path in sorted(lesson_dir.glob("*.html")):
        match = LESSON_RE.match(path.name)
        if not match: continue
        parser = LessonMeta()
        parser.feed(path.read_text(encoding="utf-8", errors="replace"))
        number = match.group(1)
        title = (parser.h1 or parser.title or match.group(2).replace("-", " ")).strip()
        lessons.append({"number": number, "title": title, "objective": parser.objective or "—", "file": path.name})
    return lessons


def render_markdown(meta: dict[str, str], lessons: list[dict[str, str]]) -> str:
    lines = [f"# {meta['title']}", "", f"- 状态：`{meta['status']}`", f"- 教学阶段：`{meta['phase']}`", f"- 当前课：`{meta['current_lesson']}`", "", "## 课程索引", "", "| 课号 | 标题 | 学习成果标识 | 文件 |", "|---:|---|---|---|"]
    if not lessons: lines.append("| — | 尚未生成课程 | — | — |")
    else:
        for item in lessons:
            title = item["title"].replace("|", "\\|")
            objective = item["objective"].replace("|", "\\|")
            lines.append(f"| {item['number']} | {title} | `{objective}` | [打开](lessons/{item['file']}) |")
    return "\n".join(lines) + "\n"


def render_html(meta: dict[str, str], lessons: list[dict[str, str]]) -> str:
    items = []
    for item in lessons:
        items.append(f'<li><a href="lessons/{html.escape(item["file"])}">第 {item["number"]} 课：{html.escape(item["title"])}</a><small>{html.escape(item["objective"])}</small></li>')
    if not items: items.append("<li>尚未生成第一课。</li>")
    return f'''<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(meta["title"])}</title><link rel="stylesheet" href="assets/course.css"></head>
<body><div class="course-shell"><header class="course-header"><p class="course-kicker">课程入口</p><h1 class="course-title">{html.escape(meta["title"])}</h1><p class="course-subtitle">状态：{html.escape(meta["status"])} · 阶段：{html.escape(meta["phase"])}</p></header><main><div class="card"><h2>课程目录</h2><ol>{''.join(items)}</ol></div></main></div></body></html>'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    root = Path(args.course_dir).expanduser().resolve()
    if not root.is_dir(): raise SystemExit(f"course directory does not exist: {root}")
    meta = read_course_meta(root)
    lessons = collect_lessons(root)
    outputs = {root / "INDEX.md": render_markdown(meta, lessons), root / "index.html": render_html(meta, lessons)}
    if args.dry_run:
        for path, content in outputs.items(): print(f"--- {path} ---\n{content}")
    else:
        for path, content in outputs.items(): path.write_text(content, encoding="utf-8", newline="\n")
        print(root / "INDEX.md")
        print(root / "index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
