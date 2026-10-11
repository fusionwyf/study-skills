#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Course Kit v2 Build & CLI Toolchain
Commands:
  kit build                  Builds kit manifest, topological order, and catalog view
  kit sync <course_dir>      Scans lessons, normalizes HTML, generates assets/kit/ and kit.lock.json
  kit check <course_dir>     Verifies kit.lock.json hashes and module integrity
  kit add <course_dir> <mod> Adds an opt-in module to course config and syncs
  kit list                   Lists available modules and descriptors
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from html.parser import HTMLParser
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

KIT_VERSION = "2.0.0"
KIT_ROOT = Path(__file__).resolve().parent.parent
SKILL_ROOT = KIT_ROOT.parent

LAYER_ORDER = ["reset", "tokens", "base", "content", "shell", "learning", "viz", "theme", "course"]
LAYER_HEADER = "@layer reset, tokens, base, content, shell, learning, viz, theme, course;\n\n"

UNIFIED_VENDORS = {
    "hljs": {
        "id": "hljs",
        "version": "11.12.0",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js",
            "local": "../assets/kit/vendor/hljs/highlight.min.js"
        }
    },
    "katex": {
        "id": "katex",
        "version": "0.16.11",
        "css": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
            "local": "../assets/kit/vendor/katex/katex.min.css"
        },
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
            "local": "../assets/kit/vendor/katex/katex.min.js"
        },
        "autoRender": {
            "cdn": "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
            "local": "../assets/kit/vendor/katex/auto-render.min.js"
        }
    },
    "mermaid": {
        "id": "mermaid",
        "version": "11.4.1",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
            "local": "../assets/kit/vendor/mermaid/mermaid.min.js"
        }
    },
    "plotly": {
        "id": "plotly",
        "version": "4.1.2",
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.1.2/plotly.min.js",
            "local": "../assets/kit/vendor/plotly.js-dist-min/plotly.min.js"
        }
    },
    "jsxgraph": {
        "id": "jsxgraph",
        "version": "1.14.0",
        "css": {
            "cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraph.css",
            "local": "../assets/kit/vendor/jsxgraph/jsxgraph.css"
        },
        "js": {
            "cdn": "https://cdn.jsdelivr.net/npm/jsxgraph@1.14.0/distrib/jsxgraphcore.js",
            "local": "../assets/kit/vendor/jsxgraph/jsxgraphcore.js"
        }
    }
}


def parse_selector(sel):
    """
    Parses a CSS selector into a matcher spec.
    Supported forms:
      tag                  -> {'type': 'tag', 'tag': ...}
      .class               -> {'type': 'class', 'class': ...}
      tag.class            -> {'type': 'tag_class', 'tag': ..., 'class': ...}
      [attr]               -> {'type': 'attr', 'attr': ...}
      [attr="val"]         -> {'type': 'attr_val', 'attr': ..., 'val': ...}
      tag[attr]            -> {'type': 'tag_attr', 'tag': ..., 'attr': ...}
      tag[attr="val"]      -> {'type': 'tag_attr_val', 'tag': ..., 'attr': ..., 'val': ...}
      parent > child       -> {'type': 'parent_child', 'parent': ..., 'child': ...}
    Raises ValueError for unsupported selector syntax.
    """
    s = sel.strip()
    m = re.match(r"^([a-zA-Z0-9_-]+)\s*>\s*([a-zA-Z0-9_-]+)$", s)
    if m:
        return {"type": "parent_child", "parent": m.group(1).lower(), "child": m.group(2).lower(), "raw": s}
    m = re.match(r"^\[([a-zA-Z0-9_-]+)=[\"']([^\"']+)[\"']\]$", s)
    if m:
        return {"type": "attr_val", "attr": m.group(1), "val": m.group(2), "raw": s}
    m = re.match(r"^\[([a-zA-Z0-9_-]+)\]$", s)
    if m:
        return {"type": "attr", "attr": m.group(1), "raw": s}
    m = re.match(r"^([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)=[\"']([^\"']+)[\"']\]$", s)
    if m:
        return {"type": "tag_attr_val", "tag": m.group(1).lower(), "attr": m.group(2), "val": m.group(3), "raw": s}
    m = re.match(r"^([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)\]$", s)
    if m:
        return {"type": "tag_attr", "tag": m.group(1).lower(), "attr": m.group(2), "raw": s}
    m = re.match(r"^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)$", s)
    if m:
        return {"type": "tag_class", "tag": m.group(1).lower(), "class": m.group(2), "raw": s}
    m = re.match(r"^\.([a-zA-Z0-9_-]+)$", s)
    if m:
        return {"type": "class", "class": m.group(1), "raw": s}
    m = re.match(r"^([a-zA-Z0-9_-]+)$", s)
    if m:
        return {"type": "tag", "tag": m.group(1).lower(), "raw": s}
    raise ValueError(f"Unsupported selector in module detection rule: '{sel}'")


