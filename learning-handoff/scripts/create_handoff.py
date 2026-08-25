#!/usr/bin/env python3
"""Create a bounded cross-package handoff from a finalized source record.

Usage (see learning-handoff/SKILL.md step 2):
    python scripts/create_handoff.py <source-pkg> \
      --record records/R0012.md --target-pkg <补课包目录> \
      --goal "..." [--include ...] [--exclude ...] \
      --return-condition "..." [--return-condition ...] [--to-skill learning-course]

Artifact coupling only: the handoff file is written into the SOURCE package's
handoffs/ directory; the target package is never touched. All refusals happen
before any write.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SHARED_SCRIPTS = REPO_ROOT / "shared" / "scripts"
if str(SHARED_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SHARED_SCRIPTS))

HANDOFF_ID_RE = re.compile(r"^H(\d{4})$")
SLUG_CLEAN_RE = re.compile(r"[^a-z0-9]+")


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


def slugify(value: str) -> str:
    slug = SLUG_CLEAN_RE.sub("-", value.lower()).strip("-")
    return slug[:48] or "handoff"


def load_yaml_module():
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError("create_handoff.py requires PyYAML") from exc
    return yaml


def record_contract_errors(metadata: dict) -> list[str]:
    """Validate a record against the shared record contract (schema/type/
    required fields/finalized constraints), not just assessment_status."""
    try:
        import validate_record as vr  # type: ignore
    except ImportError:
        return ["shared validate_record.py is not importable"]
    return vr.contract_errors(metadata)


def atomic_write_text(path: Path, text: str) -> None:
    """Write the handoff atomically so a failed write never leaves a
    half-written H#### file that later validation would choke on."""
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def detect_source_skill(root: Path) -> str | None:
    if (root / "exam.yaml").is_file():
        return "exam-prep"
    if (root / "course.yaml").is_file():
        return "learning-course"
    return None


def next_handoff_id(handoffs_dir: Path) -> int:
    highest = 0
    if handoffs_dir.is_dir():
        for entry in sorted(handoffs_dir.glob("*.md")):
            match = HANDOFF_ID_RE.match(entry.name.split("-", 1)[0])
            if match:
                highest = max(highest, int(match.group(1)))
    return highest + 1


def build_body(handoff_id: str, goal: str, to_skill: str) -> str:
    return f"""# 交接 {handoff_id}

本文件是两个独立学习包之间的唯一耦合点：目标包不读取源包状态，源包不直接修改目标包。

- 目标：{goal}
- `{to_skill}` 必须把本文件的 goal 与 boundary.include/exclude 当作课程边界，补课不得越界扩张。
- 完成条件见 frontmatter 的 return_condition；至少一条满足并以目标包内 finalized record 作为证据。
- 返回时使用 complete_handoff.py 将 status 置为 returned 并引用该记录；源包在用户确认后依据 returned_record 更新自己的计划。
"""


def main() -> int:
    reconfigure_streams()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_pkg")
    parser.add_argument("--record", required=True)
    parser.add_argument("--target-pkg", required=True)
    parser.add_argument("--goal", required=True)
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--exclude", action="append", default=[])
    parser.add_argument("--return-condition", action="append", default=[])
    parser.add_argument("--to-skill", default="learning-course")
    args = parser.parse_args()

    if not args.goal.strip():
        return fail("--goal must be a non-empty string")
    if not args.return_condition:
        return fail("at least one --return-condition is required")

    root = Path(args.source_pkg).expanduser().resolve()
    if not root.is_dir():
        return fail(f"source package directory does not exist: {root}")
    source_skill = detect_source_skill(root)
    if source_skill is None:
        return fail(f"no exam.yaml or course.yaml in source package: {root}")

    record_path = (root / args.record).resolve() if not Path(args.record).is_absolute() else Path(args.record).resolve()
    try:
        record_path.relative_to(root)
    except ValueError:
        return fail(f"--record must stay inside the source package: {args.record}")
    if not record_path.is_file():
        return fail(f"--record does not exist: {args.record}")

    try:
        yaml = load_yaml_module()
    except RuntimeError as exc:
        return fail(str(exc))
    text = record_path.read_text(encoding="utf-8", errors="replace")
    parts = text.split("---", 2)
    metadata = None
    if len(parts) == 3:
        try:
            loaded = yaml.safe_load(parts[1])
            metadata = loaded if isinstance(loaded, dict) else None
        except Exception:
            metadata = None
    if metadata is None or metadata.get("assessment_status") != "finalized":
        return fail(f"--record must be a finalized record: {args.record}")
    contract_errors = record_contract_errors(metadata)
    if contract_errors:
        return fail(
            f"--record fails the shared record contract: {args.record}: {'; '.join(contract_errors)}"
        )

    target_pkg = Path(args.target_pkg).expanduser().resolve()
    handoffs_dir = root / "handoffs"
    sequence = next_handoff_id(handoffs_dir)
    if sequence > 9999:
        return fail("handoff id space exhausted (H9999 already allocated)")
    handoff_id = f"H{sequence:04d}"
    handoff_path = handoffs_dir / f"{handoff_id}-{slugify(args.goal)}.md"
    if handoff_path.exists():
        return fail(f"handoff file already exists: {handoff_path}")

    # Store to.package relative to the SOURCE package when both live on the
    # same drive, so moving/syncing the whole workspace keeps the handoff
    # usable. Cross-drive paths have no relative form and stay absolute.
    try:
        package_ref = os.path.relpath(target_pkg, root)
    except ValueError:
        package_ref = str(target_pkg)

    frontmatter = {
        "handoff_schema": 1,
        "handoff_id": handoff_id,
        "status": "open",
        "created_at": dt.date.today().isoformat(),
        "return_condition": list(args.return_condition),
        "from": {
            "skill": source_skill,
            "package": root.name,
            "record": record_path.relative_to(root).as_posix(),
        },
        "to": {
            "skill": args.to_skill,
            "package": package_ref,
            "goal": args.goal.strip(),
            "boundary": {
                "include": list(args.include),
                "exclude": list(args.exclude),
            },
        },
    }
    dumped = yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)
    content = f"---\n{dumped}---\n\n{build_body(handoff_id, args.goal.strip(), args.to_skill)}"

    # Refusal paths are all above this point.
    try:
        handoffs_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_text(handoff_path, content)
    except OSError as exc:
        return fail(f"handoff could not be written: {exc}")

    print(f"OK {handoff_id} created: {handoff_path.relative_to(root).as_posix()}")
    print(f"NEXT: activate ${args.to_skill} with target dir {target_pkg} and use the handoff goal+boundary as the course contract.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
