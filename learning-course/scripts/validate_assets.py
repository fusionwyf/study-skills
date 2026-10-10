"""Course asset installation, wiring and model input validation."""

import hashlib
import json
import math
import os
from pathlib import Path
from html.parser import HTMLParser


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs)
        if tag == "link" and attrs.get("href"):
            self.links.append(attrs)


def local_path(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("asset path escapes course")
    return path


def validate_asset_package(root, errors):
    path = root / "assets/asset-manifest.json"
    if not path.is_file():
        return  # Legacy packages are validated per used visualization.
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(state, dict):
            raise ValueError("asset manifest must be an object")
        catalog_path = root / "assets/catalog.json"
        fallback = Path(__file__).resolve().parents[1] / "assets/catalog.json"
        catalog = json.loads(
            (catalog_path if catalog_path.exists() else fallback).read_text(
                encoding="utf-8"
            )
        )["assets"]
        viz = state["visualizations"]
        if not isinstance(viz, dict):
            raise ValueError("visualizations must be an object")
        for values in (
            viz["universal_kinds"],
            viz["optional_kinds"],
            state["components"],
        ):
            if not isinstance(values, list) or not all(
                isinstance(x, str) for x in values
            ):
                raise ValueError("installed names must be string lists")
        names = viz["universal_kinds"] + viz["optional_kinds"] + state["components"]
        if not all(isinstance(x, str) for x in names):
            raise ValueError("installed names must be strings")
        for name in names:
            if name not in catalog:
                errors.append(f"unknown installed asset: {name}")
                continue
            spec = catalog[name]
            for relative in spec["files"]:
                if not local_path(
                    root / "assets", spec.get("targets", {}).get(relative, relative)
                ).is_file():
                    errors.append(f"installed asset {name} missing file: {relative}")
            if spec.get("vendor"):
                lock_path = root / "assets/visualizations/vendor/manifest.json"
                lock = json.loads(lock_path.read_text(encoding="utf-8"))
                if not isinstance(lock, dict):
                    raise ValueError("vendor lock must be an object")
                dependency = lock.get(spec["vendor"])
                if not dependency:
                    errors.append(f"missing vendor lock for {name}")
                    continue
                if (
                    not isinstance(dependency, dict)
                    or not isinstance(dependency.get("files"), list)
                    or not all(isinstance(x, str) for x in dependency["files"])
                    or not isinstance(dependency.get("sha256"), dict)
                ):
                    raise ValueError("invalid vendor lock entry")
                for relative in dependency["files"]:
                    vendor = local_path(root / "assets/visualizations/vendor", relative)
                    checksum = dependency["sha256"].get(relative)
                    if (
                        not vendor.is_file()
                        or not checksum
                        or hashlib.sha256(vendor.read_bytes()).hexdigest() != checksum
                    ):
                        errors.append(
                            f"vendor checksum mismatch or missing file: {relative}"
                        )
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"invalid course asset installation: {exc}")


def validate_wiring(lesson, body, errors):
    root = lesson.resolve().parent.parent
    if not (root / "course.yaml").is_file():
        return
    parsed = Scripts()
    parsed.feed(body)
    scripts = [
        (lesson.parent / a["src"].split("#")[0]).resolve() for a in parsed.scripts
    ]

    def require(relative):
        target = (root / relative).resolve()
        if target not in scripts:
            errors.append(f"{lesson.name}: missing script {relative}")
            return None
        index = scripts.index(target)
        if "async" in parsed.scripts[index]:
            errors.append(
                f"{lesson.name}: async script violates ordered asset loading: {relative}"
            )
        return index

    def before(first, second):
        a = require(first)
        b = require(second)
        if a is not None and b is not None:
            if a >= b:
                errors.append(f"{lesson.name}: {first} must load before {second}")
            a_defer = "defer" in parsed.scripts[a]
            b_defer = "defer" in parsed.scripts[b]
            if a_defer and not b_defer:
                errors.append(f"{lesson.name}: mixed defer scripts break load order")

    if "data-visualization" in body:
        core = require("assets/visualizations/visualizations.js")
        for i, target in enumerate(scripts):
            if "/visualizations/kinds/" in target.as_posix():
                if core is not None and core >= i:
                    errors.append(
                        f"{lesson.name}: visualization core must load before kind module"
                    )
                if target.is_relative_to(root):
                    before(
                        "assets/visualizations/visualizations.js",
                        target.relative_to(root).as_posix(),
                    )
    if "data-viz-source" in body or "data-learnkit" in body:
        (
            before(
                "assets/learnkit/learnkit.js", "assets/visualizations/visualizations.js"
            )
            if "data-visualization" in body
            else require("assets/learnkit/learnkit.js")
        )
    course = root / "assets/course.js"
    if course.resolve() in scripts:
        before("assets/learnkit/learnkit.js", "assets/course.js")
    catalog = json.loads(
        (Path(__file__).resolve().parents[1] / "assets/catalog.json").read_text(
            encoding="utf-8"
        )
    )["assets"]
    state_path = root / "assets/asset-manifest.json"
    try:
        state = (
            json.loads(state_path.read_text(encoding="utf-8"))
            if state_path.exists()
            else {}
        )
    except (ValueError, OSError) as exc:
        errors.append(f"{lesson.name}: invalid asset manifest: {exc}")
        state = {}
    installed = state.get("components", []) if isinstance(state, dict) else []
    if not isinstance(installed, list) or not all(
        isinstance(x, str) for x in installed
    ):
        errors.append(f"{lesson.name}: components must be a string list")
        installed = []
    for name, spec in catalog.items():
        if spec["delivery"] != "optional" or spec.get("kind"):
            continue
        asset_files = [root / "assets" / f for f in spec["files"] if f.endswith(".js")]
        referenced = any(path.resolve() in scripts for path in asset_files)
        if name == "media" and "data-media" in body:
            referenced = True
        if not referenced:
            continue
        if name not in installed:
            errors.append(f"{lesson.name}: optional component {name} is not installed")
        for relative in spec["files"]:
            if relative.endswith(".js"):
                require("assets/" + relative)
            if relative.endswith(".css") and not relative.endswith(
                ("github.min.css", "github-dark.min.css")
            ):
                target = (root / "assets" / relative).resolve()
                if target not in [
                    (lesson.parent / a["href"]).resolve()
                    for a in parsed.links
                    if a.get("rel") == "stylesheet"
                ]:
                    errors.append(
                        f"{lesson.name}: missing stylesheet assets/{relative}"
                    )
        if name == "media":
            before("assets/course.js", "assets/optional/media/media.js")
        if name == "code-highlight":
            before(
                "assets/optional/code-highlight/theme.js",
                "assets/optional/code-highlight/code-highlight.js",
            )


