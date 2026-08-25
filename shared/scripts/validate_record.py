#!/usr/bin/env python3
"""Generic record-contract validator.

Reads shared/schemas/record.schema.yaml and validates a record's YAML frontmatter
against the unified contract shared by learning-course, exam-prep and
spaced-review. Field definitions live only in the schema file; this script
contains no field knowledge of its own.

Usage:
    python shared/scripts/validate_record.py <record.md> [--type TYPE]

TYPE is one of auto | course_lesson | exam_attempt | review (default: auto).

Exit codes: 0 = valid, 1 = invalid, 2 = usage/IO error.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "shared" / "schemas" / "record.schema.yaml"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def split_frontmatter(text: str):
    if not text.startswith("---"):
        return None
    lines = text.splitlines()
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[1:i])
    return None


def load_frontmatter(path: Path):
    raw = path.read_text(encoding="utf-8")
    block = split_frontmatter(raw)
    if block is None:
        return None
    data = yaml.safe_load(block)
    return data if isinstance(data, dict) else None


def type_ok(value, tname: str) -> bool:
    if tname == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if tname == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if tname == "str":
        return isinstance(value, str)
    if tname == "bool":
        return isinstance(value, bool)
    if tname == "date":
        return isinstance(value, (dt.date, dt.datetime)) or (
            isinstance(value, str) and bool(DATE_RE.match(value))
        )
    if tname == "datetime":
        return isinstance(value, (dt.date, dt.datetime)) or isinstance(value, str)
    if tname == "list":
        return isinstance(value, list)
    return False


class Checker:
    def __init__(self, schema: dict):
        self.schema = schema
        self.vocab = schema.get("vocabularies", {})
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def check_spec(self, name: str, spec: dict, value) -> None:
        tname = spec.get("type")
        if tname and not type_ok(value, tname):
            self.errors.append(f"{name}: 期望类型 {tname}，实际为 {value!r}")
            return
        if "const" in spec and value != spec["const"]:
            self.errors.append(f"{name}: 必须为 {spec['const']!r}，实际为 {value!r}")
        vocab_name = spec.get("vocabulary")
        if vocab_name:
            allowed = self.vocab.get(vocab_name, [])
            if value not in allowed:
                self.errors.append(f"{name}: {value!r} 不在 {vocab_name} 枚举内 {allowed}")
        pattern = spec.get("pattern")
        if pattern and isinstance(value, str) and not re.fullmatch(pattern, value):
            self.errors.append(f"{name}: {value!r} 不匹配模式 {pattern}")
        minimum = spec.get("min")
        if minimum is not None and isinstance(value, (int, float)) and not isinstance(value, bool):
            if value < minimum:
                self.errors.append(f"{name}: {value} 低于最小值 {minimum}")
        item_vocab = spec.get("item_vocabulary")
        if item_vocab and isinstance(value, list):
            allowed = self.vocab.get(item_vocab, [])
            for item in value:
                if item not in allowed:
                    self.errors.append(f"{name}: 条目 {item!r} 不在 {item_vocab} 枚举内 {allowed}")

    def check_objective_list(self, name: str, spec: dict, value) -> None:
        mastery_allowed = self.vocab.get(spec.get("item_mastery_vocabulary", "mastery"), [])
        id_field = spec.get("item_id_field", "id")
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                self.errors.append(f"{name}[{i}]: 应为映射，实际为 {item!r}")
                continue
            obj_id = item.get(id_field)
            if not isinstance(obj_id, str) or not obj_id.strip():
                self.errors.append(f"{name}[{i}]: 缺少非空 {id_field}")
            mastery = item.get("mastery")
            if mastery not in mastery_allowed:
                self.errors.append(
                    f"{name}[{i}]: mastery {mastery!r} 不在枚举内 {mastery_allowed}"
                )

    def check_group(self, group: dict, fm: dict, finalized: bool) -> None:
        for name, spec in (group.get("required") or {}).items():
            if name not in fm or fm[name] is None:
                self.errors.append(f"缺少必需字段 {name}")
            else:
                self._check(name, spec, fm[name])
        for name, spec in (group.get("on_finalize_required") or {}).items():
            if not finalized:
                continue
            if name not in fm or fm[name] is None:
                self.errors.append(f"finalized 记录缺少字段 {name}")
            else:
                self._check(name, spec, fm[name])
        for name, spec in (group.get("on_finalize_recommended") or {}).items():
            if not finalized:
                continue
            if name not in fm or fm[name] is None:
                self.warnings.append(f"finalized 记录缺少推荐字段 {name}（旧记录兼容）")
            else:
                self._check(name, spec, fm[name])
        for name, spec in (group.get("optional") or {}).items():
            if name in fm and fm[name] is not None:
                self._check(name, spec, fm[name])
        one_of = group.get("one_of") or {}
        if one_of:
            present = [n for n in one_of if fm.get(n) not in (None, "")]
            if len(present) != 1:
                self.errors.append(
                    f"字段 {list(one_of)} 必须恰好提供一个，实际提供 {present or '无'}"
                )
            else:
                self._check(present[0], one_of[present[0]], fm[present[0]])

    def _check(self, name: str, spec: dict, value) -> None:
        if spec.get("type") == "objective_list":
            if not isinstance(value, list):
                self.errors.append(f"{name}: 期望列表，实际为 {value!r}")
            elif value:
                self.check_objective_list(name, spec, value)
        else:
            self.check_spec(name, spec, value)

    def detect_type(self, fm: dict, requested: str) -> tuple["str | None", "str | None"]:
        types = self.schema.get("types", {})
        if requested != "auto":
            if requested not in types:
                return None, f"未知类型 {requested}"
            return requested, None
        for tname, tspec in types.items():
            field = tspec.get("detect_field")
            if field and fm.get(field) is not None:
                return tname, None
        return None, "无法识别记录类型（缺少 lesson/mode/review_kind 检测特征），请用 --type 指定"

    def run(self, fm: dict, requested_type: str) -> str:
        tname, err = self.detect_type(fm, requested_type)
        if err or tname is None:
            self.errors.append(err or "无法识别记录类型")
            return "?"
        tspec = self.schema["types"][tname]
        finalized = fm.get("assessment_status") == "finalized"
        self.check_group(self.schema.get("common", {}), fm, finalized)
        type_group = {
            "required": tspec.get("required"),
            "optional": tspec.get("optional"),
            "one_of": tspec.get("one_of"),
        }
        self.check_group(type_group, fm, finalized)
        return tname


def contract_errors(metadata: dict) -> list[str]:
    """Validate a frontmatter mapping against the shared record contract.

    Convenience wrapper for other scripts (handoff create/complete/validate)
    that need full schema/type/required-field checks on a record, not just an
    `assessment_status` lookup. Returns a list of error strings; empty means
    the record satisfies the contract.
    """
    try:
        schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"record schema cannot be loaded: {exc}"]
    checker = Checker(schema)
    checker.run(metadata, "auto")
    return list(checker.errors)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a study-skills record file.")
    parser.add_argument("record", help="path to the record .md file")
    parser.add_argument("--type", default="auto",
                        choices=["auto", "course_lesson", "exam_attempt", "review"])
    args = parser.parse_args()

    try:
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    path = Path(args.record)
    if not path.is_file():
        print(f"ERROR: 文件不存在: {path}", file=sys.stderr)
        return 2
    try:
        schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8"))
        fm = load_frontmatter(path)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: 解析失败: {exc}", file=sys.stderr)
        return 2
    if fm is None:
        print(f"FAIL {path}: 缺少 YAML frontmatter")
        return 1

    checker = Checker(schema)
    tname = checker.run(fm, args.type)
    for warning in checker.warnings:
        print(f"WARN: {warning}")
    for error in checker.errors:
        print(f"ERROR: {error}")
    if checker.errors:
        print(f"FAIL {path} ({tname})")
        return 1
    print(f"OK {path} ({tname})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