class HTMLModuleDetector(HTMLParser):
    def __init__(self, auto_rules):
        super().__init__()
        self.auto_rules = auto_rules
        self.matched = {}
        self.stack = []
        self.ignore_math_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        classes = set(attrs_dict.get("class", "").split())
        parent_tag = self.stack[-1]["tag"] if self.stack else None

        if tag.lower() in ("pre", "code", "script", "style") or "data-math-ignore" in attrs_dict:
            self.ignore_math_depth += 1

        self.stack.append({"tag": tag.lower(), "attrs": attrs_dict, "classes": classes})

        tag_lower = tag.lower()
        for mod_id, rule in self.auto_rules.items():
            if mod_id in self.matched:
                continue
            for sel in rule.get("selectors", []):
                stype = sel["type"]
                if stype == "tag" and sel["tag"] == tag_lower:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "class" and sel["class"] in classes:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "tag_class" and sel["tag"] == tag_lower and sel["class"] in classes:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "attr" and sel["attr"] in attrs_dict:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "attr_val" and attrs_dict.get(sel["attr"]) == sel["val"]:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "tag_attr" and sel["tag"] == tag_lower and sel["attr"] in attrs_dict:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "tag_attr_val" and sel["tag"] == tag_lower and attrs_dict.get(sel["attr"]) == sel["val"]:
                    self.matched[mod_id] = sel["raw"]
                elif stype == "parent_child" and sel["parent"] == parent_tag and sel["child"] == tag_lower:
                    self.matched[mod_id] = sel["raw"]

    def handle_endtag(self, tag):
        if self.stack:
            elem = self.stack.pop()
            if elem["tag"] in ("pre", "code", "script", "style") or "data-math-ignore" in elem["attrs"]:
                self.ignore_math_depth = max(0, self.ignore_math_depth - 1)

    def handle_data(self, data):
        if self.ignore_math_depth == 0:
            for mod_id, rule in self.auto_rules.items():
                if mod_id in self.matched:
                    continue
                for reg in rule.get("regexes", []):
                    if reg.search(data):
                        self.matched[mod_id] = f"regex:{reg.pattern}"


def validate_descriptor(mod_id, data, mod_path):
    if not isinstance(data, dict):
        raise ValueError(f"Module descriptor at {mod_path} must be a JSON object")
    if data.get("id") != mod_id:
        raise ValueError(f"Module ID mismatch in {mod_path}: expected '{mod_id}', got '{data.get('id')}'")
    layer = data.get("layer")
    if not isinstance(layer, int) or layer < 0 or layer > 8:
        raise ValueError(f"Module {mod_id}: invalid layer {layer}; must be integer 0..8")
    presence = data.get("presence")
    if presence not in ("core", "auto", "opt-in"):
        raise ValueError(f"Module {mod_id}: invalid presence '{presence}'; must be 'core', 'auto', or 'opt-in'")
    requires = data.get("requires", [])
    if not isinstance(requires, list) or not all(isinstance(r, str) for r in requires):
        raise ValueError(f"Module {mod_id}: 'requires' must be a list of string module IDs")

    provides = data.get("provides", {})
    if not isinstance(provides, dict):
        raise ValueError(f"Module {mod_id}: 'provides' must be an object")
    mod_dir = mod_path.parent
    for js_file in provides.get("js", []):
        if not (mod_dir / js_file).is_file():
            raise ValueError(f"Module {mod_id}: declared js file '{js_file}' not found in {mod_dir}")
    for css_file in provides.get("css", []):
        if not (mod_dir / css_file).is_file():
            raise ValueError(f"Module {mod_id}: declared css file '{css_file}' not found in {mod_dir}")

    detect = data.get("detect", {})
    if presence == "auto":
        if not detect or (not detect.get("selectors") and not detect.get("regex")):
            raise ValueError(f"Module {mod_id}: auto module must define detect.selectors or detect.regex")
    if detect:
        for sel in detect.get("selectors", []):
            parse_selector(sel)


