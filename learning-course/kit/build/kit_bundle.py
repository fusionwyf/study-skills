#!/usr/bin/env python3
"""Module descriptors, detection, bundling and sync (kit build/sync/add)."""

import sys
from pathlib import Path

_BUILD_DIR = Path(__file__).resolve().parent
for _p in (str(_BUILD_DIR), str(_BUILD_DIR.parents[1] / "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from html.parser import HTMLParser
import course_layout
from kit_common import KIT_ROOT, KIT_VERSION, LAYER_HEADER, LAYER_ORDER, UNIFIED_VENDORS

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

VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
}

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

        tag_lower = tag.lower()
        if tag_lower not in VOID_ELEMENTS:
            if tag_lower in ("pre", "code", "script", "style") or "data-math-ignore" in attrs_dict:
                self.ignore_math_depth += 1
            self.stack.append({"tag": tag_lower, "attrs": attrs_dict, "classes": classes})

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
        tag_lower = tag.lower()
        if tag_lower in VOID_ELEMENTS:
            return
        idx = -1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag_lower:
                idx = i
                break
        if idx != -1:
            while len(self.stack) > idx:
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
    if not isinstance(layer, int) or layer < 0 or layer > 5:
        raise ValueError(f"Module {mod_id}: invalid layer {layer}; must be integer 0..5 (L0 core .. L5 viz)")
    presence = data.get("presence")
    if presence not in ("core", "auto", "opt-in", "serve"):
        raise ValueError(f"Module {mod_id}: invalid presence '{presence}'; must be 'core', 'auto', 'opt-in', or 'serve'")
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

    # Every module must reach the core runtime directly or transitively
    # (assets.md descriptor contract); e.g. viz.kinds.* reach it via viz.core.
    reach_memo = {}

    def reaches_core(mod_id, trail=frozenset()):
        if mod_id in reach_memo:
            return reach_memo[mod_id]
        if mod_id == "core":
            return True
        if mod_id in trail:
            return False
        reqs = modules.get(mod_id, {}).get("requires", [])
        result = any(reaches_core(req, trail | {mod_id}) for req in reqs)
        reach_memo[mod_id] = result
        return result

    for mod_id in modules:
        if not reaches_core(mod_id):
            raise ValueError(f"Module '{mod_id}' must depend on 'core' directly or transitively")

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
    foundation_theme_registry()  # fail the build loudly on broken theme headers
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
    Also migrates the legacy data-copy-feedback contract to data-submit-feedback
    (capture is now click-driven; see learning.records).
    Returns (updated_html, headings_list).
    """
    html_text = html_text.replace("data-copy-feedback-status", "data-submit-feedback-status")
    html_text = html_text.replace("data-copy-feedback", "data-submit-feedback")
    html_text = re.sub(
        r'(<button[^>]*data-submit-feedback[^>]*>)\s*复制学习记录\s*(</button\s*>)',
        r"\1复制并提交学习记录\2",
        html_text,
    )
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
        attrs_clean = attrs.strip()
        attr_part = f" {attrs_clean}" if attrs_clean else ""
        return f"<{tag}{attr_part}>{inner}</{tag}>"

    # Match h2 and h3
    pattern = re.compile(r"<(h[23])(\s+[^>]*)?>(.*?)</\1>", re.DOTALL | re.IGNORECASE)
    normalized = pattern.sub(replace_heading, html_text)

    # Step 2: Build static TOC fallback
    if headings:
        tree = []
        cur_h2 = None
        for h in headings:
            if h["tag"] == "h2":
                cur_h2 = {"id": h["id"], "title": h["title"], "children": []}
                tree.append(cur_h2)
            else:
                if cur_h2 is not None:
                    cur_h2["children"].append(h)
                else:
                    cur_h2 = {"id": h["id"], "title": h["title"], "children": []}
                    tree.append(cur_h2)

        toc_items = []
        for node in tree:
            has_ch = bool(node["children"])
            cls = "has-children is-collapsed" if has_ch else "no-children"
            chevron = (
                '<button type="button" class="toc-toggle kit-toc__toggle" aria-label="展开子目录" title="展开子目录" aria-expanded="false">'
                '<svg class="kit-toc__chevron" viewBox="0 0 16 16" width="9" height="9" aria-hidden="true">'
                '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
                '</svg></button>'
            ) if has_ch else '<span class="kit-toc__spacer" aria-hidden="true"></span>'
            toc_items.append(f'      <li class="toc-item is-h2 {cls}">')
            toc_items.append(f'        <div class="toc-row">{chevron}<a class="toc-link is-h2-link" href="#{node["id"]}">{node["title"]}</a></div>')
            if has_ch:
                toc_items.append('        <ul class="toc-sublist">')
                for ch in node["children"]:
                    toc_items.append(f'          <li class="toc-item is-h3"><a class="toc-link is-h3-link" href="#{ch["id"]}">{ch["title"]}</a></li>')
                toc_items.append('        </ul>')
            toc_items.append('      </li>')

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

KIT_THEME_HEADER_RE = re.compile(r"/\*\s*@kit-theme\s+(.*?)\*/", re.S)

KIT_THEME_META_RE = re.compile(r'([a-zA-Z]+)\s*=\s*"([^"]*)"')

def parse_kit_theme_header(css_text):
    """Parses the mandatory `/* @kit-theme ... */` header of a custom theme CSS."""
    match = KIT_THEME_HEADER_RE.search(css_text[:2000])
    if not match:
        return None
    meta = dict(KIT_THEME_META_RE.findall(match.group(1)))
    name = meta.get("name", "").strip()
    if not name:
        return None
    scheme = meta.get("scheme", "light").strip().lower()
    if scheme not in ("light", "dark"):
        scheme = "light"
    # Font specs keep "pkg:400,700" intact; multiple specs are ';' separated.
    fonts = [part.strip() for part in re.split(r";", meta.get("fonts", "")) if part.strip()]
    parsed = {
        "name": name,
        "label": meta.get("label", "").strip() or name,
        "scheme": scheme,
        "fonts": fonts,
    }
    code = meta.get("code", "").strip().lower()
    if code in ("light", "dark"):
        parsed["code"] = code
    return parsed

def foundation_theme_registry():
    """Parses @kit-theme headers of kit/foundation/themes/*.css into a registry.

    The single source of built-in preset metadata: bundle_kit injects it as
    CourseKit.__THEMES__ for theme-engine.js. Raises (failing sync/build
    loudly) when a foundation theme lacks a valid header or its name does
    not match the file stem.
    """
    registry = {}
    themes_dir = KIT_ROOT / "foundation" / "themes"
    for theme_file in sorted(themes_dir.glob("*.css")):
        meta = parse_kit_theme_header(theme_file.read_text(encoding="utf-8"))
        if meta is None:
            raise ValueError(
                f"kit/foundation/themes/{theme_file.name}: missing or invalid "
                '`/* @kit-theme name="..." label="..." scheme="light|dark" ... */` header'
            )
        if meta["name"] != theme_file.stem:
            raise ValueError(
                f"kit/foundation/themes/{theme_file.name}: theme name '{meta['name']}' must match the file stem"
            )
        entry = {"label": meta["label"], "scheme": meta["scheme"]}
        if meta.get("code"):
            entry["code"] = meta["code"]
        if meta.get("fonts"):
            entry["fonts"] = meta["fonts"]
        registry[meta["name"]] = entry
    return registry

def discover_course_themes(course_dir):
    """Scans <course>/assets/course/themes/*.css for @kit-theme declarations.

    Returns a list of {"meta": parsed-header, "file": Path}; raises when a CSS
    file there lacks a valid header so broken custom themes fail sync loudly.
    """
    themes_dir = Path(course_dir) / "assets" / "course" / "themes"
    found = []
    if not themes_dir.is_dir():
        return found
    for theme_file in sorted(themes_dir.glob("*.css")):
        meta = parse_kit_theme_header(theme_file.read_text(encoding="utf-8"))
        if meta is None:
            raise ValueError(
                f"assets/course/themes/{theme_file.name}: missing or invalid "
                '`/* @kit-theme name="..." label="..." scheme="light|dark" ... */` header'
            )
        found.append({"meta": meta, "file": theme_file})
    return found

def merge_course_themes_into_config(course_config, discovered):
    """Injects discovered custom themes into config.json fields and returns them.

    `customThemes` maps name -> engine metadata (consumed by theme-engine.js);
    every name is also appended to the switchable `themes` list.
    """
    if not discovered:
        return course_config
    custom = course_config.get("customThemes") if isinstance(course_config.get("customThemes"), dict) else {}
    themes_list = course_config.get("themes") if isinstance(course_config.get("themes"), list) else []
    for entry in discovered:
        meta = entry["meta"]
        custom[meta["name"]] = {
            "label": meta["label"],
            "scheme": meta["scheme"],
            **({"code": meta["code"]} if meta.get("code") else {}),
            **({"fonts": meta["fonts"]} if meta.get("fonts") else {}),
        }
        if meta["name"] not in themes_list:
            themes_list.append(meta["name"])
    course_config["customThemes"] = custom
    course_config["themes"] = themes_list
    return course_config

def load_course_extensions(course_dir, course_config=None):
    """Loads course extension declarations from config.json and/or extensions.json."""
    extensions = []
    if course_config and "extensions" in course_config and isinstance(course_config["extensions"], list):
        extensions.extend(course_config["extensions"])
    if course_dir:
        cpath = Path(course_dir)
        cfg_file = cpath / "assets" / "course" / "config.json"
        if not course_config and cfg_file.exists():
            try:
                cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
                if isinstance(cfg.get("extensions"), list):
                    extensions.extend(cfg["extensions"])
            except Exception:
                pass
        ext_file = cpath / "assets" / "course" / "extensions.json"
        if ext_file.exists():
            try:
                extra = json.loads(ext_file.read_text(encoding="utf-8"))
                if isinstance(extra, list):
                    extensions.extend(extra)
            except Exception as e:
                raise ValueError(f"Failed to read extensions.json: {e}")
    return extensions

def validate_extension_entry(ext, modules_desc=None):
    """Shared shape/contract check for one course-extension declaration.

    modules_desc is the module library to validate `requires` against; pass
    None to check shape only (e.g. check_course validates against the lock).
    """
    if not isinstance(ext, dict):
        raise ValueError(f"Invalid extension entry: {ext}")
    ext_id = ext.get("id")
    if not ext_id:
        raise ValueError(f"Extension declaration must contain an 'id': {ext}")
    if modules_desc is None:
        return
    for req in ext.get("requires", []):
        if req not in modules_desc:
            raise ValueError(
                f"Course extension '{ext_id}' requires unknown module '{req}'. "
                f"Run 'kit list' to view available modules."
            )
        if modules_desc[req].get("presence") == "serve":
            raise ValueError(f"Course extension '{ext_id}' requires serve-hosted module '{req}', which cannot be bundled.")

def expand_requirements(active_set, modules_desc, on_dependency=None):
    """Expand a module set to its transitive requires closure, in place."""
    expanded = True
    while expanded:
        expanded = False
        for mod_id in list(active_set):
            for req in modules_desc.get(mod_id, {}).get("requires", []):
                if req in modules_desc and req not in active_set:
                    active_set.add(req)
                    if on_dependency:
                        on_dependency(req, mod_id)
                    expanded = True

def detect_modules_for_course(course_dir, manifest, staged_html=None):
    """Scans lesson HTML files and identifies active modules, recording inclusion reasons."""
    html_files = [entry["path"] for entry in course_layout.iter_lessons(Path(course_dir))]

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
    modules_desc = manifest.get("modules", manifest) if isinstance(manifest, dict) else {}

    # Unknown opt-in modules must fail explicitly
    for mod_id in opt_in_modules:
        if mod_id not in modules_desc:
            raise ValueError(
                f"Unknown opt-in module '{mod_id}' specified in assets/course/config.json. "
                f"Run 'kit list' to view available modules."
            )
        if modules_desc[mod_id].get("presence") == "serve":
            raise ValueError(
                f"Module '{mod_id}' is serve-hosted (kit.py serve) and cannot be bundled into a course; "
                f"remove it from assets/course/config.json modules."
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

    # 3. Add modules required by course extensions
    extensions = load_course_extensions(course_dir)
    for ext in extensions:
        validate_extension_entry(ext, modules_desc)
        ext_id = ext.get("id")
        for req in ext.get("requires", []):
            active_modules.add(req)
            reasons.setdefault(req, []).append(f"extension:{ext_id}")

    # 4. Detect auto modules from lesson HTMLs
    auto_rules = {}
    for mod_id, desc in modules_desc.items():
        if desc.get("presence") == "auto":
            detect = desc.get("detect", {})
            parsed_sels = [parse_selector(s) for s in detect.get("selectors", [])]
            regexes = [re.compile(r) for r in detect.get("regex", [])]
            auto_rules[mod_id] = {"selectors": parsed_sels, "regexes": regexes}

    if staged_html is None:
        staged_html = {}

    for hf in html_files:
        try:
            content = staged_html[hf] if hf in staged_html else hf.read_text(encoding="utf-8")
            detector = HTMLModuleDetector(auto_rules)
            detector.feed(content)
            for mod_id, match_reason in detector.matched.items():
                active_modules.add(mod_id)
                reasons.setdefault(mod_id, []).append(f"auto:{hf.name}:{match_reason}")
        except Exception as e:
            print(f"Warning: Failed scanning {hf.name}: {e}", file=sys.stderr)

    # 5. Resolve transitive requirements
    expand_requirements(
        active_modules, modules_desc,
        on_dependency=lambda req, via: reasons.setdefault(req, []).append(f"dependency:{via}"),
    )

    return active_modules, reasons

def bundle_kit(active_modules, output_dir, course_config=None, vendor_mode="cdn", course_dir=None, course_themes=None):
    """Bundles kit.js and kit.css for the active modules and copies local vendor files if local mode."""
    output_path = Path(output_dir)

    modules = load_module_descriptors()
    active_set = set(active_modules)

    # Incorporate extension requirements and their transitive dependencies into active_set
    extensions = load_course_extensions(course_dir, course_config)
    for ext in extensions:
        validate_extension_entry(ext, modules)
        for req in ext.get("requires", []):
            active_set.add(req)

    expand_requirements(active_set, modules)

    ordered_ids = [m for m in topological_sort(modules) if m in active_set]

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

        # Include themes if foundation (skip files already bundled via provides.css)
        if mod_id == "foundation":
            themes_dir = mod_dir / "themes"
            if themes_dir.exists():
                provided = {(mod_dir / rel).resolve() for rel in mod.get("provides", {}).get("css", [])}
                for tf in sorted(themes_dir.glob("*.css")):
                    if tf.resolve() in provided:
                        continue
                    t_content = tf.read_text(encoding="utf-8")
                    css_parts.append(f"/* ---- Foundation Theme: {tf.name} ---- */\n{t_content}\n")

    # Validate and append course extensions
    ext_module_ids = []
    for ext in extensions:
        ext_id = ext.get("id")
        for req in ext.get("requires", []):
            if req not in active_set:
                raise ValueError(f"Course extension '{ext_id}' requires module '{req}', which is missing from active modules.")
        if "css" in ext and course_dir:
            c_file = Path(course_dir) / "assets" / "course" / ext["css"]
            if not c_file.exists():
                raise ValueError(f"Course extension '{ext_id}' specifies CSS file '{ext['css']}' that does not exist in {Path(course_dir) / 'assets' / 'course'}.")
            css_parts.append(f"/* ---- Course Extension CSS: {ext_id} ---- */\n{c_file.read_text(encoding='utf-8')}\n")
        if "js" in ext and course_dir:
            j_file = Path(course_dir) / "assets" / "course" / ext["js"]
            if not j_file.exists():
                raise ValueError(f"Course extension '{ext_id}' specifies JS file '{ext['js']}' that does not exist in {Path(course_dir) / 'assets' / 'course'}.")
        mod_name = ext.get("module", ext_id)
        if mod_name not in ext_module_ids:
            ext_module_ids.append(mod_name)

    # Append course-level custom themes (single-file, offline-friendly)
    for entry in course_themes or []:
        css_content = entry["file"].read_text(encoding="utf-8")
        css_parts.append(f"/* ---- Course Theme: {entry['meta']['name']} ({entry['file'].name}) ---- */\n{css_content}\n")

    kit_css_content = "\n".join(css_parts)

    # Collect active vendor registry
    active_vendors = {}
    for mod_id in ordered_ids:
        mod = modules[mod_id]
        for v in mod.get("vendor", []):
            vid = v.get("id")
            if vid and vid in UNIFIED_VENDORS:
                active_vendors[vid] = UNIFIED_VENDORS[vid]

    # Pre-validation for local offline mode BEFORE touching output files
    pkg_map = {
        "plotly": "plotly.js-dist-min",
        "jsxgraph": "jsxgraph",
        "hljs": "hljs",
        "katex": "katex",
        "mermaid": "mermaid",
        "plot": "observable-plot",
    }
    if vendor_mode == "local" and active_vendors:
        for vid in active_vendors:
            pkg_name = pkg_map.get(vid, vid)
            src_pkg = KIT_ROOT / "vendor" / pkg_name
            if vid in ("plotly", "jsxgraph", "plot"):
                if not src_pkg.exists() or not any(src_pkg.iterdir()):
                    raise ValueError(
                        f"Offline vendor package '{pkg_name}' for '{vid}' missing in kit/vendor/."
                    )

    # Collect JS
    active_runtime_ids = list(ordered_ids)
    for em in ext_module_ids:
        if em not in active_runtime_ids:
            active_runtime_ids.append(em)

    # Which vendors actually have offline packages is decided here (single
    # source of truth: kit/vendor/); the runtime reads kit.__LOCAL_VENDORS__
    # instead of hardcoding the list in loader.js.
    local_ready = sorted(
        vid for vid in active_vendors
        if (KIT_ROOT / "vendor" / pkg_map.get(vid, vid)).is_dir()
        and any((KIT_ROOT / "vendor" / pkg_map.get(vid, vid)).iterdir())
    )

    config_json_str = json.dumps(course_config or {}, ensure_ascii=False)
    active_mods_str = json.dumps(active_runtime_ids, ensure_ascii=False)
    vendors_str = json.dumps(active_vendors, ensure_ascii=False)
    extensions_str = json.dumps(extensions, ensure_ascii=False)
    themes_registry_str = json.dumps(foundation_theme_registry(), ensure_ascii=False)

    js_parts = [
        "/**\n * Course Kit v2 Bundled Runtime\n * Built by kit.py. Do not edit directly.\n */\n",
        '(function (global) {\n  "use strict";\n  var CourseKit = global.CourseKit = global.CourseKit || {};\n  global.kit = global.kit || CourseKit;\n',
        f'  CourseKit.__COURSE_CONFIG__ = {config_json_str};\n',
        f'  CourseKit.__ACTIVE_MODULES__ = {active_mods_str};\n',
        f'  CourseKit.VENDORS = {vendors_str};\n',
        f'  CourseKit.__LOCAL_VENDORS__ = {json.dumps(local_ready)};\n',
        f'  CourseKit.__THEMES__ = {themes_registry_str};\n',
        f'  CourseKit.__EXTENSIONS__ = {extensions_str};\n'
    ]

    for mod_id in ordered_ids:
        mod = modules[mod_id]
        mod_dir = Path(mod["_dir"])
        for js_rel in mod.get("provides", {}).get("js", []):
            js_file = mod_dir / js_rel
            if js_file.exists():
                js_content = js_file.read_text(encoding="utf-8")
                js_parts.append(f"\n  /* ---- Module: {mod_id} ({js_rel}) ---- */\n  (function () {{\n{js_content}\n  }})();\n")

    for ext in extensions:
        ext_id = ext.get("id")
        if "js" in ext and course_dir:
            j_file = Path(course_dir) / "assets" / "course" / ext["js"]
            js_parts.append(f"\n  /* ---- Course Extension: {ext_id} ---- */\n  (function () {{\n{j_file.read_text(encoding='utf-8')}\n  }})();\n")

    js_parts.append(
        "\n  /* ---- Bundle Initialization ---- */\n"
        "  if (CourseKit.initAll && typeof document !== 'undefined') {\n"
        "    if (document.readyState === 'loading') {\n"
        "      document.addEventListener('DOMContentLoaded', CourseKit.initAll);\n"
        "    } else {\n"
        "      CourseKit.initAll();\n"
        "    }\n"
        "  }\n"
    )

    js_parts.append("\n})(typeof window !== 'undefined' ? window : globalThis);\n")
    kit_js_content = "".join(js_parts)

    # All validations passed; write outputs atomically
    output_path.mkdir(parents=True, exist_ok=True)
    kit_css_path = output_path / "kit.css"
    kit_css_path.write_text(kit_css_content, encoding="utf-8", newline="\n")

    kit_js_path = output_path / "kit.js"
    kit_js_path.write_text(kit_js_content, encoding="utf-8", newline="\n")

    vendor_hashes = {}
    if vendor_mode == "local" and active_vendors:
        vendor_output_dir = output_path / "vendor"
        vendor_output_dir.mkdir(parents=True, exist_ok=True)
        for vid in active_vendors:
            pkg_name = pkg_map.get(vid, vid)
            src_pkg = KIT_ROOT / "vendor" / pkg_name
            if src_pkg.exists() and any(src_pkg.iterdir()):
                dst_pkg = vendor_output_dir / pkg_name
                if dst_pkg.exists():
                    shutil.rmtree(dst_pkg)
                shutil.copytree(src_pkg, dst_pkg)
                for f in dst_pkg.rglob("*"):
                    if f.is_file():
                        rel = str(f.relative_to(output_path)).replace("\\", "/")
                        h = hashlib.sha256(f.read_bytes()).hexdigest()
                        vendor_hashes[rel] = f"sha256-{h}"

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

    # Step 1: Pre-normalize lesson HTML (staged in memory to protect courseware if sync fails)
    staged_html = {}
    raw_html_bytes = {}
    for entry in course_layout.iter_lessons(cpath):
        hf = entry["path"]
        try:
            b = hf.read_bytes()
            raw_html_bytes[hf] = b
            raw_html = b.decode("utf-8")
            norm_html, headings = normalize_html_content(raw_html)
            if norm_html != raw_html:
                staged_html[hf] = norm_html
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

    # Step 2b: Discover course-level custom themes (assets/course/themes/*.css)
    (course_assets / "themes").mkdir(parents=True, exist_ok=True)
    try:
        discovered_themes = discover_course_themes(cpath)
    except ValueError as theme_err:
        print(f"Error: {theme_err}", file=sys.stderr)
        return False
    if discovered_themes:
        config_before = json.dumps(course_config, ensure_ascii=False, sort_keys=True)
        merge_course_themes_into_config(course_config, discovered_themes)
        if config_before != json.dumps(course_config, ensure_ascii=False, sort_keys=True):
            config_file.write_text(
                json.dumps(course_config, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8", newline="\n",
            )
        names = ", ".join(entry["meta"]["name"] for entry in discovered_themes)
        print(f"  -> Custom themes discovered: {names}")

    vendor_mode = course_config.get("vendor", {}).get("mode", "cdn")
    if vendor_mode == "local":
        missing_offline = [
            name for name in ("hljs", "katex", "mermaid")
            if not (KIT_ROOT / "vendor" / name).is_dir()
        ]
        if missing_offline:
            print(
                "WARNING: vendor.mode=local but kit/vendor/ lacks offline packages for: "
                + ", ".join(missing_offline)
                + "。它们仍会走 CDN（真正离线打开时代码高亮/公式/流程图不可用），"
                "请补齐 kit/vendor/ 或改回 cdn 模式。",
                file=sys.stderr,
            )

    # Step 3: Detect active modules and bundle kit
    try:
        active_modules, reasons = detect_modules_for_course(cpath, manifest, staged_html=staged_html)
    except Exception as e:
        print(f"Error detecting modules for course: {e}", file=sys.stderr)
        return False

    kit_output_dir = cpath / "assets" / "kit"
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_kit_dir = Path(tmp_dir) / "kit"
        try:
            files_hashes, ordered_ids, vendor_hashes = bundle_kit(
                active_modules, tmp_kit_dir, course_config=course_config, vendor_mode=vendor_mode,
                course_dir=cpath, course_themes=discovered_themes,
            )
        except Exception as e:
            print(f"Error bundling kit: {e}", file=sys.stderr)
            return False

        # Step 4: Write kit.lock.json in tmp_kit_dir
        lock_data = {
            "kit": KIT_VERSION,
            "modules": {m: manifest["modules"][m]["version"] for m in ordered_ids if m in manifest["modules"]},
            "reasons": reasons,
            "files": files_hashes,
            "vendor": vendor_hashes
        }
        lock_file = tmp_kit_dir / "kit.lock.json"
        lock_file.write_text(json.dumps(lock_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

        # Step 5: Atomic replacement with rollback protecting both courseware and kit
        backup_dir = Path(tmp_dir) / "backup"
        had_previous = kit_output_dir.exists()
        if had_previous:
            shutil.copytree(kit_output_dir, backup_dir)

        written_html = set()
        staged_tmp_files = []
        try:
            # Commit staged HTML files via atomic temp replacement
            for hf, content in staged_html.items():
                tmp_hf = hf.with_name(f".tmp_{hf.stem}_{os.getpid()}_{uuid.uuid4().hex[:6]}.html")
                staged_tmp_files.append(tmp_hf)
                tmp_hf.write_text(content, encoding="utf-8", newline="\n")
                os.replace(tmp_hf, hf)
                written_html.add(hf)
                print(f"Normalized {hf.name}.")

            # Commit kit files
            if kit_output_dir.exists():
                shutil.rmtree(kit_output_dir)
            shutil.copytree(tmp_kit_dir, kit_output_dir)
        except Exception as swap_err:
            print(f"Error committing kit files: {swap_err}. Rolling back...", file=sys.stderr)
            # Clean up any leftover temp files
            for tf in staged_tmp_files:
                if tf.exists():
                    try:
                        tf.unlink()
                    except Exception:
                        pass
            # Rollback HTML files from exact raw bytes
            for hf, orig_bytes in raw_html_bytes.items():
                if hf in staged_html:
                    try:
                        tmp_restore = hf.with_name(f".tmp_rollback_{hf.stem}_{os.getpid()}.html")
                        tmp_restore.write_bytes(orig_bytes)
                        os.replace(tmp_restore, hf)
                    except Exception:
                        try:
                            hf.write_bytes(orig_bytes)
                        except Exception:
                            pass
            # Rollback Kit files
            if had_previous and backup_dir.exists():
                if kit_output_dir.exists():
                    shutil.rmtree(kit_output_dir)
                shutil.copytree(backup_dir, kit_output_dir)
            return False

    # Regenerate nav.json so sidebar reflects current lessons + records
    scripts_dir = KIT_ROOT.parent / "scripts"
    build_index = scripts_dir / "build_index.py"
    if build_index.exists():
        try:
            subprocess.run(
                [sys.executable, str(build_index), str(cpath), "--nav-only", "--nav"],
                check=True, capture_output=True, text=True,
                encoding="utf-8", errors="replace",
            )
            print(f"  -> nav.json regenerated from records.")
        except subprocess.CalledProcessError as e:
            print(f"  Warning: build_index.py --nav failed: {e.stderr.strip()}", file=sys.stderr)

    print(f"Sync complete for {cpath.name}: {len(ordered_ids)} modules bundled into assets/kit/.")
    return True

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
