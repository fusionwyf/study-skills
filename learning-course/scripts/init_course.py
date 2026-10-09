#!/usr/bin/env python3
"""Create a portable learning-course package from the bundled template."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", value)
    return value.strip("-") or "course"


def write_text(path: Path, content: str, force: bool = False) -> None:
    if path.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def yaml_quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course-dir", required=True, help="Destination course directory")
    parser.add_argument("--title", required=True, help="Human-facing course title")
    parser.add_argument("--goal", required=True, help="Learner's real-world goal")
    parser.add_argument("--language", default="zh-CN")
    parser.add_argument("--diagnostic", action="store_true", help="Start with a minimal diagnostic")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files")
    args = parser.parse_args()

    course_dir = Path(args.course_dir).expanduser().resolve()
    course_id = slugify(course_dir.name)
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    template_dir = Path(__file__).resolve().parents[1] / "assets" / "course-template"
    learnkit_dir = Path(__file__).resolve().parents[1] / "assets" / "learnkit"

    for name in ("lessons", "assets", "reference", "records", "exports"):
        (course_dir / name).mkdir(parents=True, exist_ok=True)

    for filename in ("course.css", "course.js"):
        target = course_dir / "assets" / filename
        if target.exists() and not args.force:
            raise FileExistsError(f"Refusing to overwrite existing file: {target}")
        shutil.copy2(template_dir / filename, target)

    # L1 runtime and the declarative schema are dependency-free, so every new
    # course gets the same portable foundation. Math rendering comes from the
    # KaTeX CDN. Optional components (code highlighting, theme, charting) are
    # deliberately absent here and installed on demand with install_optional.py,
    # so a plain course stays small and offline.
    learnkit_target = course_dir / "assets" / "learnkit"
    learnkit_target.mkdir(parents=True, exist_ok=True)
    for filename in ("learnkit.js", "lesson-spec.schema.json", "components.json"):
        target = learnkit_target / filename
        if target.exists() and not args.force:
            raise FileExistsError(f"Refusing to overwrite existing file: {target}")
        shutil.copy2(learnkit_dir / filename, target)

    phase = "diagnostic" if args.diagnostic else "designing"
    diagnostic_status = "pending" if args.diagnostic else "skipped"
    skipped_reason = "null" if args.diagnostic else yaml_quote("起点已有充分信息，初始化时不需要诊断")

    course_yaml = f"""schema_version: 3
course_id: {course_id}
title: {yaml_quote(args.title)}
language: {yaml_quote(args.language)}
created_at: {now}
updated_at: {now}
status: active
phase: {phase}
learner:
  goal: {yaml_quote(args.goal)}
  motivation: null
  prior_knowledge: []
  constraints: {{}}
diagnostic:
  status: {diagnostic_status}
  record: null
  skipped_reason: {skipped_reason}
success_criteria: []
current_lesson: 0
objectives: []
review_queue: []
last_feedback: null
"""
    write_text(course_dir / "course.yaml", course_yaml, args.force)

    plan = f"""# {args.title}

## 课程契约

- 学习目标：{args.goal}

## 课程边界

待与学习者确认。

## 成功标准

待与学习者确认。

## 路线概览

待设计。路线可以根据后续学习证据调整。

## 学习记录约定

学习者原始反馈和 Agent 的证据判断保存在 `records/`。
"""
    write_text(course_dir / "PLAN.md", plan, args.force)
    write_text(course_dir / "INDEX.md", f"# {args.title}\n\n课程索引将从 `course.yaml` 和 `lessons/` 生成。\n", args.force)

    title = html.escape(args.title)
    index = f"""<!doctype html>
<html lang=\"{html.escape(args.language)}\">
<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{title}</title><link rel=\"stylesheet\" href=\"assets/course.css\"></head>
<body><div class=\"course-shell\"><header class=\"course-header\"><p class=\"course-kicker\">课程入口</p><h1 class=\"course-title\">{title}</h1><p class=\"course-subtitle\">{html.escape(args.goal)}</p></header><main><div class=\"card\"><h2>开始学习</h2><p>课程完成后，新的课件会出现在 <code>lessons/</code>，学习反馈请发给老师或 Agent。</p><p>当前尚未生成第一课。</p></div></main></div></body></html>"""
    write_text(course_dir / "index.html", index, args.force)
    print(course_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
