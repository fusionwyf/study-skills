#!/usr/bin/env python3
"""
Course Kit v2 Build & CLI Toolchain
Commands:
  kit build                  Builds kit manifest, topological order, and catalog view
  kit sync <course_dir>      Scans lessons, normalizes HTML, generates assets/kit/ and kit.lock.json
  kit check <course_dir>     Verifies kit.lock.json hashes and module integrity
  kit add <course_dir> <mod> Adds an opt-in module to course config and syncs
  kit list                   Lists available modules and descriptors
  kit serve <course_dir>     Local HTTP server; POST /api/records merges into
                             records/<NNNN>-feedback.md in real time, /dashboard UI
  kit ingest <course_dir>    Offline fallback: merges records/inbox/*.json the same way
  kit shot <course_dir>      Headless-Chromium screenshots for visual QC (exports/shots/)
"""

import sys
from pathlib import Path

_BUILD_DIR = Path(__file__).resolve().parent
for _p in (str(_BUILD_DIR), str(_BUILD_DIR.parents[1] / "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import argparse
import json
from kit_common import KIT_ROOT, KIT_VERSION
from kit_check import check_course
from kit_bundle import add_module, build_manifest, sync_course
from kit_serve import ingest_inbox, serve_course
from kit_shot import shot_course

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

    # serve
    serve_p = subparsers.add_parser("serve", help="Starts local HTTP server with auto record inbox")
    serve_p.add_argument("course_dir", help="Path to course directory")
    serve_p.add_argument("--port", type=int, default=8765, help="Port number (default: 8765)")
    serve_p.add_argument("--lan", action="store_true", help="Bind 0.0.0.0 for LAN devices (generates access token)")
    serve_p.add_argument("--token", default=None, help="Custom access token for --lan")

    # ingest
    ing_p = subparsers.add_parser("ingest", help="Merges records/inbox/*.json into pending record .md files")
    ing_p.add_argument("course_dir", help="Path to course directory")

    # shot
    shot_p = subparsers.add_parser("shot", help="Headless-Chromium screenshots for visual QC")
    shot_p.add_argument("course_dir", help="Path to course directory")
    shot_p.add_argument("--chapter", help="Only shoot this chapter (directory label, e.g. 第九章)")
    shot_p.add_argument("--lesson", type=int, help="Only shoot this lesson number")
    shot_p.add_argument("--theme", action="append", help="Theme to shoot (repeatable; default: course config theme)")
    shot_p.add_argument("--browser", help="Chromium-family browser executable override")

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
    elif args.command == "serve":
        serve_course(args.course_dir, port=args.port, lan=args.lan, token=args.token)
    elif args.command == "ingest":
        ok = ingest_inbox(args.course_dir)
        sys.exit(0 if ok else 1)
    elif args.command == "shot":
        ok = shot_course(args.course_dir, lesson=args.lesson, chapter=args.chapter, themes=args.theme, browser=args.browser)
        sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