def load_module_descriptors():
    """Finds and parses all module.json in kit/ with validation."""
    modules = {}
    for mod_path in KIT_ROOT.glob("**/module.json"):
        if "vendor" in mod_path.parts or "build" in mod_path.parts:
            continue
        try:
            data = json.loads(mod_path.read_text(encoding="utf-8"))
            mod_id = data.get("id")
            if not mod_id:
                raise ValueError(f"Module descriptor in {mod_path} is missing 'id'")
            if mod_id in modules:
                raise ValueError(f"Duplicate module ID '{mod_id}' found in {mod_path}")
            validate_descriptor(mod_id, data, mod_path)
            data["_dir"] = str(mod_path.parent)
            modules[mod_id] = data
        except Exception as e:
            print(f"Error: Failed to load {mod_path}: {e}", file=sys.stderr)
            raise

    # Cross-check dependencies and layer ordering
    for mod_id, mod in modules.items():
        for req in mod.get("requires", []):
            if req not in modules:
                raise ValueError(f"Module '{mod_id}' requires missing module '{req}'")
            if modules[req].get("layer", 0) > mod.get("layer", 0):
                raise ValueError(
                    f"Module '{mod_id}' (layer {mod.get('layer')}) cannot depend on higher layer module '{req}' (layer {modules[req].get('layer')})"
                )

    return modules


def topological_sort(modules):
    """Sorts modules by dependencies and layer."""
    visited = set()
    visiting = set()
    order = []

    def visit(mod_id):
        if mod_id in visiting:
            raise ValueError(f"Circular dependency detected involving {mod_id}")
        if mod_id in visited:
            return
        visiting.add(mod_id)
        mod = modules.get(mod_id)
        if mod:
            for req in mod.get("requires", []):
                if req in modules:
                    visit(req)
        visiting.remove(mod_id)
        visited.add(mod_id)
        order.append(mod_id)

    # Sort keys by layer first so lower layers resolve earlier
    sorted_ids = sorted(modules.keys(), key=lambda m: (modules[m].get("layer", 0), m))
    for mod_id in sorted_ids:
        if mod_id not in visited:
            visit(mod_id)

    return order


