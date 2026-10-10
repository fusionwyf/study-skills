#!/usr/bin/env python3
"""Materialize six maintained acceptance lessons in an isolated course directory."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from install_optional import install

SKILL = Path(__file__).resolve().parents[1]


def prepare(destination):
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite {destination}")
    subprocess.run(
        [
            sys.executable,
            str(SKILL / "scripts/init_course.py"),
            "--course-dir",
            str(destination),
            "--title",
            "通用资产验收课件",
            "--goal",
            "验证六类教学资产",
        ],
        check=True,
    )
    install(destination, ["chart", "spatial", "media"])
    source = SKILL / "assets/acceptance-course"
    for filename in ["course.yaml", "PLAN.md", "VALIDATION.md"]:
        shutil.copy2(source / filename, destination / filename)
    for folder in ["lessons", "reference"]:
        shutil.copytree(source / folder, destination / folder, dirs_exist_ok=True)
    subprocess.run(
        [sys.executable, str(SKILL / "scripts/build_index.py"), str(destination)],
        check=True,
    )
    subprocess.run(
        [
            sys.executable,
            str(SKILL / "scripts/validate_course.py"),
            str(destination),
            "--strict-schema",
            "--pedagogical",
        ],
        check=True,
    )
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    prepare(args.destination.resolve())
