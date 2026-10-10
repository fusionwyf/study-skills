#!/usr/bin/env python3
"""Install optional assets and dependencies from assets/catalog.json without partial writes."""

from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
ASSET_MANIFEST = "assets/asset-manifest.json"


class InstallError(Exception):
    """An installation request could not be completed."""


def catalogue():
    return json.loads((SKILL / "assets/catalog.json").read_text(encoding="utf-8"))[
        "assets"
    ]


def _object(path, default):
    if not path.exists():
        return default
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("expected object")
        return value
    except (OSError, ValueError) as exc:
        raise InstallError(f"Invalid manifest {path}: {exc}") from exc


def _json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _commit(root, files, force, metadata):
    # All source reads, manifest merges and conflict checks precede mutation.
    originals = {}
    for relative, data in files.items():
        target = root / relative
        if target.exists():
            if not target.is_file():
                raise InstallError(f"Asset target is not a file: {target}")
            old = target.read_bytes()
            if old != data and relative not in metadata and not force:
                raise InstallError(
                    f"Refusing to overwrite changed asset: {target}; use --force to replace it"
                )
            originals[relative] = old
        else:
            originals[relative] = None
    changed = [name for name, data in files.items() if originals[name] != data]
    made_dirs = []
    written = []
    with tempfile.TemporaryDirectory(prefix=".asset-install-", dir=root.parent) as tmp:
        stage = Path(tmp)
        for relative in changed:
            target = stage / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(files[relative])
        try:
            for relative in changed:
                target = root / relative
                missing = []
                parent = target.parent
                while not parent.exists():
                    missing.append(parent)
                    parent = parent.parent
                for parent in reversed(missing):
                    parent.mkdir()
                    made_dirs.append(parent)
                os.replace(stage / relative, target)
                written.append(relative)
        except OSError as exc:
            # Restore replaced user files and remove newly installed files.
            for relative in reversed(written):
                target = root / relative
                if originals[relative] is None:
                    target.unlink()
                else:
                    target.write_bytes(originals[relative])
            for parent in reversed(made_dirs):
                try:
                    parent.rmdir()
                except OSError:
                    pass
            raise InstallError(f"Installation rolled back: {exc}") from exc


def install(course_dir: Path, components: list[str], force: bool = False) -> list[str]:
    course_dir = course_dir.resolve()
    if not (course_dir / "course.yaml").is_file():
        raise InstallError(
            "Initialize the course package first; course.yaml is missing"
        )
    assets = catalogue()
    requested = list(dict.fromkeys(components))
    unknown = [
        n
        for n in requested
        if n not in assets or assets[n]["delivery"] not in ("default", "optional")
    ]
    if unknown:
        raise InstallError(
            f'Unknown components: {unknown}; choose from {[n for n,s in assets.items() if s["delivery"]=="optional"]}'
        )
    notices = [
        f"visualizations/{n}：通用 kind，已随 init_course.py 进入默认包，无需安装"
        for n in requested
        if assets[n]["delivery"] == "default"
    ]
    optional = [n for n in requested if assets[n]["delivery"] == "optional"]
    if not optional:
        return notices
    selected = []
    visiting = set()

    def visit(name):
        if name in selected:
            return
        if name in visiting:
            raise InstallError(f"Asset dependency cycle: {name}")
        if name not in assets:
            raise InstallError(f"Unknown asset dependency: {name}")
        visiting.add(name)
        for dependency in assets[name]["dependencies"]:
            visit(dependency)
        visiting.remove(name)
        selected.append(name)

    for name in optional:
        visit(name)
    files = {}
    vendor = {}
    vendor_source = _object(SKILL / "assets/visualizations/vendor/manifest.json", {})
    for name in selected:
        spec = assets[name]
        for relative in spec["files"]:
            destination = spec.get("targets", {}).get(relative, relative)
            try:
                existing = course_dir / "assets" / destination
                # Default dependencies belong to the course once initialized;
                # optional installation must preserve course styling/customization.
                files["assets/" + destination] = (
                    existing.read_bytes()
                    if spec["delivery"] == "default" and existing.is_file()
                    else (SKILL / "assets" / relative).read_bytes()
                )
            except OSError as exc:
                raise InstallError(f"Missing asset {name}: {relative}") from exc
        if spec.get("vendor"):
            dependency = vendor_source.get(spec["vendor"])
            if not isinstance(dependency, dict):
                raise InstallError(f"Missing vendor lock: {name}")
            for relative in dependency["files"]:
                source = SKILL / "assets/visualizations/vendor" / relative
                try:
                    data = source.read_bytes()
                except OSError as exc:
                    raise InstallError(f"Missing vendor file: {relative}") from exc
                checksum = dependency["sha256"].get(relative)
                if not checksum or hashlib.sha256(data).hexdigest() != checksum:
                    raise InstallError(f"Checksum mismatch for {relative}")
                files["assets/visualizations/vendor/" + relative] = data
            vendor[spec["vendor"]] = dependency
    state = _object(
        course_dir / ASSET_MANIFEST,
        {
            "version": 1,
            "visualizations": {"universal_kinds": [], "optional_kinds": []},
            "components": [],
        },
    )
    viz = state.setdefault("visualizations", {})
    if not isinstance(viz, dict):
        raise InstallError("visualizations must be an object")
    for parent, key in [
        (viz, "optional_kinds"),
        (viz, "universal_kinds"),
        (state, "components"),
    ]:
        values = parent.setdefault(key, [])
        if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
            raise InstallError(f"{key} must be a string list")
    for name in selected:
        spec = assets[name]
        if spec.get("kind"):
            key = (
                "optional_kinds"
                if spec["delivery"] == "optional"
                else "universal_kinds"
            )
            if name not in viz[key]:
                viz[key].append(name)
        elif spec["delivery"] == "optional" and name not in state["components"]:
            state["components"].append(name)
    files[ASSET_MANIFEST] = _json_bytes(state)
    metadata = {ASSET_MANIFEST}
    if vendor:
        lock = "assets/visualizations/vendor/manifest.json"
        merged = _object(course_dir / lock, {})
        merged.update(vendor)
        files[lock] = _json_bytes(merged)
        metadata.add(lock)
    _commit(course_dir, files, force, metadata)
    return notices + [f"{name}：已安装及登记依赖" for name in optional]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--components", nargs="+", required=True)
    parser.add_argument(
        "--force", action="store_true", help="Replace locally changed assets"
    )
    args = parser.parse_args()
    try:
        for notice in install(
            args.course_dir.expanduser(), args.components, args.force
        ):
            print(notice)
    except (InstallError, OSError, ValueError) as exc:
        print(f"error: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