def build_manifest():
    """Builds kit.manifest.json and updates catalog.json."""
    modules = load_module_descriptors()
    order = topological_sort(modules)

    manifest_data = {
        "kit": KIT_VERSION,
        "layers": LAYER_ORDER,
        "order": order,
        "modules": {
            k: {field: v[field] for field in v if not field.startswith("_")}
            for k, v in modules.items()
        }
    }

    manifest_file = KIT_ROOT / "kit.manifest.json"
    manifest_file.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Generated {manifest_file} with {len(modules)} modules.")

    catalog_file = KIT_ROOT / "catalog.json"
    catalog_data = {
        "version": KIT_VERSION,
        "note": "由 kit build 自动生成，请勿手动修改。模块定义见 kit/**/module.json。",
        "modules": manifest_data["modules"]
    }
    if catalog_file.exists():
        try:
            old_cat = json.loads(catalog_file.read_text(encoding="utf-8"))
            if "assets" in old_cat:
                catalog_data["assets"] = old_cat["assets"]
            if "entrypoint" in old_cat:
                catalog_data["entrypoint"] = old_cat["entrypoint"]
            if "roles" in old_cat:
                catalog_data["roles"] = old_cat["roles"]
            if "delivery" in old_cat:
                catalog_data["delivery"] = old_cat["delivery"]
        except Exception:
            pass

    catalog_file.write_text(json.dumps(catalog_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Updated {catalog_file}.")

    return manifest_data


def slugify(text):
    """Generates clean slug for heading text, supporting Chinese and English."""
    cleaned = re.sub(r"[^\w\u4e00-\u9fff\- ]+", "", text.strip())
    slug = re.sub(r"[\s_]+", "-", cleaned).strip("-").lower()
    return slug or "section"


def normalize_html_content(html_text):
    """
    Normalizes heading IDs and static TOC fallback in HTML.
    Returns (updated_html, headings_list).
    """
    headings = []
    seen_ids = set()

    # Step 1: Replace or ensure heading IDs
    def replace_heading(match):
        tag = match.group(1).lower()
        attrs = match.group(2) or ""
        inner = match.group(3)

        # Strip inner tags for plain title text
        plain_title = re.sub(r"<[^>]+>", "", inner).strip()

        id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
        if id_match:
            hid = id_match.group(1)
        else:
            base_slug = slugify(plain_title)
            hid = base_slug
            idx = 1
            while hid in seen_ids:
                hid = f"{base_slug}_{idx}"
                idx += 1
            attrs = f'{attrs.strip()} id="{hid}"'.strip()

        seen_ids.add(hid)
        headings.append({
            "tag": tag,
            "id": hid,
            "title": plain_title
        })
        return f"<{tag} {attrs}>{inner}</{tag}>"

    # Match h2 and h3
    pattern = re.compile(r"<(h[23])(\s+[^>]*)?>(.*?)</\1>", re.DOTALL | re.IGNORECASE)
    normalized = pattern.sub(replace_heading, html_text)

    # Step 2: Build static TOC fallback
    if headings:
        toc_items = []
        for h in headings:
            cls = "is-h2" if h["tag"] == "h2" else "is-h3"
            toc_items.append(f'      <li class="toc-item {cls}"><a class="toc-link" href="#{h["id"]}">{h["title"]}</a></li>')
        toc_html = (
            '<nav class="kit-toc" aria-label="本课目录" data-kit-toc>\n'
            '  <div class="toc-header"><p class="toc-title">本课目录</p></div>\n'
            '  <div class="toc-scroll">\n'
            '    <ul class="toc-list">\n'
            + "\n".join(toc_items) + "\n"
            '    </ul>\n'
            '  </div>\n'
            '</nav>'
        )

        # Replace existing <nav class="kit-toc"...> or inside <aside class="kit-rail">
        if '<nav class="kit-toc"' in normalized:
            normalized = re.sub(
                r'<nav\s+class="kit-toc"[^>]*>.*?</nav>',
                toc_html,
                normalized,
                flags=re.DOTALL
            )
        elif '<aside class="kit-rail">' in normalized:
            normalized = normalized.replace(
                '<aside class="kit-rail">',
                f'<aside class="kit-rail">\n  {toc_html}'
            )

    return normalized, headings


def detect_modules_for_course(course_dir, manifest):
    """Scans lesson HTML files and identifies active modules, recording inclusion reasons."""
    lessons_dir = Path(course_dir) / "lessons"
    html_files = list(lessons_dir.glob("*.html")) if lessons_dir.exists() else []

    config_file = Path(course_dir) / "assets" / "course" / "config.json"
    opt_in_modules = []
    if config_file.exists():
        try:
            cfg = json.loads(config_file.read_text(encoding="utf-8"))
            raw_mods = cfg.get("modules", [])
            if not isinstance(raw_mods, list) or not all(isinstance(m, str) for m in raw_mods):
                raise ValueError("assets/course/config.json: 'modules' must be a list of string module IDs")
            opt_in_modules = raw_mods
        except Exception as e:
            raise ValueError(f"Failed to read course config.json: {e}")

    modules_desc = manifest["modules"]

    # Unknown opt-in modules must fail explicitly
    for mod_id in opt_in_modules:
        if mod_id not in modules_desc:
            raise ValueError(
                f"Unknown opt-in module '{mod_id}' specified in assets/course/config.json. "
                f"Run 'kit list' to view available modules."
            )

    active_modules = set()
    reasons = {}

    # 1. Core modules are always active
    for mod_id, desc in modules_desc.items():
        if desc.get("presence") == "core":
            active_modules.add(mod_id)
            reasons.setdefault(mod_id, []).append("core")

    # 2. Add opt-in modules
    for mod_id in opt_in_modules:
        active_modules.add(mod_id)
        reasons.setdefault(mod_id, []).append("opt-in:config.json")

    # 3. Detect auto modules from lesson HTMLs
    auto_rules = {}
    for mod_id, desc in modules_desc.items():
        if desc.get("presence") == "auto":
            detect = desc.get("detect", {})
            parsed_sels = [parse_selector(s) for s in detect.get("selectors", [])]
            regexes = [re.compile(r) for r in detect.get("regex", [])]
            auto_rules[mod_id] = {"selectors": parsed_sels, "regexes": regexes}

    for hf in html_files:
        try:
            content = hf.read_text(encoding="utf-8")
            detector = HTMLModuleDetector(auto_rules)
            detector.feed(content)
            for mod_id, match_reason in detector.matched.items():
                active_modules.add(mod_id)
                reasons.setdefault(mod_id, []).append(f"auto:{hf.name}:{match_reason}")
        except Exception as e:
            print(f"Warning: Failed scanning {hf.name}: {e}", file=sys.stderr)

    # 4. Resolve transitive requirements
    expanded = True
    while expanded:
        expanded = False
        for mod_id in list(active_modules):
            desc = modules_desc.get(mod_id, {})
            for req in desc.get("requires", []):
                if req in modules_desc and req not in active_modules:
                    active_modules.add(req)
                    reasons.setdefault(req, []).append(f"dependency:{mod_id}")
                    expanded = True

    return active_modules, reasons


def bundle_kit(active_modules, output_dir, course_config=None, vendor_mode="cdn"):
    """Bundles kit.js and kit.css for the active modules and copies local vendor files if local mode."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    modules = load_module_descriptors()
    ordered_ids = [m for m in topological_sort(modules) if m in active_modules]

    # Collect CSS
    css_parts = [LAYER_HEADER]
    for mod_id in ordered_ids:
        mod = modules[mod_id]
        mod_dir = Path(mod["_dir"])
        for css_rel in mod.get("provides", {}).get("css", []):
            css_file = mod_dir / css_rel
            if css_file.exists():
                css_content = css_file.read_text(encoding="utf-8")
                css_parts.append(f"/* ---- Module: {mod_id} ({css_rel}) ---- */\n{css_content}\n")

        # Include themes if foundation
        if mod_id == "foundation":
            themes_dir = mod_dir / "themes"
            if themes_dir.exists():
                for tf in sorted(themes_dir.glob("*.css")):
                    t_content = tf.read_text(encoding="utf-8")
                    css_parts.append(f"/* ---- Foundation Theme: {tf.name} ---- */\n{t_content}\n")

    kit_css_path = output_path / "kit.css"
    kit_css_content = "\n".join(css_parts)
    kit_css_path.write_text(kit_css_content, encoding="utf-8", newline="\n")

    # Collect active vendor registry and offline copy
    active_vendors = {}
    vendor_hashes = {}
    for mod_id in ordered_ids:
        mod = modules[mod_id]
        for v in mod.get("vendor", []):
            vid = v.get("id")
            if vid and vid in UNIFIED_VENDORS:
                active_vendors[vid] = UNIFIED_VENDORS[vid]

    if vendor_mode == "local" and active_vendors:
        vendor_output_dir = output_path / "vendor"
        vendor_output_dir.mkdir(parents=True, exist_ok=True)
        pkg_map = {
            "plotly": "plotly.js-dist-min",
            "jsxgraph": "jsxgraph"
        }
        for vid in active_vendors:
            pkg_name = pkg_map.get(vid, vid)
            src_pkg = KIT_ROOT / "vendor" / pkg_name
            if not src_pkg.exists() or not any(src_pkg.iterdir()):
                if vid in ("plotly", "jsxgraph"):
                    raise ValueError(
                        f"Offline vendor package '{pkg_name}' for '{vid}' missing in kit/vendor/."
                    )
            else:
                dst_pkg = vendor_output_dir / pkg_name
                if dst_pkg.exists():
                    shutil.rmtree(dst_pkg)
                shutil.copytree(src_pkg, dst_pkg)
                for f in dst_pkg.rglob("*"):
                    if f.is_file():
                        rel = str(f.relative_to(output_path)).replace("\\", "/")
                        h = hashlib.sha256(f.read_bytes()).hexdigest()
                        vendor_hashes[rel] = f"sha256-{h}"

    # Collect JS
    config_json_str = json.dumps(course_config or {}, ensure_ascii=False)
    active_mods_str = json.dumps(ordered_ids, ensure_ascii=False)
    vendors_str = json.dumps(active_vendors, ensure_ascii=False)

    js_parts = [
        "/**\n * Course Kit v2 Bundled Runtime\n * Built by kit.py. Do not edit directly.\n */\n",
        '(function (global) {\n  "use strict";\n  var CourseKit = global.CourseKit = global.CourseKit || {};\n  global.kit = global.kit || CourseKit;\n',
        f'  CourseKit.__COURSE_CONFIG__ = {config_json_str};\n',
        f'  CourseKit.__ACTIVE_MODULES__ = {active_mods_str};\n',
        f'  CourseKit.VENDORS = {vendors_str};\n'
    ]

    for mod_id in ordered_ids:
        mod = modules[mod_id]
        mod_dir = Path(mod["_dir"])
        for js_rel in mod.get("provides", {}).get("js", []):
            js_file = mod_dir / js_rel
            if js_file.exists():
                js_content = js_file.read_text(encoding="utf-8")
                js_parts.append(f"\n  /* ---- Module: {mod_id} ({js_rel}) ---- */\n  (function () {{\n{js_content}\n  }})();\n")

    js_parts.append("\n})(typeof window !== 'undefined' ? window : globalThis);\n")

    kit_js_path = output_path / "kit.js"
    kit_js_content = "".join(js_parts)
    kit_js_path.write_text(kit_js_content, encoding="utf-8", newline="\n")

    # Compute hashes
    css_sha256 = hashlib.sha256(kit_css_content.encode("utf-8")).hexdigest()
    js_sha256 = hashlib.sha256(kit_js_content.encode("utf-8")).hexdigest()

    return {
        "kit.css": f"sha256-{css_sha256}",
        "kit.js": f"sha256-{js_sha256}"
    }, ordered_ids, vendor_hashes


def sync_course(course_dir):
    """Synchronizes course package: normalizes HTML, bundles kit, writes kit.lock.json."""
    cpath = Path(course_dir).resolve()
    if not cpath.exists():
        print(f"Error: Course directory {cpath} does not exist.", file=sys.stderr)
        return False

    manifest_file = KIT_ROOT / "kit.manifest.json"
    if not manifest_file.exists():
        manifest = build_manifest()
    else:
        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception:
            manifest = build_manifest()

    # Step 1: Normalize lesson HTML
    lessons_dir = cpath / "lessons"
    if lessons_dir.exists():
        for hf in lessons_dir.glob("*.html"):
            try:
                raw_html = hf.read_text(encoding="utf-8")
                norm_html, headings = normalize_html_content(raw_html)
                if norm_html != raw_html:
                    hf.write_text(norm_html, encoding="utf-8", newline="\n")
                    print(f"Normalized {hf.name} ({len(headings)} headings).")
            except Exception as e:
                print(f"Warning: Failed to normalize {hf}: {e}", file=sys.stderr)

    # Step 2: Ensure assets/course/ scaffolding
    course_assets = cpath / "assets" / "course"
    course_assets.mkdir(parents=True, exist_ok=True)

    config_file = course_assets / "config.json"
    if not config_file.exists():
        default_config = {
            "theme": "course",
            "vendor": {"mode": "cdn"},
            "code": {"themes": {"light": "github", "dark": "github-dark"}},
            "modules": []
        }
        config_file.write_text(json.dumps(default_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        course_config = default_config
    else:
        try:
            course_config = json.loads(config_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error reading {config_file}: {e}", file=sys.stderr)
            return False

    theme_file = course_assets / "theme.css"
    if not theme_file.exists():
        default_theme_css = (
            "@layer course {\n"
            "  /* 课程专用样式与 token 覆盖写入本层 */\n"
            "}\n"
        )
        theme_file.write_text(default_theme_css, encoding="utf-8", newline="\n")

    vendor_mode = course_config.get("vendor", {}).get("mode", "cdn")

    # Step 3: Detect active modules and bundle kit
    try:
        active_modules, reasons = detect_modules_for_course(cpath, manifest)
    except Exception as e:
        print(f"Error detecting modules for course: {e}", file=sys.stderr)
        return False

    kit_output_dir = cpath / "assets" / "kit"
    try:
        files_hashes, ordered_ids, vendor_hashes = bundle_kit(
            active_modules, kit_output_dir, course_config=course_config, vendor_mode=vendor_mode
        )
    except Exception as e:
        print(f"Error bundling kit: {e}", file=sys.stderr)
        return False

    # Step 4: Write kit.lock.json
    lock_data = {
        "kit": KIT_VERSION,
        "modules": {m: manifest["modules"][m]["version"] for m in ordered_ids if m in manifest["modules"]},
        "reasons": reasons,
        "files": files_hashes,
        "vendor": vendor_hashes
    }
    lock_file = kit_output_dir / "kit.lock.json"
    lock_file.write_text(json.dumps(lock_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    print(f"Sync complete for {cpath.name}: {len(ordered_ids)} modules bundled into assets/kit/.")
    return True


def check_course(course_dir):
    """Verifies kit.lock.json, required outputs, module dependency closure, and file hashes."""
    cpath = Path(course_dir).resolve()
    kit_dir = cpath / "assets" / "kit"
    lock_file = kit_dir / "kit.lock.json"

    if not lock_file.exists():
        print(f"Error: {lock_file} not found. Run 'kit sync' first.", file=sys.stderr)
        return False

    try:
        lock_data = json.loads(lock_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error reading {lock_file}: {e}", file=sys.stderr)
        return False

    if not isinstance(lock_data, dict):
        print(f"Error: {lock_file} must be a JSON object.", file=sys.stderr)
        return False

    if not lock_data.get("kit"):
        print(f"Error: {lock_file} is missing 'kit' version.", file=sys.stderr)
        return False

    modules_lock = lock_data.get("modules", {})
    if not isinstance(modules_lock, dict) or not modules_lock:
        print(f"Error: {lock_file} must have a non-empty 'modules' object.", file=sys.stderr)
        return False

    files_lock = lock_data.get("files", {})
    if not isinstance(files_lock, dict) or not files_lock:
        print(f"Error: {lock_file} must have a non-empty 'files' object.", file=sys.stderr)
        return False

    for req_f in ("kit.css", "kit.js"):
        if req_f not in files_lock:
            print(f"Error: Required bundled output '{req_f}' missing from {lock_file}.", file=sys.stderr)
            return False

    # Check dependency closure against manifest
    manifest_file = KIT_ROOT / "kit.manifest.json"
    manifest_modules = {}
    if manifest_file.exists():
        try:
            m_data = json.loads(manifest_file.read_text(encoding="utf-8"))
            manifest_modules = m_data.get("modules", {})
        except Exception:
            pass

    for mod_id in modules_lock:
        desc = manifest_modules.get(mod_id, {})
        for req in desc.get("requires", []):
            if req not in modules_lock:
                print(
                    f"Error: Module '{mod_id}' requires '{req}', which is missing from {lock_file}!",
                    file=sys.stderr
                )
                return False

    all_ok = True

    # Verify bundle file hashes
    for filename, expected_hash in files_lock.items():
        target_file = kit_dir / filename
        if not target_file.exists():
            print(f"Error: Expected file {filename} is missing in assets/kit/", file=sys.stderr)
            all_ok = False
            continue

        content = target_file.read_text(encoding="utf-8")
        actual_hash = f"sha256-{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
        if actual_hash != expected_hash:
            print(
                f"Error: Hash mismatch for assets/kit/{filename}!\n"
                f"  Expected: {expected_hash}\n"
                f"  Actual:   {actual_hash}\n"
                f"  提示：assets/kit/ 是生成物，请勿手改！修改样式请使用 assets/course/theme.css，配置改 assets/course/config.json。\n"
                f"  运行 'kit sync' 重新生成产物。",
                file=sys.stderr
            )
            all_ok = False

    # Verify vendor file hashes if any
    vendor_lock = lock_data.get("vendor", {})
    if isinstance(vendor_lock, dict):
        for rel_path, expected_hash in vendor_lock.items():
            target_file = kit_dir / rel_path
            if not target_file.exists():
                print(f"Error: Expected vendor file {rel_path} is missing in assets/kit/", file=sys.stderr)
                all_ok = False
                continue
            actual_hash = f"sha256-{hashlib.sha256(target_file.read_bytes()).hexdigest()}"
            if actual_hash != expected_hash:
                print(f"Error: Vendor hash mismatch for assets/kit/{rel_path}!", file=sys.stderr)
                all_ok = False

    if all_ok:
        print(f"Kit check PASSED for {cpath.name}: all hashes and modules verified.")
    return all_ok


def add_module(course_dir, module_id):
    """Registers an opt-in module and triggers sync."""
    cpath = Path(course_dir).resolve()
    config_file = cpath / "assets" / "course" / "config.json"
    if not config_file.exists():
        cfg = {"modules": []}
    else:
        try:
            cfg = json.loads(config_file.read_text(encoding="utf-8"))
        except Exception:
            cfg = {"modules": []}

    mods = cfg.setdefault("modules", [])
    if module_id not in mods:
        mods.append(module_id)
        config_file.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"Added {module_id} to {config_file.name}.")

    return sync_course(course_dir)


def list_modules():
    """Lists all available modules."""
    manifest_file = KIT_ROOT / "kit.manifest.json"
    if not manifest_file.exists():
        manifest = build_manifest()
    else:
        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception:
            manifest = build_manifest()

    modules = manifest.get("modules", {})
    print(f"\nCourse Kit v{KIT_VERSION} Modules ({len(modules)} total):\n")
    print(f"{'Module ID':<26} {'Layer':<6} {'Presence':<8} {'Requires'}")
    print("-" * 75)
    for mid, desc in sorted(modules.items(), key=lambda x: (x[1].get("layer", 0), x[0])):
        layer = str(desc.get("layer", 0))
        pres = desc.get("presence", "core")
        reqs = ", ".join(desc.get("requires", [])) or "-"
        print(f"{mid:<26} {layer:<6} {pres:<8} {reqs}")
    print()


def main():
    parser = argparse.ArgumentParser(prog="kit", description="Course Kit v2 Build & CLI Toolchain")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # build
    subparsers.add_parser("build", help="Builds kit manifest and updates catalog")

    # sync
    sync_p = subparsers.add_parser("sync", help="Syncs course assets and regenerates bundle")
    sync_p.add_argument("course_dir", help="Path to course directory")

    # check
    check_p = subparsers.add_parser("check", help="Verifies kit lock and file hashes")
    check_p.add_argument("course_dir", help="Path to course directory")

    # add
    add_p = subparsers.add_parser("add", help="Registers an opt-in module and syncs")
    add_p.add_argument("course_dir", help="Path to course directory")
    add_p.add_argument("module_id", help="Module ID to add (e.g. viz.kinds.chart)")

    # list
    subparsers.add_parser("list", help="Lists all available kit modules")

    args = parser.parse_args()

    if args.command == "build":
        build_manifest()
    elif args.command == "sync":
        ok = sync_course(args.course_dir)
        sys.exit(0 if ok else 1)
    elif args.command == "check":
        ok = check_course(args.course_dir)
        sys.exit(0 if ok else 1)
    elif args.command == "add":
        ok = add_module(args.course_dir, args.module_id)
        sys.exit(0 if ok else 1)
    elif args.command == "list":
        list_modules()


if __name__ == "__main__":
    main()
