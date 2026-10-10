#!/usr/bin/env python3
"""Generate compatibility registries from assets/catalog.json; --check detects drift."""

import argparse
import json
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


def projections():
    assets = json.loads((SKILL / "assets/catalog.json").read_text(encoding="utf-8"))[
        "assets"
    ]
    adapters = json.loads(
        (SKILL / "assets/visualizations/adapters.json").read_text(encoding="utf-8")
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
    kinds = {
        name: spec
        for name, spec in assets.items()
        if spec.get("kind") and spec["status"] == "implemented"
    }
    defaults = [name for name, spec in kinds.items() if spec["delivery"] == "default"]
    optional = [name for name, spec in kinds.items() if spec["delivery"] == "optional"]
    files = list(
        dict.fromkeys(
            f
            for spec in assets.values()
            if spec["delivery"] == "default"
            for f in spec["files"]
            if f.startswith("visualizations/")
        )
    )
    manifest = {
        "version": "2.0",
        "note": "由 catalog.json 生成。这里只登记 optional；默认资源由初始化复制。",
        "components": {},
        "universal": {
            "note": "默认资源，无需可选安装。",
            "viz_kinds": defaults,
            "files": files,
        },
    }
    for name, spec in assets.items():
        if spec["delivery"] != "optional":
            continue
        if spec.get("kind"):
            manifest["components"][name] = {
                "label": spec["adapter"]["label"],
                "files": spec["files"],
                "vendor": "visualizations/vendor/manifest.json",
                "vendor_kinds": [spec["vendor"]],
                "docs": "../../references/render.md",
                "wiring": "安装后在内核之后引入 " + spec["module"],
                "degrade": spec["fallback"],
            }
        else:
            manifest["components"][name] = {
                "label": spec["supports"][0],
                "files": [
                    f.removeprefix("optional/")
                    for f in spec["files"]
                    if f != spec.get("docs")
                ],
                "docs": spec["docs"].removeprefix("optional/"),
                "wiring": spec["wiring"],
                "degrade": spec["fallback"],
            }
    components = json.loads(
        (SKILL / "assets/learnkit/components.json").read_text(encoding="utf-8")
    )
    components["note"] = (
        "catalog.json 的能力索引；HTML + data-* 为制作入口，LessonSpec 不生成整页。planned 名称不是可用 renderer。"
    )
    components["catalogue"] = "assets/catalog.json"
    components["kinds"].update(implemented=list(kinds), vendor_backed=optional)
    for key, names in [("universal", defaults), ("optional", optional)]:
        components["kinds"][key]["kinds"] = names
        components["kinds"][key]["modules"] = list(
            dict.fromkeys(kinds[n]["module"] for n in names)
        )
    components["optional"]["components"] = {
        n: {
            "label": s["supports"][0],
            "target": (
                "assets/visualizations" if s.get("kind") else "assets/optional/" + n
            ),
            "needs": s.get("network", {}).get("default", s.get("vendor", "无")),
        }
        for n, s in assets.items()
        if s["delivery"] == "optional"
    }
    (
        components["static_html"]["page_level"].append("数字与填空回答(course.js)")
        if "数字与填空回答(course.js)" not in components["static_html"]["page_level"]
        else None
    )
    state = {
        "version": 1,
        "visualizations": {"universal_kinds": defaults, "optional_kinds": []},
        "components": [],
    }
    return {
        "assets/visualizations/adapters.json": adapters,
        "assets/optional/manifest.json": manifest,
        "assets/learnkit/components.json": components,
        "assets/asset-manifest.json": state,
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
            path.write_text(text, encoding="utf-8")
    if mismatches:
        print("Registry drift: " + ", ".join(mismatches))
        return 1
    print("Asset registries match catalog.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
