#!/usr/bin/env python3
"""Install optional learning-course components into a course package.

Optional components are deliberately kept out of the default package so a plain
course stays small and offline. This script copies only what a course asks for:

    python scripts/install_optional.py <course-dir> --components code-highlight theme
    python scripts/install_optional.py <course-dir> --components chart spatial

Visualization kinds share one adapter kit; `chart` and `spatial` additionally
pull their pinned vendor library. Everything else is JS/CSS with no dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
OPTIONAL = SKILL / "assets" / "optional"
VIZ_KIT = SKILL / "assets" / "visualizations"

# Visualization kinds, split by whether they need a pinned third-party library.
VIZ_VENDOR_KINDS = ("chart", "spatial")
VIZ_FREE_KINDS = ("sequence", "relation", "timeline", "process", "table")
VISUALIZATION_KINDS = VIZ_VENDOR_KINDS + VIZ_FREE_KINDS

# Components that are plain files plus an optional vendor tree.
SIMPLE_COMPONENTS = {
    "code-highlight": {"source": OPTIONAL / "code-highlight", "target": "assets/optional/code-highlight", "files": ["code-highlight.js", "code-highlight.css", "README.md"]},
    "theme": {"source": OPTIONAL / "theme", "target": "assets/optional/theme", "files": ["theme.js", "theme.css", "README.md"]},
}


class InstallError(Exception):
    """Raised when a request cannot be satisfied without partial writes."""


def _read_manifest() -> dict[str, object]:
    return json.loads((OPTIONAL / "manifest.json").read_text(encoding="utf-8"))


def _check_targets(paths: list[Path], force: bool) -> None:
    """Refuse before touching anything so a failed run never half-writes."""
    if force:
        return
    for path in paths:
        if path.exists():
            raise InstallError(f"Refusing to overwrite: {path}; use --force to replace it")


def _verify_vendor(manifest: dict, kinds: list[str]) -> dict:
    """Check every vendor file against its recorded checksum before copying."""
    selected = {name: manifest[name] for name in kinds if name in manifest}
    for name, dependency in selected.items():
        for relative, checksum in dependency["sha256"].items():
            source = VIZ_KIT / "vendor" / relative
            if not source.is_file():
                raise InstallError(f"Missing vendored dependency for {name}: {source}")
            actual = hashlib.sha256(source.read_bytes()).hexdigest()
            if actual != checksum:
                raise InstallError(f"Checksum mismatch for {source}")
    return selected


def install_visualizations(course_dir: Path, kinds: list[str], force: bool) -> list[str]:
    """Copy the shared adapter kit plus any vendor library the kinds require."""
    target = course_dir / "assets" / "visualizations"
    manifest = json.loads((VIZ_KIT / "vendor" / "manifest.json").read_text(encoding="utf-8"))
    selected = _verify_vendor(manifest, kinds)

    files = ["visualizations.js", "visualizations.css", "adapters.json"]
    for dependency in selected.values():
        files.extend("vendor/" + name for name in dependency["files"])

    destinations = [target / name for name in files] + [target / "vendor" / "manifest.json"]
    _check_targets(destinations, force)

    for name in files:
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(VIZ_KIT / name, destination)
    (target / "vendor").mkdir(exist_ok=True)
    (target / "vendor" / "manifest.json").write_text(json.dumps(selected, indent=2) + "\n", encoding="utf-8")

    notices = []
    for name in kinds:
        if name in selected:
            notices.append(f"visualizations/{name}：已复制 {selected[name]['package']} {selected[name]['version']}")
        else:
            notices.append(f"visualizations/{name}：适配器已随 visualizations.js 提供，无需 vendor 库")
    return notices


def install_simple(course_dir: Path, name: str, force: bool) -> list[str]:
    """Copy a self-contained component directory (optional JS/CSS/README)."""
    spec = SIMPLE_COMPONENTS[name]
    source: Path = spec["source"]
    target = course_dir / spec["target"]
    destinations = [target / filename for filename in spec["files"]]
    _check_targets(destinations, force)
    for filename in spec["files"]:
        destination = target / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / filename, destination)
    return [f"{name}：已复制到 {spec['target']}"]


def install(course_dir: Path, components: list[str], force: bool = False) -> list[str]:
    if not (course_dir / "course.yaml").is_file():
        raise InstallError("Initialize the course package first; course.yaml is missing")

    unknown = [name for name in components if name not in SIMPLE_COMPONENTS and name not in VISUALIZATION_KINDS]
    if unknown:
        known = sorted(list(SIMPLE_COMPONENTS) + list(VISUALIZATION_KINDS))
        raise InstallError(f"Unknown components: {sorted(unknown)}; choose from {known}")

    notices: list[str] = []
    viz_kinds = [name for name in components if name in VISUALIZATION_KINDS]
    if viz_kinds:
        notices.extend(install_visualizations(course_dir, viz_kinds, force))
    for name in components:
        if name in SIMPLE_COMPONENTS:
            notices.extend(install_simple(course_dir, name, force))
    return notices


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--components", nargs="+", required=True, help="Component names to install")
    parser.add_argument("--force", action="store_true", help="Replace files that already exist")
    args = parser.parse_args()
    try:
        notices = install(args.course_dir.expanduser().resolve(), args.components, args.force)
    except InstallError as exc:
        print(f"error: {exc}")
        return 1
    for notice in notices:
        print(f"  - {notice}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
