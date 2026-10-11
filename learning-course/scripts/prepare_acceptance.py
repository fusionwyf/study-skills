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
    source = SKILL / "fixtures/acceptance"
    shutil.copytree(source, destination)
    install(destination, ["chart", "spatial", "media"])
    kit_py = SKILL / "kit/build/kit.py"
    if kit_py.is_file():
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
