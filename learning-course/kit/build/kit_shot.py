#!/usr/bin/env python3
"""Headless-Chromium visual QC screenshots (kit shot)."""

import sys
from pathlib import Path

_BUILD_DIR = Path(__file__).resolve().parent
for _p in (str(_BUILD_DIR), str(_BUILD_DIR.parents[1] / "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import json
import shutil
import subprocess
import tempfile
import course_layout

def find_chromium_browser():
    import shutil
    candidates = [
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
        if candidate and Path(candidate).is_file():
            return candidate
    return None

SHOT_VIEWPORTS = [("desktop", 1440, 2400), ("mobile", 390, 1600)]


def select_lessons(entries, lesson=None, chapter=None):
    """Filter lesson entries by chapter/lesson; raise ValueError on ambiguity.

    A chaptered course may contain the same lesson number in several chapters.
    Silent first-match selection used to overwrite the previous chapter's
    screenshots, so a bare --lesson match across chapters is an error.
    """
    selected = list(entries)
    if chapter:
        selected = [entry for entry in selected if (entry.get("chapter") or "") == chapter]
        if not selected:
            available = sorted({entry["chapter"] for entry in entries if entry.get("chapter")})
            hint = ", ".join(available) if available else "(flat course; omit --chapter)"
            raise ValueError(f"chapter {chapter!r} not found. Available chapters: {hint}")
    if lesson is not None:
        needle = f"{int(lesson):04d}"
        selected = [entry for entry in selected if entry["number"] == needle]
        if not selected:
            scope = f" in chapter {chapter}" if chapter else ""
            raise ValueError(f"lesson {needle} not found{scope}.")
        if chapter is None and len(selected) > 1 and any(entry.get("chapter") for entry in selected):
            keys = ", ".join(
                f"{entry['chapter']}/{entry['number']}" if entry.get("chapter") else entry["number"]
                for entry in selected
            )
            raise ValueError(
                f"lesson {needle} is ambiguous across chapters: {keys}; "
                "pass --chapter <directory label>."
            )
    return selected


def shot_course(course_dir, lesson=None, chapter=None, themes=None, browser=None, wait_ms=12000):
    """Headless-Chromium screenshots of lessons into exports/shots/ for visual QC.

    `chapter` is the lesson directory label (e.g. 第九章). In a chaptered course
    the same lesson number can exist in several chapters; without it, a
    --lesson filter that matches more than one chapter is rejected instead of
    silently overwriting the first chapter's screenshots.

    Uses CDP device-metrics emulation: `--window-size` below ~520px gets clamped
    by desktop browsers (Windows), which silently crops narrow-viewport shots.
    """
    import base64
    import shutil
    import time
    import urllib.request
    from export_pdf import SimpleWebSocket, get_free_port

    cpath = Path(course_dir).resolve()
    if not cpath.is_dir():
        print(f"Error: Course directory not found: {cpath}", file=sys.stderr)
        return False
    browser = browser or find_chromium_browser()
    if not browser:
        print(
            "Error: no Chromium-family browser found (chrome/chromium/msedge); "
            "pass --browser to specify one explicitly.",
            file=sys.stderr,
        )
        return False

    all_entries = course_layout.iter_lessons(cpath)
    try:
        entries = select_lessons(all_entries, lesson=lesson, chapter=chapter)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return False
    if not entries:
        print("Error: no lessons found.", file=sys.stderr)
        return False

    if not themes:
        themes = []
        config_file = cpath / "assets" / "course" / "config.json"
        if config_file.is_file():
            try:
                default_theme = json.loads(config_file.read_text(encoding="utf-8")).get("theme")
                if default_theme:
                    themes = [default_theme]
            except Exception:
                pass

    shots_dir = cpath / "exports" / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    port = get_free_port()
    profile_dir = tempfile.mkdtemp(prefix="kit-shot-profile-")
    cmd = [
        browser, "--headless=new", "--disable-gpu",
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={port}",
        "about:blank",
    ]
    proc = None
    ws = None
    written = []
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws_url = None
        deadline = time.time() + 8.0
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1) as resp:
                    targets = json.loads(resp.read())
                    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
                    if pages:
                        ws_url = pages[0]["webSocketDebuggerUrl"]
                        break
            except Exception:
                time.sleep(0.08)
        if not ws_url:
            print("Error: could not reach browser DevTools endpoint.", file=sys.stderr)
            return False

        ws = SimpleWebSocket(ws_url, timeout=max(20.0, wait_ms / 1000.0 + 5.0))
        ws.call("Page.enable")

        for entry in entries:
            base_url = entry["path"].resolve().as_uri()
            for theme in themes or [None]:
                themed_url = f"{base_url}?kit-theme={theme}" if theme else base_url
                suffix = f"-{theme}" if theme else ""
                for label, width, height in SHOT_VIEWPORTS:
                    ws.call("Emulation.setDeviceMetricsOverride", {
                        "width": width, "height": height,
                        "deviceScaleFactor": 1, "mobile": width < 700,
                    })
                    ws.call("Page.navigate", {"url": themed_url})
                    settle_deadline = time.time() + wait_ms / 1000.0
                    loaded = False
                    while time.time() < settle_deadline:
                        try:
                            # settled = kit core marked every module ready (KaTeX,
                            # hljs, charts included) — same signal export_pdf waits for.
                            res = ws.call("Runtime.evaluate", {"expression":
                                "document.readyState + '|' + (document.documentElement.dataset.kitStatus || '')"})
                            value = res.get("result", {}).get("value", "")
                            if value == "complete|settled":
                                loaded = True
                                time.sleep(0.8)  # font swap / last paint
                                break
                        except Exception:
                            pass
                        time.sleep(0.1)
                    if not loaded:
                        print(f"Warning: {entry['file']} ({label}{suffix}) did not reach kit settled state in {wait_ms}ms", file=sys.stderr)
                    shot = ws.call("Page.captureScreenshot", {"format": "png"})
                    data = base64.b64decode(shot.get("data", ""))
                    if not data:
                        print(f"Error: empty screenshot for {entry['file']} ({label}{suffix})", file=sys.stderr)
                        return False
                    prefix = (
                        f"{entry['chapter']}-{entry['number']}"
                        if entry.get("chapter")
                        else entry["number"]
                    )
                    out = shots_dir / f"{prefix}{suffix}-{label}.png"
                    out.write_bytes(data)
                    written.append(out)
                    key = f"{entry['chapter']}/{entry['number']}" if entry.get("chapter") else entry["number"]
                    print(f"Shot: {out.relative_to(cpath).as_posix()} ({key})")
        print(f"{len(written)} screenshot(s) in exports/shots/")
        return True
    except (ConnectionError, RuntimeError, OSError) as shot_err:
        print(f"Error: CDP screenshot failed: {shot_err}", file=sys.stderr)
        return False
    finally:
        try:
            if ws:
                ws.close()
            if proc is not None:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
        finally:
            shutil.rmtree(profile_dir, ignore_errors=True)
