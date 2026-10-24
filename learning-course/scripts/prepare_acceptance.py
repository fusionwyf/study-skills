#!/usr/bin/env python3
"""Materialize six maintained acceptance lessons in an isolated course directory."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


def prepare(destination):
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite {destination}")
    source = SKILL / "fixtures/acceptance"
    shutil.copytree(source, destination)
    kit_py = SKILL / "kit/build/kit.py"
    if kit_py.is_file():
        for module_id in ["viz.kinds.chart", "viz.kinds.spatial", "viz.kinds.plot", "content.media"]:
            subprocess.run(
                [sys.executable, str(kit_py), "add", str(destination), module_id],
                check=True,
            )
        subprocess.run([sys.executable, str(kit_py), "sync", str(destination)], check=True)
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
