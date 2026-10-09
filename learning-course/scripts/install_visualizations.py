#!/usr/bin/env python3
"""Copy selected, pinned offline visualization components into a course package."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

KIT = Path(__file__).resolve().parents[1] / "assets" / "visualizations"


def install(course_dir: Path, components: list[str], force: bool = False) -> Path:
    unknown = set(components) - {"plot", "geometry", "algorithm"}
    if unknown:
        raise ValueError(f"Unknown components: {sorted(unknown)}")
    if not (course_dir / "course.yaml").is_file():
        raise ValueError("Initialize the course package first; course.yaml is missing")
    target = course_dir / "assets" / "visualizations"
    files = ["visualizations.js", "visualizations.css"]
    manifest = json.loads((KIT / "vendor" / "manifest.json").read_text(encoding="utf-8"))
    selected = {}
    for name in components:
        if name in manifest:
            selected[name] = manifest[name]
            files.extend("vendor/" + file for file in manifest[name]["files"])
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
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--components", nargs="+", choices=("plot", "geometry", "algorithm"), required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    print(install(args.course_dir.expanduser().resolve(), args.components, args.force))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
