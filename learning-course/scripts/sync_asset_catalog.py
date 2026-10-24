#!/usr/bin/env python3
"""Generate compatibility registries from kit/catalog.json; --check detects drift."""

import argparse
import json
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


def projections():
    assets = json.loads((SKILL / "kit/catalog.json").read_text(encoding="utf-8"))[
        "assets"
    ]
    adapters = json.loads(
        (SKILL / "kit/viz/adapters.json").read_text(encoding="utf-8")
    )
    adapters["note"] = (
        "由 scripts/sync_asset_catalog.py 从 catalog.json 生成；修改能力、模块和交付方式请编辑 catalog.json。"
    )
    adapters["kinds"] = {}
    for name, spec in assets.items():
        if "kind" in spec:
            adapters["kinds"][name] = dict(
                spec["adapter"],
                tier={
                    "default": "universal",
                    "optional": "optional",
                    "extension": "extension",
                }[spec["delivery"]],
            )
            if spec.get("module"):
                adapters["kinds"][name]["module"] = spec["module"]
    return {
        "kit/viz/adapters.json": adapters,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    mismatches = []
    for relative, data in projections().items():
        path = SKILL / relative
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            if path.read_text(encoding="utf-8") != text:
                mismatches.append(relative)
        else:
            path.write_text(text, encoding="utf-8", newline="\n")
    if mismatches:
        print("Registry drift: " + ", ".join(mismatches))
        return 1
    print("Asset registries match catalog.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
