#!/usr/bin/env python3
"""Install optional learning-course components into a course package.

Two tiers of component exist, and only the second one is handled here:

* **Universal** — the visualisation core, the library-free kinds (`relation`,
  `timeline`, `process`, `sequence`, `table`), the LearnKit runtime and the
  static lesson markup. Every course gets these from `init_course.py`; nothing
  in a course has to ask for them.
* **Content-dependent / optional** — installed on demand by this script, so a
  plain course stays small and offline:

      python scripts/install_optional.py <course-dir> --components code-highlight theme
      python scripts/install_optional.py <course-dir> --components chart spatial

`chart` and `spatial` are visualisation kinds that need a pinned third-party
library (Plotly, JSXGraph). Installing one copies only that kind's module plus
its vendor tree, never the whole kit.
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
ASSET_MANIFEST = "assets/asset-manifest.json"

# Universal, library-free kinds. Registered in every course by init_course.py,
# so asking for one here is a no-op worth reporting rather than an error.
VIZ_UNIVERSAL_KINDS = ("relation", "timeline", "process", "sequence", "table")
# Optional kinds backed by a pinned vendor library. These are the only ones
# this script installs.
VIZ_VENDOR_KINDS = ("chart", "spatial")
VISUALIZATION_KINDS = VIZ_UNIVERSAL_KINDS + VIZ_VENDOR_KINDS

# Components that are plain files plus an optional vendor tree.
SIMPLE_COMPONENTS = ("code-highlight", "theme")


class InstallError(Exception):
    """Raised when a request cannot be satisfied without partial writes."""


def _read_manifest() -> dict[str, object]:
    return json.loads((OPTIONAL / "manifest.json").read_text(encoding="utf-8"))


def _simple_spec(name: str) -> dict[str, object]:
    catalogue = _read_manifest().get("components", {})
    entry = catalogue.get(name) if isinstance(catalogue, dict) else None
    if not isinstance(entry, dict):
        raise InstallError(f"Optional component is missing from manifest: {name}")
    files = entry.get("files")
    if not isinstance(files, list) or not all(isinstance(item, str) for item in files):
        raise InstallError(f"Optional component has invalid files list: {name}")
    prefix = name + "/"
    relative_files = [item[len(prefix):] if item.startswith(prefix) else item for item in files]
    docs = entry.get("docs")
    if isinstance(docs, str) and docs.startswith(prefix):
        relative_files.append(docs[len(prefix):])
    return {
        "source": OPTIONAL / name,
        "target": f"assets/optional/{name}",
        "files": relative_files,
    }


def _copy_file(source: Path, destination: Path, force: bool) -> None:
    """Copy one asset idempotently, rejecting only a real content conflict."""
    if destination.exists() and not force:
        if destination.is_file() and destination.read_bytes() == source.read_bytes():
            return
        raise InstallError(f"Refusing to overwrite changed asset: {destination}; use --force to replace it")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _load_asset_manifest(course_dir: Path) -> dict[str, object]:
    path = course_dir / ASSET_MANIFEST
    if not path.is_file():
        return {
            "version": 1,
            "visualizations": {
                "universal_kinds": list(VIZ_UNIVERSAL_KINDS),
                "optional_kinds": [],
            },
            "components": [],
        }
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise InstallError(f"invalid {ASSET_MANIFEST}: {exc}") from exc
    if not isinstance(manifest, dict):
        raise InstallError(f"{ASSET_MANIFEST} must contain an object")
    return manifest


def _save_asset_manifest(course_dir: Path, manifest: dict[str, object]) -> None:
    path = course_dir / ASSET_MANIFEST
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    """Copy the kind module and vendor library for each requested optional kind.

    Only `chart` and `spatial` reach this function; the library-free kinds are
    part of the universal tier and never get here. A course that installs
    neither pays nothing — the core and the universal modules are already on
    disk from init_course.py.
    """
    target = course_dir / "assets" / "visualizations"
    vendor_manifest = json.loads((VIZ_KIT / "vendor" / "manifest.json").read_text(encoding="utf-8"))
    selected = _verify_vendor(vendor_manifest, kinds)

    modules = [f"kinds/{name}.js" for name in kinds]
    vendor_files = ["vendor/" + name for dependency in selected.values() for name in dependency["files"]]

    for name in modules + vendor_files:
        _copy_file(VIZ_KIT / name, target / name, force)

    # Merge with already-installed vendor libraries. Re-running the command or
    # adding a second optional kind must preserve the first kind's lock entry.
    vendor_manifest_path = target / "vendor" / "manifest.json"
    installed = {}
    if vendor_manifest_path.is_file():
        try:
            installed = json.loads(vendor_manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise InstallError(f"invalid course vendor manifest: {exc}") from exc
    if not isinstance(installed, dict):
        raise InstallError("course vendor manifest must contain an object")
    installed.update(selected)
    (target / "vendor").mkdir(parents=True, exist_ok=True)
    vendor_manifest_path.write_text(json.dumps(installed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return [f"visualizations/{name}：已复制 kinds/{name}.js 与 {selected[name]['package']} {selected[name]['version']}" for name in kinds]


def install_simple(course_dir: Path, name: str, force: bool) -> list[str]:
    """Copy a self-contained component directory (optional JS/CSS/README)."""
    spec = _simple_spec(name)
    source: Path = spec["source"]
    target = course_dir / spec["target"]
    for filename in spec["files"]:
        _copy_file(source / filename, target / filename, force)
    return [f"{name}：已复制到 {spec['target']}"]


def install(course_dir: Path, components: list[str], force: bool = False) -> list[str]:
    if not (course_dir / "course.yaml").is_file():
        raise InstallError("Initialize the course package first; course.yaml is missing")

    components = list(dict.fromkeys(components))
    unknown = [name for name in components if name not in SIMPLE_COMPONENTS and name not in VISUALIZATION_KINDS]
    if unknown:
        known = sorted(list(SIMPLE_COMPONENTS) + list(VISUALIZATION_KINDS))
        raise InstallError(f"Unknown components: {sorted(unknown)}; choose from {known}")

    notices: list[str] = []
    # Universal kinds arrive with init_course.py. Asking for one here is
    # harmless but must not create an empty kit directory, so answer plainly.
    for name in components:
        if name in VIZ_UNIVERSAL_KINDS:
            notices.append(f"visualizations/{name}：通用 kind，已随 init_course.py 进入默认包，无需安装")
    viz_kinds = [name for name in components if name in VIZ_VENDOR_KINDS]
    if viz_kinds:
        notices.extend(install_visualizations(course_dir, viz_kinds, force))
    for name in components:
        if name in SIMPLE_COMPONENTS:
            notices.extend(install_simple(course_dir, name, force))
    manifest = _load_asset_manifest(course_dir)
    viz_state = manifest.setdefault("visualizations", {})
    if not isinstance(viz_state, dict):
        raise InstallError(f"{ASSET_MANIFEST} visualizations must be an object")
    viz_state.setdefault("universal_kinds", list(VIZ_UNIVERSAL_KINDS))
    optional_kinds = viz_state.setdefault("optional_kinds", [])
    if not isinstance(optional_kinds, list):
        raise InstallError(f"{ASSET_MANIFEST} optional_kinds must be a list")
    for name in viz_kinds:
        if name not in optional_kinds:
            optional_kinds.append(name)
    installed_components = manifest.setdefault("components", [])
    if not isinstance(installed_components, list):
        raise InstallError(f"{ASSET_MANIFEST} components must be a list")
    for name in components:
        if name in SIMPLE_COMPONENTS and name not in installed_components:
            installed_components.append(name)
    _save_asset_manifest(course_dir, manifest)
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
