#!/usr/bin/env python3
"""Export a local lesson HTML file to PDF using a Chromium-family browser."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path


def find_browser(explicit: str | None) -> str | None:
    candidates = [explicit] if explicit else []
    candidates += [
        os.environ.get("COURSE_BROWSER"),
        shutil.which("chrome"), shutil.which("chromium"), shutil.which("chromium-browser"),
        shutil.which("msedge"),
        r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        r"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        r"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file(): return candidate
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Lesson HTML file")
    parser.add_argument("output", help="Destination PDF file")
    parser.add_argument("--mode", choices=("student", "review"), default="student")
    parser.add_argument("--browser", help="Chromium-family browser executable")
    parser.add_argument("--wait-ms", type=int, default=1800, help="Virtual time budget for client-side rendering")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not source.is_file(): raise SystemExit(f"source HTML does not exist: {source}")
    browser = find_browser(args.browser)
    if not browser: raise SystemExit("No Chromium-family browser found. Use a browser PDF tool or pass --browser.")
    output.parent.mkdir(parents=True, exist_ok=True)

    # Keep the source in its original directory so relative CSS, JS, fonts and images work.
    # course.js reads the export query parameter and applies the print mode without mutating HTML.
    source_url = source.as_uri() + f"?export={args.mode}"
    command = [browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--virtual-time-budget={args.wait_ms}", f"--print-to-pdf={output}", source_url]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0: raise SystemExit(result.stderr.strip() or "Browser PDF export failed")
    if not output.is_file() or output.stat().st_size == 0: raise SystemExit("Browser returned without a usable PDF")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
