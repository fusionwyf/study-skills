#!/usr/bin/env python3
"""Lock/hash verification for synced course packages (kit check)."""

import sys
from pathlib import Path

_BUILD_DIR = Path(__file__).resolve().parent
for _p in (str(_BUILD_DIR), str(_BUILD_DIR.parents[1] / "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import hashlib
import json
from kit_common import KIT_ROOT
from kit_bundle import detect_modules_for_course, validate_extension_entry

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

    manifest_file = KIT_ROOT / "kit.manifest.json"
    manifest_data = {}
    manifest_modules = {}
    if manifest_file.exists():
        try:
            manifest_data = json.loads(manifest_file.read_text(encoding="utf-8"))
            manifest_modules = manifest_data.get("modules", {})
        except Exception:
            pass

    for mod_id in modules_lock:
        if mod_id not in manifest_modules:
            print(
                f"Error: Unknown module '{mod_id}' in {lock_file} not found in kit.manifest.json!",
                file=sys.stderr
            )
            return False
        desc = manifest_modules[mod_id]
        for req in desc.get("requires", []):
            if req not in modules_lock:
                print(
                    f"Error: Module '{mod_id}' requires '{req}', which is missing from {lock_file}!",
                    file=sys.stderr
                )
                return False

    # Check course extensions if declared
    course_cfg = cpath / "assets" / "course" / "config.json"
    chk_extensions = []
    if course_cfg.exists():
        try:
            c_data = json.loads(course_cfg.read_text(encoding="utf-8"))
            if isinstance(c_data.get("extensions"), list):
                chk_extensions.extend(c_data["extensions"])
        except Exception:
            pass
    course_exts = cpath / "assets" / "course" / "extensions.json"
    if course_exts.exists():
        try:
            e_data = json.loads(course_exts.read_text(encoding="utf-8"))
            if isinstance(e_data, list):
                chk_extensions.extend(e_data)
        except Exception:
            pass

    for ext in chk_extensions:
        try:
            validate_extension_entry(ext)
        except ValueError as ext_err:
            print(f"Error: {ext_err}", file=sys.stderr)
            return False
        ext_id = ext["id"]
        if "js" in ext:
            if not (cpath / "assets" / "course" / ext["js"]).exists():
                print(f"Error: Declared extension '{ext_id}' JS file '{ext['js']}' is missing.", file=sys.stderr)
                return False
        if "css" in ext:
            if not (cpath / "assets" / "course" / ext["css"]).exists():
                print(f"Error: Declared extension '{ext_id}' CSS file '{ext['css']}' is missing.", file=sys.stderr)
                return False
        for req in ext.get("requires", []):
            if req not in modules_lock:
                print(f"Error: Declared extension '{ext_id}' requires module '{req}', which is missing from {lock_file}! Run 'kit sync' to update.", file=sys.stderr)
                return False

    # Check that modules required by lesson content are present in modules_lock
    needed_modules, _ = detect_modules_for_course(cpath, manifest_data)
    for need_id in needed_modules:
        if need_id not in modules_lock:
            print(
                f"Error: Module '{need_id}' is required by lesson content but missing in {lock_file}! Run 'kit sync' to update.",
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
