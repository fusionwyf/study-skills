#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migrate legacy question patterns to Course Kit v2 modern question syntax.

Usage:
  python kit/build/migrate_questions.py <course-dir-or-html> [--dry-run]
  python kit/build/migrate_questions.py <course-dir-or-html> --apply [--backup-dir <dir>]
"""

import argparse
import os
import re
import shutil
import sys
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from bs4 import BeautifulSoup, Comment
except ImportError:
    BeautifulSoup = None


def migrate_quiz_element(soup, el):
    """
    Migrates .quiz[data-question-id] to <section class="question" data-kind="choice">
    """
    qid = el.get("data-question-id")
    if not qid:
        return False

    section = soup.new_tag("section")
    section["class"] = "question"
    section["data-question-id"] = qid
    section["data-kind"] = "choice"

    max_att = el.get("data-max-attempts", "2")
    section["data-max-attempts"] = max_att

    # Extract stem
    stem_el = el.find(class_=re.compile(r"quiz-stem|q-stem"))
    stem_tag = soup.new_tag("div")
    stem_tag["data-stem"] = ""
    if stem_el:
        for child in list(stem_el.contents):
            stem_tag.append(child.extract() if hasattr(child, "extract") else child)
    else:
        # First p or text before options
        first_p = el.find("p")
        if first_p and not first_p.find_parent(class_=re.compile(r"quiz-option|quiz-feedback|quiz-hint")):
            stem_tag.append(first_p.extract())
        else:
            p = soup.new_tag("p")
            p.string = "请选择正确答案："
            stem_tag.append(p)
    section.append(stem_tag)

    # Extract options
    options_ol = soup.new_tag("ol")
    options_ol["data-options"] = ""
    opts = el.find_all(class_=re.compile(r"quiz-option"))
    if not opts:
        opts = el.find_all("label")

    for opt in opts:
        li = soup.new_tag("li")
        li["data-option"] = ""

        inp = opt.find("input")
        is_correct = False
        if inp:
            if inp.get("data-correct") in ("true", "1") or inp.has_attr("data-correct"):
                is_correct = True
            inp.decompose()

        if is_correct:
            li["data-correct"] = ""

        # Check for why / explanation
        why_node = opt.find(attrs={"data-why": True})
        if why_node:
            why_tag = soup.new_tag("span")
            why_tag["data-why"] = ""
            why_tag.string = why_node.get_text().strip()
            why_node.decompose()
            li.string = opt.get_text().strip()
            li.append(why_tag)
        else:
            li.string = opt.get_text().strip()

        options_ol.append(li)
    section.append(options_ol)

    # Extract hints
    hints = el.find_all(class_=re.compile(r"quiz-hint-panel|quiz-hint"))
    hints_list = []
    for h in hints:
        txt = h.get_text().strip()
        if txt and txt not in hints_list:
            hints_list.append(txt)

    if hints_list:
        hints_ol = soup.new_tag("ol")
        hints_ol["data-hints"] = ""
        for h_txt in hints_list:
            h_li = soup.new_tag("li")
            h_li.string = h_txt
            hints_ol.append(h_li)
        section.append(hints_ol)

    # Extract explanation
    explain_src = el.find(class_=re.compile(r"quiz-explain|quiz-explanation"))
    if explain_src:
        explain_div = soup.new_tag("div")
        explain_div["data-explain"] = ""
        for child in list(explain_src.contents):
            explain_div.append(child.extract() if hasattr(child, "extract") else child)
        section.append(explain_div)

    el.replace_with(section)
    return True


def migrate_answer_element(soup, el):
    """
    Migrates [data-answer-input] + [data-answer-check] to numeric / fill question.
    """
    qid = el.get("data-question-id")
    if not qid:
        return False

    kind = el.get("data-answer-kind", "numeric")
    section = soup.new_tag("section")
    section["class"] = "question"
    section["data-question-id"] = qid
    section["data-kind"] = kind

    if el.get("data-expected"):
        section["data-expected"] = el["data-expected"]
    if el.get("data-tolerance"):
        section["data-tolerance"] = el["data-tolerance"]
    if el.get("data-unit"):
        section["data-unit"] = el["data-unit"]
    if el.get("data-accepted"):
        section["data-accepted"] = el["data-accepted"]
    if el.get("data-max-attempts"):
        section["data-max-attempts"] = el["data-max-attempts"]

    # Stem
    stem_el = el.find(class_=re.compile(r"answer-stem|q-stem")) or el.find("p")
    stem_tag = soup.new_tag("div")
    stem_tag["data-stem"] = ""
    if stem_el:
        stem_tag.append(stem_el.extract())
    else:
        p = soup.new_tag("p")
        p.string = "请计算并输入答案："
        stem_tag.append(p)
    section.append(stem_tag)

    # Hints
    hints_ol = soup.new_tag("ol")
    hints_ol["data-hints"] = ""
    hint_found = False
    for h in el.find_all(attrs={"data-hint": True}):
        txt = h.get_text().strip()
        if txt:
            h_li = soup.new_tag("li")
            h_li.string = txt
            hints_ol.append(h_li)
            hint_found = True
    if hint_found:
        section.append(hints_ol)

    # Explain
    explain_src = el.find(class_=re.compile(r"answer-explain"))
    if explain_src:
        explain_div = soup.new_tag("div")
        explain_div["data-explain"] = ""
        for child in list(explain_src.contents):
            explain_div.append(child.extract() if hasattr(child, "extract") else child)
        section.append(explain_div)

    el.replace_with(section)
    return True


def migrate_teaching_target_element(soup, el):
    """
    Migrates [data-role~="teaching-target"] to data-kind="open".
    """
    qid = el.get("data-question-id", "open-q")
    section = soup.new_tag("section")
    section["class"] = "question"
    section["data-question-id"] = qid
    section["data-kind"] = "open"

    # Stem
    stem_tag = soup.new_tag("div")
    stem_tag["data-stem"] = ""
    label = el.find("label") or el.find("p")
    if label:
        stem_tag.append(label.extract())
    else:
        p = soup.new_tag("p")
        p.string = "请写下你的回答："
        stem_tag.append(p)
    section.append(stem_tag)

    # Key / Rubric
    key_src = el.find(attrs={"data-teaching-key": True}) or el.find(class_=re.compile(r"teaching-key"))
    key_tag = soup.new_tag("div")
    key_tag["data-key"] = ""
    if key_src:
        for child in list(key_src.contents):
            key_tag.append(child.extract() if hasattr(child, "extract") else child)
    else:
        p = soup.new_tag("p")
        p.string = "对照要点未指定。"
        key_tag.append(p)
    section.append(key_tag)

    el.replace_with(section)
    return True


def migrate_dialogue_element(soup, el):
    """
    Migrates [data-role~="dialogue-practice"] to data-kind="dialogue".
    """
    qid = el.get("data-question-id", "dialogue-q")
    section = soup.new_tag("section")
    section["class"] = "question"
    section["data-question-id"] = qid
    section["data-kind"] = "dialogue"

    # Stem
    stem_tag = soup.new_tag("div")
    stem_tag["data-stem"] = ""
    stem_src = el.find(class_=re.compile(r"dialogue-stem|q-stem")) or el.find("p")
    if stem_src:
        stem_tag.append(stem_src.extract())
    else:
        p = soup.new_tag("p")
        p.string = "请完成多轮追问练习："
        stem_tag.append(p)
    section.append(stem_tag)

    # Turns
    turns_tag = soup.new_tag("div")
    turns_tag["data-turns"] = ""
    raw_turns = el.find_all(attrs={"data-dialogue-turn": True}) or el.find_all(class_=re.compile(r"dialogue-turn"))
    for idx, t in enumerate(raw_turns):
        t_div = soup.new_tag("div")
        prompt = t.get("data-prompt") or t.get_text().strip()
        t_div["data-prompt"] = prompt or f"第 {idx + 1} 轮追问"
        if t.get("data-guidance"):
            t_div["data-guidance"] = t["data-guidance"]
        turns_tag.append(t_div)

    if not raw_turns:
        # Default 2 turns
        t1 = soup.new_tag("div")
        t1["data-prompt"] = "第一轮：请概述核心概念"
        turns_tag.append(t1)
        t2 = soup.new_tag("div")
        t2["data-prompt"] = "第二轮：说明其边界条件或反例"
        turns_tag.append(t2)

    section.append(turns_tag)
    el.replace_with(section)
    return True


def clean_legacy_independence(soup):
    """
    Removes legacy select[data-independence] and wrappers.
    """
    count = 0
    for sel in soup.find_all("select", attrs={"data-independence": True}):
        parent = sel.find_parent(attrs={"data-role": re.compile(r"independence")}) or sel.parent
        if parent and parent != soup.body:
            parent.decompose()
        else:
            sel.decompose()
        count += 1
    return count


def migrate_html_content(html_text):
    """
    Parses and transforms HTML content.
    Returns (migrated_html, report_dict).
    """
    if BeautifulSoup is None:
        raise RuntimeError("beautifulsoup4 is required. Please install bs4 or run via uv/pip.")

    soup = BeautifulSoup(html_text, "html.parser")
    report = {
        "choice": 0,
        "numeric": 0,
        "open": 0,
        "dialogue": 0,
        "independence_removed": 0,
    }

    # 1. Migrate .quiz
    for q in list(soup.find_all(class_=re.compile(r"\bquiz\b"))):
        # Skip if already a modern question
        if q.has_attr("data-kind") or "question" in q.get("class", []):
            continue
        if migrate_quiz_element(soup, q):
            report["choice"] += 1

    # 2. Migrate answer kinds
    for a in list(soup.find_all(attrs={"data-answer-kind": True})):
        if a.has_attr("data-kind"):
            continue
        kind = a.get("data-answer-kind", "numeric")
        if migrate_answer_element(soup, a):
            if kind == "numeric":
                report["numeric"] += 1
            else:
                report["choice"] += 1

    # 3. Migrate teaching-target
    for t in list(soup.find_all(attrs={"data-role": re.compile(r"teaching-target")})):
        if t.has_attr("data-kind"):
            continue
        if migrate_teaching_target_element(soup, t):
            report["open"] += 1

    # 4. Migrate dialogue-practice
    for d in list(soup.find_all(attrs={"data-role": re.compile(r"dialogue-practice")})):
        if d.has_attr("data-kind"):
            continue
        if migrate_dialogue_element(soup, d):
            report["dialogue"] += 1

    # 5. Clean legacy independence
    report["independence_removed"] = clean_legacy_independence(soup)

    total_changes = sum(report.values())
    if total_changes > 0:
        return str(soup), report
    return html_text, report


def process_file(file_path, apply=False, backup_dir=None):
    """
    Process a single HTML file.
    """
    path = Path(file_path)
    if not path.is_file() or path.suffix != ".html":
        return None

    orig_content = path.read_text(encoding="utf-8")
    new_content, report = migrate_html_content(orig_content)

    total = sum(report.values())
    if total == 0:
        return {"file": str(path), "modified": False, "report": report}

    if apply:
        if backup_dir:
            backup_file = backup_dir / path.name
            backup_file.write_text(orig_content, encoding="utf-8")
        path.write_text(new_content, encoding="utf-8")

    return {"file": str(path), "modified": True, "report": report}


def main():
    parser = argparse.ArgumentParser(description="Course Kit v2 Question Migration Tool")
    parser.add_argument("target", help="Course directory or HTML file to migrate")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview migration without modifying (default)")
    parser.add_argument("--apply", action="store_true", help="Apply migration modifications to files")
    parser.add_argument("--backup-dir", help="Directory for backup files (defaults to target/.backup)")

    args = parser.parse_args()
    apply = args.apply
    target_path = Path(args.target).resolve()

    if not target_path.exists():
        print(f"Error: Target '{target_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    html_files = []
    if target_path.is_file():
        if target_path.suffix == ".html":
            html_files.append(target_path)
    else:
        html_files = sorted(target_path.glob("**/*.html"))

    if not html_files:
        print(f"No HTML files found in '{target_path}'.")
        return

    backup_path = None
    if apply:
        backup_path = Path(args.backup_dir) if args.backup_dir else (target_path if target_path.is_dir() else target_path.parent) / ".backup"
        backup_path.mkdir(parents=True, exist_ok=True)
        print(f"Applying migration with backups stored in: {backup_path}")
    else:
        print(f"DRY-RUN mode: scanning {len(html_files)} HTML file(s)...")

    results = []
    total_migrated = {"choice": 0, "numeric": 0, "open": 0, "dialogue": 0, "independence_removed": 0}

    for f in html_files:
        res = process_file(f, apply=apply, backup_dir=backup_path)
        if res and res["modified"]:
            results.append(res)
            for k, v in res["report"].items():
                total_migrated[k] += v

    print("\n" + "=" * 60)
    print("Migration Summary:")
    print("=" * 60)
    print(f"Total HTML files scanned: {len(html_files)}")
    print(f"Files with legacy questions: {len(results)}")
    for k, v in total_migrated.items():
        print(f"  - {k}: {v}")
    print("=" * 60)

    if results:
        print("\nDetails by file:")
        for r in results:
            rep = r["report"]
            details = ", ".join(f"{k}={v}" for k, v in rep.items() if v > 0)
            status = "APPLIED" if apply else "CAN MIGRATE"
            print(f"  [{status}] {Path(r['file']).name} -> {details}")
    else:
        print("\nAll files are already using modern question syntax!")


if __name__ == "__main__":
    main()