def validate_data(kind, config):
    """Mirror the observable runtime contract for built-in shapes; extensions own their schemas."""

    def finite(x):
        return (
            isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)
        )

    def array(x):
        return isinstance(x, list) and bool(x)

    if kind in ("relation", "process", "timeline"):
        nodes = config.get("events" if kind == "timeline" else "nodes")
        if not array(nodes) or not all(isinstance(n, dict) for n in nodes):
            raise ValueError(f"{kind} needs nonempty object list")
        if kind != "timeline":
            ids = [
                str(n.get("id", n.get("label", n.get("title", n.get("name", i + 1)))))
                for i, n in enumerate(nodes)
            ]
            if len(set(ids)) != len(ids):
                raise ValueError("duplicate node ids")
            edges = config.get("edges", [])
            if not isinstance(edges, list) or any(
                not isinstance(e, dict)
                or str(e.get("from")) not in ids
                or str(e.get("to")) not in ids
                for e in edges
            ):
                raise ValueError("edges require existing from/to nodes")
    elif kind == "chart":
        traces = config.get("traces")
        if not array(traces):
            raise ValueError("chart needs nonempty traces")
        axes = []
        for t in traces:
            if not isinstance(t, dict):
                raise ValueError("trace must be object")
            type = t.get("type", "scatter")
            x = t.get("x")
            y = t.get("y")
            if type not in ("scatter", "bar", "surface", "heatmap"):
                raise ValueError("unsupported trace type")
            if not array(x) or not array(y):
                raise ValueError("nonempty x/y required")
            if type in ("scatter", "bar"):
                numeric = all(finite(v) for v in x)
                category = all(isinstance(v, str) and v.strip() for v in x)
                if (
                    not (numeric or category)
                    or len(x) != len(y)
                    or not any(finite(v) for v in y)
                    or any(v is not None and not finite(v) for v in y)
                ):
                    raise ValueError("invalid chart x/y")
                axes.append(numeric)
            else:
                z = t.get("z")
                if (
                    not all(finite(v) for v in x + y)
                    or not array(z)
                    or len(z) != len(y)
                    or any(
                        not isinstance(row, list)
                        or len(row) != len(x)
                        or any(v is not None and not finite(v) for v in row)
                        for row in z
                    )
                ):
                    raise ValueError("invalid chart grid")
        if axes and len(set(axes)) > 1:
            raise ValueError("mixed category/numeric axes")
    elif kind == "spatial":
        if "matrix" in config or "vector" in config:
            matrix = config.get("matrix")
            vector = config.get("vector")
            if (
                not isinstance(matrix, list)
                or len(matrix) != 2
                or any(
                    not isinstance(row, list)
                    or len(row) != 2
                    or not all(finite(v) for v in row)
                    for row in matrix
                )
                or not isinstance(vector, list)
                or len(vector) != 2
                or not all(finite(v) for v in vector)
            ):
                raise ValueError("matrix/vector must be finite 2D data")
            if not all(
                finite(sum(a * b for a, b in zip(row, vector))) for row in matrix
            ):
                raise ValueError("matrix product overflow")
        elif not array(config.get("shapes")):
            raise ValueError("spatial requires shapes or matrix/vector")
    elif kind == "sequence":
        if "steps" in config:
            if not array(config["steps"]) or any(
                not isinstance(s, dict)
                or not any(s.get(k) for k in ("title", "summary", "message"))
                for s in config["steps"]
            ):
                raise ValueError("steps need titles or messages")
        elif (
            not isinstance(config.get("input"), list)
            or not 2 <= len(config["input"]) <= 32
            or not all(finite(v) for v in config["input"])
        ):
            raise ValueError("sequence input requires 2..32 finite values")
