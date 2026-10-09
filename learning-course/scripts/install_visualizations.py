#!/usr/bin/env python3
"""Copy selected, pinned offline visualization components into a course package."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

KIT = Path(__file__).resolve().parents[1] / "assets" / "visualizations"
STANDARD_KINDS = ("chart", "spatial", "sequence", "relation", "timeline", "process", "table")
# Kinds whose adapter renders with HTML/SVG only, so no vendor library is copied.
# They are listed here so the caller is told they were intentionally skipped,
# instead of being silently dropped when no manifest entry exists.
VENDOR_FREE = ("sequence", "relation", "timeline", "process", "table")


def install(course_dir: Path, components: list[str], force: bool = False) -> tuple[Path, list[str]]:
    unknown = set(components) - set(STANDARD_KINDS)
    if unknown:
        raise ValueError(f"Unknown components: {sorted(unknown)}")
    if not (course_dir / "course.yaml").is_file():
        raise ValueError("Initialize the course package first; course.yaml is missing")
    target = course_dir / "assets" / "visualizations"
    files = ["visualizations.js", "visualizations.css", "adapters.json"]
    manifest = json.loads((KIT / "vendor" / "manifest.json").read_text(encoding="utf-8"))
    selected = {}
    skipped: list[str] = []
    for name in components:
        if name in manifest:
            selected[name] = manifest[name]
            files.extend("vendor/" + file for file in manifest[name]["files"])
        elif name in VENDOR_FREE:
            skipped.append(f"{name}（适配器已随 visualizations.js 复制，无需 vendor 库）")
        else:
            raise ValueError(f"No vendor entry and no vendor-free adapter declared for: {name}")
    # Check every destination before making changes; never partially overwrite a kit.
    destinations = [target / file for file in files] + [target / "vendor" / "manifest.json"]
    if not force:
        for path in destinations:
            if path.exists():
                raise FileExistsError(f"Refusing to overwrite: {path}; use --force to replace the kit")
    for file in files:
        for dependency in selected.values():
            relative = file.removeprefix("vendor/")
            if relative in dependency["sha256"] and hashlib.sha256((KIT / file).read_bytes()).hexdigest() != dependency["sha256"][relative]:
                raise ValueError(f"Bundled dependency checksum mismatch: {file}")
    for file in files:
        destination = target / file
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(KIT / file, destination)
    (target / "vendor").mkdir(exist_ok=True)
    (target / "vendor" / "manifest.json").write_text(json.dumps(selected, indent=2) + "\n", encoding="utf-8")
    return target, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--components", nargs="+", choices=STANDARD_KINDS, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    target, skipped = install(args.course_dir.expanduser().resolve(), args.components, args.force)
    print(target)
    if skipped:
        print("以下组件不需要 vendor 库，已跳过第三方文件复制：")
        for entry in skipped:
            print(f"  - {entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
