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

def shot_course(course_dir, lesson=None, themes=None, browser=None, wait_ms=12000):
    """Headless-Chromium screenshots of lessons into exports/shots/ for visual QC.

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

    entries = course_layout.iter_lessons(cpath)
    if lesson is not None:
        needle = f"{int(lesson):04d}"
        entries = [entry for entry in entries if entry["number"] == needle]
        if not entries:
            print(f"Error: lesson {needle} not found.", file=sys.stderr)
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
                    out = shots_dir / f"{entry['number']}{suffix}-{label}.png"
                    out.write_bytes(data)
                    written.append(out)
                    print(f"Shot: {out.relative_to(cpath).as_posix()}")
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
