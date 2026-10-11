#!/usr/bin/env python3
"""Export a local lesson HTML file to PDF using a Chromium-family browser."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def find_browser(explicit: str | None) -> str | None:
    candidates = [explicit] if explicit else []
    candidates += [
        os.environ.get("COURSE_BROWSER"),
        shutil.which("chrome"), shutil.which("chromium"), shutil.which("chromium-browser"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
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
    parser.add_argument("--wait-ms", type=int, default=2500, help="Virtual time budget for client-side rendering")
    parser.add_argument("--allow-failed", action="store_true", help="Allow exporting PDF even if some visual components failed")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not source.is_file(): raise SystemExit(f"source HTML does not exist: {source}")
    browser = find_browser(args.browser)
    if not browser: raise SystemExit("No Chromium-family browser found. Use a browser PDF tool or pass --browser.")
    output.parent.mkdir(parents=True, exist_ok=True)

    # Keep the source in its original directory so relative CSS, JS, fonts and images work.
    source_url = source.as_uri() + f"?export={args.mode}"

    # Step 1: Pre-flight check via --dump-dom to ensure kit settled and no rendering failures
    dump_cmd = [
        browser, "--headless=new", "--disable-gpu",
        f"--virtual-time-budget={args.wait_ms}",
        "--dump-dom", source_url
    ]
    dump_res = subprocess.run(dump_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    dom_text = ""
    if dump_res.returncode != 0 or not (dump_res.stdout and dump_res.stdout.strip()):
        err_msg = (dump_res.stderr or "").strip() or f"Pre-flight exited with code {dump_res.returncode} and produced no DOM output."
        if not args.allow_failed:
            raise SystemExit(f"Export blocked: Pre-flight DOM check failed ({err_msg}). Use --allow-failed to force export.")
        else:
            print(f"WARNING: Pre-flight DOM check failed ({err_msg}). Continuing due to --allow-failed.", file=sys.stderr)
            dom_text = dump_res.stdout or ""
    else:
        dom_text = dump_res.stdout

    if dom_text:
        is_settled = ('data-kit-status="settled"' in dom_text or
                      "data-kit-status='settled'" in dom_text or
                      'data-course-ready="true"' in dom_text or
                      "data-course-ready='true'" in dom_text)
        if not is_settled:
            msg = f"Render timeout / not settled: page did not settle within {args.wait_ms}ms (missing data-kit-status='settled')."
            if not args.allow_failed:
                raise SystemExit(f"Export blocked: {msg} Use --allow-failed to force export.")
            else:
                print(f"WARNING: {msg} Continuing due to --allow-failed.", file=sys.stderr)

        failed_patterns = [
            r'data-kit-state=["\'](?:failed|degraded)["\']',
            r'data-viz-ready=["\'](?:failed|degraded)["\']',
            r'data-kit-ready=["\'](?:false|failed|degraded)["\']',
            r'data-kit-status=["\'](?:failed|degraded)["\']',
            r'data-kit-degraded=["\']true["\']',
            r'class=["\'][^"\']*\b(?:kit-degraded|katex-error)\b[^"\']*["\']',
        ]
        has_failures = any(re.search(pat, dom_text) for pat in failed_patterns)

        # Check for unrendered math formulas (formula syntax present but no KaTeX or MathML elements rendered)
        has_math_source = bool(re.search(r'class=["\'][^"\']*\bformula\b[^"\']*["\']|data-math\b|\\\(|\\\[|\$\$', dom_text))
        if has_math_source and not re.search(r'class=["\'][^"\']*\bkatex\b[^"\']*["\']|<math\b', dom_text):
            has_failures = True

        if has_failures:
            if not args.allow_failed:
                raise SystemExit(
                    "Export blocked: one or more visual components failed rendering or degraded. Use --allow-failed to force export."
                )
            else:
                print("WARNING: Exporting with failed components (--allow-failed is enabled).", file=sys.stderr)

    # Step 2: Render to PDF using the pre-flight verified DOM snapshot to guarantee
    # identical state between pre-flight check and print output.
    tmp_snapshot = source.parent / f".tmp_{source.stem}_{os.getpid()}_export.html"
    try:
        if dom_text.strip():
            tmp_snapshot.write_text(dom_text, encoding="utf-8")
            print_target_url = tmp_snapshot.as_uri() + f"?export={args.mode}"
        else:
            print_target_url = source_url

        command = [
            browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            f"--virtual-time-budget={args.wait_ms}",
            f"--print-to-pdf={output}", print_target_url
        ]
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            if output.exists():
                output.unlink()
            raise SystemExit(result.stderr.strip() or "Browser PDF export failed")
        if not output.is_file() or output.stat().st_size == 0:
            if output.exists():
                output.unlink()
            raise SystemExit("Browser returned without a usable PDF")
        print(output)
        return 0
    finally:
        if tmp_snapshot.exists():
            try:
                tmp_snapshot.unlink()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
