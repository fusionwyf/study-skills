#!/usr/bin/env python3
"""Create a portable learning-course package from the bundled template."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

KIT_ROOT = Path(__file__).resolve().parents[1] / "kit"


def builtin_themes() -> tuple[str, ...]:
    """Built-in presets are whatever ships in kit/foundation/themes/*.css."""
    themes_dir = KIT_ROOT / "foundation" / "themes"
    if not themes_dir.is_dir():
        return ("course",)
    return tuple(sorted(path.stem for path in themes_dir.glob("*.css")))


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
    parser.add_argument(
        "--theme",
        default="course",
        help="Visual preset: a built-in name from kit/foundation/themes/*.css (swiss/blueprint/riso/brutal/field/"
             "course/ink/paper) or a custom theme the agent authors in assets/course/themes/<name>.css",
    )
    parser.add_argument("--language", default="zh-CN")
    parser.add_argument("--diagnostic", action="store_true", help="Start with a minimal diagnostic")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files")
    args = parser.parse_args()

    course_dir = Path(args.course_dir).expanduser().resolve()
    course_id = slugify(course_dir.name)
    theme = re.sub(r"[^a-z0-9_-]+", "-", args.theme.strip().lower()) or "course"
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    for name in ("lessons", "assets", "reference", "records", "exports"):
        (course_dir / name).mkdir(parents=True, exist_ok=True)
    (course_dir / "assets" / "course" / "themes").mkdir(parents=True, exist_ok=True)

    starter_template = Path(__file__).resolve().parents[1] / "templates" / "lesson.html"
    if starter_template.is_file():
        lesson_content = starter_template.read_text(encoding="utf-8")
        lesson_content = lesson_content.replace("example-course", course_id)
        lesson_content = lesson_content.replace("课程标题", html.escape(args.title))
        lesson_content = lesson_content.replace('data-theme="course"', f'data-theme="{theme}"')
        write_text(course_dir / "lessons/0001-lesson.html", lesson_content, args.force)

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

    # Kit v2 sync bundles assets/kit/ and assets/course/
    config_dir = course_dir / "assets" / "course"
    config_file = config_dir / "config.json"
    if config_file.exists() and not args.force:
        raise FileExistsError(f"Refusing to overwrite existing file: {config_file}")
    builtin = builtin_themes()
    themes_list = [theme] + [name for name in builtin if name != theme]
    config = {
        "theme": theme,
        "themes": themes_list,
        "customThemes": {},
        "vendor": {"mode": "cdn"},
        "code": {"themes": {"light": "github", "dark": "github-dark"}},
        "modules": [],
    }
    config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    kit_py = Path(__file__).resolve().parents[1] / "kit" / "build" / "kit.py"
    if kit_py.is_file():
        import subprocess
        subprocess.run([sys.executable, str(kit_py), "sync", str(course_dir)], check=True)
    if theme not in builtin and not any((config_dir / "themes").glob("*.css")):
        print(
            f"NOTE: theme '{theme}' is not a built-in preset and assets/course/themes/ is empty; "
            f"author assets/course/themes/{theme}.css with a @kit-theme header, then re-run kit.py sync.",
            file=sys.stderr,
        )

    # PLAN.md 渲染自 templates/PLAN.md（唯一模板源；占位符 {{TITLE}}/{{GOAL}}/{{THEME}}/{{THEMES}}）
    plan_template = Path(__file__).resolve().parents[1] / "templates" / "PLAN.md"
    plan = (
        plan_template.read_text(encoding="utf-8")
        .replace("{{TITLE}}", args.title)
        .replace("{{GOAL}}", args.goal)
        .replace("{{THEME}}", theme)
        .replace("{{THEMES}}", "、".join(themes_list))
    )
    write_text(course_dir / "PLAN.md", plan, args.force)
    write_text(course_dir / "INDEX.md", f"# {args.title}\n\n课程索引将从 `course.yaml` 和 `lessons/` 生成。\n", args.force)

    title = html.escape(args.title)
    index = f"""<!doctype html>
<html lang=\"{html.escape(args.language)}\" data-theme=\"{theme}\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{title}</title>
  <link rel=\"stylesheet\" href=\"assets/kit/kit.css\">
  <link rel=\"stylesheet\" href=\"assets/course/theme.css\">
  <script defer src=\"assets/kit/kit.js\"></script>
</head>
<body class=\"kit-page\">
  <div class=\"kit-main\" data-course-id=\"{course_id}\">
    <header class=\"course-header\">
      <p class=\"course-kicker\">课程入口</p>
      <h1 class=\"course-title\">{title}</h1>
      <p class=\"course-subtitle\">{html.escape(args.goal)}</p>
      <div data-theme-switcher></div>
    </header>
    <main>
      <div class=\"callout\" data-callout=\"note\">
        <h2>开始学习</h2>
        <p>课程完成后，新的课件会出现在 <code>lessons/</code>，学习反馈请发给老师或 Agent。</p>
        <p>当前尚未生成第一课。</p>
      </div>
    </main>
  </div>
</body>
</html>"""
    write_text(course_dir / "index.html", index, args.force)
    print(course_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
