#!/usr/bin/env python3
"""Register a study source into a package's SOURCES.md registry.

Usage (see source-grounded-study/SKILL.md step 2):
    python source-grounded-study/scripts/register_source.py <package-dir> \
      --title "<标题>" --type <textbook|paper|webpage|lecture_notes|past_paper|syllabus|user_notes|other> \
      --reliability <official|course|user|synthetic|unknown> [--raw <原文件路径>] [--coverage "<notes>"]

Registry location follows the package kind: exam packages (exam.yaml) keep
root SOURCES.md + source-materials/; course packages and standalone
workspaces use sources/SOURCES.md + sources/<source_id>/. Both share the
field contract in shared/schemas/source.schema.yaml.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCHEMA_PATH = REPO_ROOT / "shared" / "schemas" / "source.schema.yaml"

TABLE_INTRO = "# Sources\n"
TABLE_HEADER = "| source_id | title | type | registered_at | reliability | coverage |"
TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- |"
SOURCE_ID_RE = re.compile(r"^S(\d{3})$")
# Fallbacks mirroring SKILL.md; shared/schemas/source.schema.yaml stays the source of truth.
FALLBACK_VOCABULARIES = {
    "source_type": ["textbook", "paper", "webpage", "lecture_notes", "past_paper", "syllabus", "user_notes", "other"],
    "reliability": ["official", "course", "user", "synthetic", "unknown"],
}


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
    return 1


def load_vocabularies() -> dict[str, list[str]]:
    try:
        import yaml  # type: ignore
    except ImportError:
        return dict(FALLBACK_VOCABULARIES)
    try:
        schema = yaml.safe_load(SOURCE_SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception:
        return dict(FALLBACK_VOCABULARIES)
    vocabularies = schema.get("vocabularies") if isinstance(schema, dict) else None
    if not isinstance(vocabularies, dict):
        return dict(FALLBACK_VOCABULARIES)
    merged = dict(FALLBACK_VOCABULARIES)
    for key in merged:
        if isinstance(vocabularies.get(key), list) and vocabularies[key]:
            merged[key] = [str(item) for item in vocabularies[key]]
    return merged


def resolve_layout(root: Path) -> tuple[str, Path, Path, Path]:
    """Return (kind, registry_path, raw_dir, detail_base_dir)."""
    if (root / "exam.yaml").is_file():
        return "exam", root / "SOURCES.md", root / "source-materials", root / "source-materials"
    sources_dir = root / "sources"
    return ("course" if (root / "course.yaml").is_file() else "standalone"), (
        sources_dir / "SOURCES.md"
    ), (sources_dir / "raw"), sources_dir


def parse_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if not cells or cells[0] in {"source_id", "---"} or set(cells[0]) <= {"-", ":"}:
            continue
        rows.append(cells)
    return rows


def cell(value: str) -> str:
    return value.replace("|", "\\|").strip() or "-"


def excerpts_skeleton(source_id: str, title: str) -> str:
    return f"""# Excerpts — {source_id} {title}

<!-- 摘录纪律（material-intake.md）：原文事实逐字摘录并标注章节/页码/位置，不改写； -->
<!-- 来源摘要用自己的话压缩并注明“摘要自 {source_id}”；Agent 推断与生成物不写入本文件。 -->

## 位置（章节/页码）

> 在此粘贴逐字摘录。
"""


def claims_skeleton(source_id: str) -> str:
    return f"""# Claims — {source_id}

<!-- 记录“这段资料支持什么”。每条主张一个 bullet，写法见 material-intake.md： -->
<!-- - claim: <这条来源支持什么>
     source: {source_id}
     location: <章节/页码>
     status: sourced        # sourced | unverified | contested -->
"""


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir")
    parser.add_argument("--title", required=True)
    parser.add_argument("--type", required=True, dest="source_type")
    parser.add_argument("--reliability", required=True)
    parser.add_argument("--raw")
    parser.add_argument("--coverage")
    args = parser.parse_args()

    vocabularies = load_vocabularies()
    if args.source_type not in vocabularies["source_type"]:
        return fail(f"invalid --type {args.source_type!r}; use one of {vocabularies['source_type']}")
    if args.reliability not in vocabularies["reliability"]:
        return fail(f"invalid --reliability {args.reliability!r}; use one of {vocabularies['reliability']}")
    if not args.title.strip():
        return fail("--title must be a non-empty string")

    root = Path(args.package_dir).expanduser().resolve()
    if not root.is_dir():
        return fail(f"package directory does not exist: {root}")
    kind, registry_path, raw_dir, detail_base = resolve_layout(root)

    if registry_path.exists():
        try:
            registry_text = registry_path.read_text(encoding="utf-8")
        except OSError as exc:
            return fail(f"registry cannot be read: {registry_path}: {exc}")
    else:
        registry_text = ""

    rows = parse_rows(registry_text)
    highest = 0
    for cells in rows:
        match = SOURCE_ID_RE.match(cells[0]) if cells else None
        if match:
            highest = max(highest, int(match.group(1)))
    if highest >= 999:
        return fail("source id space exhausted (S999 already allocated)")
    source_id = f"S{highest + 1:03d}"

    existing_titles = {cells[1].casefold() for cells in rows if len(cells) > 1}
    if args.title.strip().casefold() in existing_titles:
        print(f"WARNING: a source titled {args.title!r} is already registered; registering anyway", file=sys.stderr)

    raw_source: Path | None = None
    raw_target: Path | None = None
    if args.raw:
        candidate = Path(args.raw).expanduser().resolve()
        if not candidate.is_file():
            return fail(f"--raw file does not exist: {candidate}")
        raw_source = candidate
        raw_target = raw_dir / candidate.name
        if raw_target.exists():
            return fail(f"raw material already exists in package: {raw_target}")

    detail_dir = detail_base / source_id
    if detail_dir.exists():
        return fail(f"detail folder already exists: {detail_dir}")

    registered_at = dt.date.today().isoformat()
    row = "| {0} | {1} | {2} | {3} | {4} | {5} |".format(
        cell(source_id), cell(args.title), cell(args.source_type),
        cell(registered_at), cell(args.reliability), cell(args.coverage or ""),
    )
    if registry_text:
        if not registry_text.endswith("\n"):
            registry_text += "\n"
        new_registry_text = registry_text + row + "\n"
    else:
        new_registry_text = f"{TABLE_INTRO}\n{TABLE_HEADER}\n{TABLE_SEPARATOR}\n{row}\n"

    # All refusal paths are above this point; perform the writes now.
    try:
        detail_dir.mkdir(parents=True, exist_ok=False)
        (detail_dir / "excerpts.md").write_text(excerpts_skeleton(source_id, args.title.strip()), encoding="utf-8", newline="\n")
        (detail_dir / "claims.md").write_text(claims_skeleton(source_id), encoding="utf-8", newline="\n")
        if raw_target is not None and raw_source is not None:
            raw_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(raw_source, raw_target)  # copy, never move/delete the original
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(new_registry_text, encoding="utf-8", newline="\n")
    except OSError as exc:
        return fail(f"registration could not be written: {exc}")

    print(f"OK {source_id} registered in {registry_path.relative_to(root).as_posix()} ({args.title.strip()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
