#!/usr/bin/env python3
"""Build a read-only progress report for a study package.

Usage (from the study skill directory; see study/references/progress-report.md):
    python scripts/build_report.py <package-dir> [--out REPORT.md]

Strictly read-only: derives everything from course.yaml/exam.yaml, records/
frontmatter, lessons/, question bank JSONL and error-log.md. Without --out
the report goes to stdout; with --out the file is written under the
package's exports/ directory only (`--out REPORT.md` -> exports/REPORT.md),
so state files and records can never be overwritten.

Every conclusion cites its evidence (record path / objective id / metric
name). Findings are labeled confirmed / inferred / unknown / self-reported;
activity is always shown next to evidence, never treated as mastery.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

SHARED_SCRIPTS = Path(__file__).resolve().parents[2] / "shared" / "scripts"
if str(SHARED_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SHARED_SCRIPTS))

from validate_record import independence_error, recent_guided_records  # noqa: E402

SECTIONS = ("当前目标", "证据覆盖率", "已确认能力", "仍不确定能力", "最近错误模式", "到期复习", "风险", "下一步建议")
READINESS_METRICS = ("accuracy", "speed", "coverage", "stability")
DATE_LINE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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
    return 2


def load_yaml_module():
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError("build_report.py requires PyYAML") from exc
    return yaml


def load_state(path: Path, yaml: Any) -> dict:
    try:
        state = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"{path.name} cannot be parsed: {exc}") from exc
    if not isinstance(state, dict):
        raise RuntimeError(f"{path.name} root must be a mapping")
    return state


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.S)


def load_frontmatter(path: Path, yaml: Any) -> dict | None:
    try:
        match = FRONTMATTER_RE.match(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None
    if match is None:
        return None
    try:
        data = yaml.safe_load(match.group(1))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def parse_moment(value: Any) -> dt.datetime | None:
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


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def scan_records(root: Path, yaml: Any) -> list[dict]:
    """All finalized records with their relative paths, sorted by filename."""
    records: list[dict] = []
    records_dir = root / "records"
    if not records_dir.is_dir():
        return records
    for path in sorted(records_dir.glob("*.md")):
        metadata = load_frontmatter(path, yaml)
        if metadata is None or metadata.get("assessment_status") != "finalized":
            continue
        records.append({"path": rel(path, root), "fm": metadata})
    return records


def objective_support(records: list[dict]) -> dict[str, list[dict]]:
    support: dict[str, list[dict]] = {}
    for record in records:
        for entry in record["fm"].get("supported_objectives") or []:
            if isinstance(entry, dict) and isinstance(entry.get("id"), str):
                support.setdefault(entry["id"], []).append(record)
    return support


def classify_objective(objective_id: str, state_mastery: Any, support: dict[str, list[dict]]) -> tuple[str, list[dict]]:
    """Return (label, supporting records) using record evidence, not activity."""
    backs = support.get(objective_id, [])
    strong = [r for r in backs if r["fm"].get("evidence_strength") == "strong"
              and r["fm"].get("independence") == "independent"
              and any(isinstance(e, dict) and e.get("id") == objective_id
                      and e.get("mastery") in ("recognition", "application", "transfer")
                      and independence_error(r["fm"], e.get("mastery")) is None
                      for e in r["fm"].get("supported_objectives", []))]
    if strong:
        return "confirmed", strong
    if backs:
        return "inferred", backs
    if state_mastery == "uncertain":
        return "self-reported", []
    return "unknown", []


def collect_due_reviews(queue: Any, key_field: str) -> tuple[list[dict], list[dict]]:
    now = dt.datetime.now()
    due: list[dict] = []
    upcoming: list[dict] = []
    for entry in queue or []:
        if not isinstance(entry, dict):
            continue
        target = entry.get(key_field)
        moment = parse_moment(entry.get("due_at"))
        if not isinstance(target, str) or moment is None:
            continue
        item = {"target": target, "due_at": entry.get("due_at")}
        (due if moment <= now else upcoming).append(item)
    due.sort(key=lambda item: str(item["due_at"]))
    upcoming.sort(key=lambda item: str(item["due_at"]))
    return due, upcoming


def parse_error_log(path: Path) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = {}
    if not path.is_file():
        return buckets
    current: str | None = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("## "):
            current = line[3:].strip()
            buckets.setdefault(current, [])
            continue
        stripped = line.strip()
        if current is not None and stripped:
            buckets[current].append(stripped.lstrip("- ").strip())
    return buckets


def question_bank_ratio(root: Path) -> tuple[int, int, int]:
    total = synthetic = 0
    bank_dir = root / "question-bank"
    if not bank_dir.is_dir():
        return 0, 0, 0
    for path in sorted(bank_dir.glob("*.jsonl")):
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            total += 1
            if item.get("synthetic") is True:
                synthetic += 1
    return total, synthetic, total - synthetic


def render(title_line: str, sections: dict[str, list[str]]) -> str:
    lines = [f"generated: {dt.date.today().isoformat()}", "", title_line, ""]
    for name in SECTIONS:
        lines.append(f"## {name}")
        lines.extend(sections.get(name, ["（无）"]))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_course_report(root: Path, yaml: Any) -> str:
    state = load_state(root / "course.yaml", yaml)
    title = str(state.get("title") or root.name)
    objectives = [o for o in state.get("objectives", []) if isinstance(o, dict) and o.get("id")]
    records = scan_records(root, yaml)
    support = objective_support(records)

    classifications = {
        str(o["id"]): classify_objective(str(o["id"]), o.get("mastery"), support)
        for o in objectives
    }
    confirmed = [o for o in objectives if classifications[str(o["id"])][0] == "confirmed"]
    backed = [o for o in objectives if support.get(str(o["id"]))]
    total = len(objectives)

    sections: dict[str, list[str]] = {}

    goal_lines = [f"- 课程：{title}（course.yaml）"]
    for o in objectives:
        goal_lines.append(
            f"- {o['id']} — mastery {o.get('mastery')!r}（course.yaml objectives）"
        )
    sections["当前目标"] = goal_lines

    coverage_lines = [
        f"- 证据覆盖：{len(backed)}/{total} 个目标有至少一条 finalized 记录支撑。",
        f"- 独立强证据覆盖：{len(confirmed)}/{total} 个目标有 strong + independent 记录支撑。",
        f"- 活动量 ≠ 掌握：lessons/ 共 {len(list((root / 'lessons').glob('*.html')))} 个课件；证据量见上（records/*.md）。",
    ]
    sections["证据覆盖率"] = coverage_lines

    confirmed_lines = [
        f"- [confirmed] {o['id']} — independent + {classifications[str(o['id'])][1][0]['fm'].get('evidence_strength')} 证据 "
        f"{', '.join(r['path'] for r in classifications[str(o['id'])][1])}"
        for o in confirmed
    ] or ["（无）——没有任何目标拥有 strong + independent 定稿记录。"]
    sections["已确认能力"] = confirmed_lines

    uncertain_lines: list[str] = []
    for label, explanation in (
        ("inferred", "证据强度不足、依赖辅助或独立性未知"),
        ("unknown", "无定稿记录支撑"),
        ("self-reported", "自述或 uncertain 状态"),
    ):
        group = [
            f"- [{label}] {o['id']} — {explanation}"
            + (f"（{', '.join(r['path'] for r in classifications[str(o['id'])][1])}）" if classifications[str(o['id'])][1] else "")
            for o in objectives
            if classifications[str(o['id'])][0] == label
        ]
        uncertain_lines.append(f"**{label}**")
        uncertain_lines.extend(group or ["（无）"])
    sections["仍不确定能力"] = uncertain_lines

    error_lines: list[str] = []
    poor_reviews = [
        r for r in records
        if r["fm"].get("record_type") == "review" and r["fm"].get("performance") == "poor"
    ]
    for record in poor_reviews:
        error_lines.append(
            f"- 复习表现 poor：{record['path']}（performance=poor，{record['fm'].get('review_kind')}）"
        )
    diagnostic = state.get("diagnostic") or {}
    if isinstance(diagnostic, dict) and diagnostic.get("status") == "pending":
        error_lines.append(f"- 诊断尚未完成：diagnostic.status=pending（course.yaml，record={diagnostic.get('record')}）")
    if not error_lines:
        error_lines.append(
            f"- 未发现错误模式：没有 performance=poor 的复习记录；diagnostic.status={diagnostic.get('status')!r}（course.yaml）。"
        )
    sections["最近错误模式"] = error_lines

    due, upcoming = collect_due_reviews(state.get("review_queue"), "objective_id")
    review_lines = [f"- 到期：{item['target']}（due_at {item['due_at']}，review_queue）" for item in due]
    review_lines += [f"- 即将到期：{item['target']}（due_at {item['due_at']}）" for item in upcoming]
    if not review_lines:
        review_lines.append("- 无到期或即将到期的复习项（review_queue 为空）。")
    sections["到期复习"] = review_lines

    risk_lines: list[str] = []
    for record in records:
        independence = record["fm"].get("independence")
        if independence != "independent":
            risk_lines.append(f"- [inferred] {record['path']}：independence={independence or 'unknown'}；不能据此确认独立能力。")
    streak = recent_guided_records(records)
    if streak:
        risk_lines.append("- 近期缺乏独立验证证据：最近 3 条定稿记录均为 ai_guided（"
                          + ", ".join(r["path"] for r in streak) + "）。这不是能力下降的因果判断。")
    for o in objectives:
        label = classifications[str(o["id"])][0]
        if label in {"inferred", "self-reported"}:
            backs = classifications[str(o["id"])][1]
            cite = f"（{', '.join(r['path'] for r in backs)}）" if backs else ""
            risk_lines.append(f"- {o['id']} 的掌握判断依赖{label}证据{cite}。")
    if due:
        risk_lines.append(f"- {len(due)} 项复习已到期（{', '.join(item['target'] for item in due)}）。")
    if not risk_lines:
        risk_lines.append("- 未发现明显风险：无仅依赖弱证据的目标，也无逾期复习。")
    sections["风险"] = risk_lines

    suggestion_lines = [
        f"- 立即处理到期复习：{item['target']}（due_at {item['due_at']}）。" for item in due
    ]
    unconfirmed = [o for o in objectives if classifications[str(o["id"])][0] != "confirmed"]
    if unconfirmed:
        weakest = unconfirmed[0]
        backs = support.get(str(weakest["id"]), [])
        if backs:
            suggestion_lines.append(
                f"- 为 {weakest['id']} 安排无辅助变式练习补强独立证据（现有 {', '.join(r['path'] for r in backs)}）。"
            )
        else:
            suggestion_lines.append(
                f"- 为 {weakest['id']} 获取第一条证据：完成一次可评估练习并定稿记录（当前无任何定稿记录）。"
            )
    if not suggestion_lines:
        strongest = confirmed[0]["id"] if confirmed else "（无目标）"
        suggestion_lines.append(
            f"- 所有目标均有 strong + independent 定稿证据；建议推进下一课，并为 {strongest} 安排一次迁移任务保持掌握（依据：records/*.md）。"
        )
    sections["下一步建议"] = suggestion_lines

    return render(f"# 学习进展报告 — {title}（course）", sections)


def classify_readiness_metric(metric: str, value: Any, evidence: list[dict], records_by_path: dict[str, dict]) -> tuple[str, list[str]]:
    """Return (label, citing record paths) for one readiness metric."""
    backs = [e for e in evidence if isinstance(e, dict) and metric in (e.get("metrics") or [])]
    confirmed_paths: list[str] = []
    inferred_paths: list[str] = []
    for entry in backs:
        path = entry.get("record")
        if not isinstance(path, str):
            continue
        record = records_by_path.get(path)
        if record is None:
            continue
        if record["fm"].get("source_backed") is True and record["fm"].get("independence") == "independent":
            confirmed_paths.append(path)
        else:
            inferred_paths.append(path)
    if confirmed_paths:
        return "confirmed", sorted(set(confirmed_paths))
    if inferred_paths:
        return "inferred", sorted(set(inferred_paths))
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
        return "self-reported", []
    return "unknown", []


def build_exam_report(root: Path, yaml: Any) -> str:
    state = load_state(root / "exam.yaml", yaml)
    title = str(state.get("title") or root.name)
    readiness = state.get("readiness") or {}
    evidence = state.get("readiness_evidence") or []
    records = scan_records(root, yaml)
    records_by_path = {record["path"]: record for record in records}

    sections: dict[str, list[str]] = {}

    goal_lines = [f"- 备考目标：{title}（exam.yaml）"]
    if state.get("exam_date"):
        goal_lines.append(f"- 考试日期：{state.get('exam_date')}；目标分：{state.get('target_score')}（exam.yaml）")
    goal_lines.append(f"- confidence：{readiness.get('confidence')!r}（exam.yaml readiness）")
    sections["当前目标"] = goal_lines

    total_q, synthetic_q, sourced_q = question_bank_ratio(root)
    sections["证据覆盖率"] = [
        f"- 题库构成：{sourced_q}/{total_q} 道来源题，{synthetic_q} 道合成题（question-bank/*.jsonl）。",
        f"- readiness 证据条目：{len(evidence)} 条（exam.yaml readiness_evidence）；活动量（题库/模考文件数）不等于掌握。",
    ]

    metric_lines: list[str] = []
    for metric in READINESS_METRICS:
        label, paths = classify_readiness_metric(metric, readiness.get(metric), evidence, records_by_path)
        cite = (" — " + ", ".join(f"{p}（independence={records_by_path[p]['fm'].get('independence') or 'unknown'}）"
                                 for p in paths)) if paths else " — 无记录支撑"
        metric_lines.append(f"- [{label}] {metric} = {readiness.get(metric)!r}{cite}")
    sections["已确认能力"] = (
        [line for line in metric_lines if line.startswith("- [confirmed]")]
        or ["（无）——没有由来源记录支撑的 readiness 维度。"]
    )

    uncertain_lines: list[str] = []
    for label in ("inferred", "self-reported", "unknown"):
        group = [line for line in metric_lines if line.startswith(f"- [{label}]")]
        uncertain_lines.append(f"**{label}**")
        uncertain_lines.extend(group or ["（无）"])
    sections["仍不确定能力"] = uncertain_lines

    error_lines: list[str] = []
    buckets = parse_error_log(root / "error-log.md")
    for bucket in ("high-yield_errors", "recurring_patterns"):
        entries = buckets.get(bucket, [])
        if entries:
            error_lines.extend(f"- {bucket}：{entry}（error-log.md）" for entry in entries)
        else:
            error_lines.append(f"- {bucket}：暂无记录（error-log.md）。")
    sections["最近错误模式"] = error_lines or ["- error-log.md 不存在，无法提取错误模式。"]

    due, upcoming = collect_due_reviews(state.get("review_queue"), "topic")
    review_lines = [f"- 到期：{item['target']}（due_at {item['due_at']}，review_queue）" for item in due]
    review_lines += [f"- 即将到期：{item['target']}（due_at {item['due_at']}）" for item in upcoming]
    if not review_lines:
        review_lines.append("- 无到期或即将到期的复习项（未配置 review_queue 或队列为空）。")
    sections["到期复习"] = review_lines

    risk_lines: list[str] = []
    for metric in READINESS_METRICS:
        label, paths = classify_readiness_metric(metric, readiness.get(metric), evidence, records_by_path)
        if label in {"inferred", "self-reported"}:
            cite = f"（{', '.join(paths)}）" if paths else ""
            risk_lines.append(f"- {metric} 仅由{label}证据支撑{cite}。")
    streak = recent_guided_records(records)
    if streak:
        risk_lines.append("- 近期缺乏独立验证证据：最近 3 条定稿记录均为 ai_guided（"
                          + ", ".join(r["path"] for r in streak) + "）。安排一次无辅助限时复测。")
    if due:
        risk_lines.append(f"- {len(due)} 项复习已到期（{', '.join(item['target'] for item in due)}）。")
    if not risk_lines:
        risk_lines.append("- 未发现明显风险：readiness 各维度均有来源记录支撑，且无逾期复习。")
    sections["风险"] = risk_lines

    suggestion_lines = [f"- 立即处理到期复习：{item['target']}（due_at {item['due_at']}）。" for item in due]
    scored = [(readiness.get(metric) if isinstance(readiness.get(metric), (int, float)) else 0, metric) for metric in READINESS_METRICS]
    scored.sort()
    weakest_value, weakest_metric = scored[0] if scored else (0, "accuracy")
    suggestion_lines.append(
        f"- 优先补强最弱维度 {weakest_metric}（当前 {weakest_value}）：安排一组针对该维度的限时 drill 并定稿记录。"
    )
    sections["下一步建议"] = suggestion_lines

    return render(f"# 学习进展报告 — {title}（exam）", sections)


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    parser.add_argument("--out")
    args = parser.parse_args()

    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        return fail(f"package directory does not exist: {root}")

    try:
        yaml = load_yaml_module()
        if (root / "course.yaml").is_file():
            report = build_course_report(root, yaml)
        elif (root / "exam.yaml").is_file():
            report = build_exam_report(root, yaml)
        else:
            return fail(f"no course.yaml or exam.yaml in package: {root}")
    except RuntimeError as exc:
        return fail(str(exc))

    if args.out:
        rel = Path(args.out)
        if rel.is_absolute() or ".." in rel.parts:
            return fail("--out must be a relative path inside the package's exports/ directory")
        parts = list(rel.parts)
        if parts and parts[0] == "exports":
            parts = parts[1:]
        if not parts:
            return fail("--out must name a file inside exports/ (e.g. exports/REPORT.md)")
        exports_dir = root / "exports"
        out_path = (exports_dir / Path(*parts)).resolve()
        try:
            out_path.relative_to(exports_dir.resolve())
        except ValueError:
            return fail("--out must stay inside the package's exports/ directory")
        if out_path.is_dir():
            return fail(f"--out points at a directory: {args.out}")
        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(report, encoding="utf-8", newline="\n")
        except OSError as exc:
            return fail(f"report could not be written: {exc}")
        print(f"OK report written: {out_path.relative_to(root).as_posix()}")
    else:
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
