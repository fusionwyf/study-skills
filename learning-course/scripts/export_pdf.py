#!/usr/bin/env python3
"""Export a local lesson HTML file to PDF using a Chromium-family browser."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
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


def get_free_port() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


class SimpleWebSocket:
    """Minimal RFC-6455 WebSocket client for Chrome DevTools Protocol."""
    def __init__(self, ws_url: str, timeout: float = 25.0):
        parsed = urllib.parse.urlparse(ws_url)
        self.host = parsed.hostname or "127.0.0.1"
        self.port = parsed.port or 9222
        self.path = parsed.path
        self.sock = socket.create_connection((self.host, self.port), timeout=timeout)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode('ascii'))
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket handshake failed")
            resp += chunk
        if b" 101 " not in resp:
            raise ConnectionError("WebSocket upgrade rejected")

    def send(self, msg: str):
        payload = msg.encode('utf-8')
        length = len(payload)
        mask = os.urandom(4)
        header = bytearray([0x81])
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(length.to_bytes(2, 'big'))
        else:
            header.append(0x80 | 127)
            header.extend(length.to_bytes(8, 'big'))
        header.extend(mask)
        masked = bytearray(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(header + masked)

    def recv(self) -> str:
        hdr = self._read_exact(2)
        has_mask = bool(hdr[1] & 0x80)
        length = hdr[1] & 0x7F
        if length == 126:
            length = int.from_bytes(self._read_exact(2), 'big')
        elif length == 127:
            length = int.from_bytes(self._read_exact(8), 'big')
        mask = self._read_exact(4) if has_mask else None
        data = self._read_exact(length)
        if has_mask and mask:
            data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        return data.decode('utf-8')

    def _read_exact(self, n: int) -> bytes:
        buf = bytearray()
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("Socket closed prematurely")
            buf.extend(chunk)
        return bytes(buf)

    def call(self, method: str, params: dict | None = None) -> dict:
        mid = getattr(self, '_mid', 0) + 1
        self._mid = mid
        self.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(self.recv())
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError(msg['error'])
                return msg.get('result', {})

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def check_dom_failures(dom_text: str, is_settled: bool, allow_failed: bool, wait_ms: int):
    """Verifies that the page settled and contains no degraded or failed components."""
    if not is_settled:
        msg = f"Render timeout / not settled: page did not settle within {wait_ms}ms (missing data-kit-status='settled')."
        if not allow_failed:
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
        if not allow_failed:
            raise SystemExit(
                "Export blocked: one or more visual components failed rendering or degraded. Use --allow-failed to force export."
            )
        else:
            print("WARNING: Exporting with failed components (--allow-failed is enabled).", file=sys.stderr)


def export_via_cdp(browser: str, source_url: str, output: Path, wait_ms: int, allow_failed: bool) -> bool:
    """Exports PDF by checking DOM and printing in the EXACT SAME browser page session via CDP."""
    port = get_free_port()
    cmd = [
        browser, "--headless=new", "--disable-gpu",
        f"--remote-debugging-port={port}",
        source_url
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws = None
    try:
        start = time.time()
        ws_url = None
        while time.time() - start < 8.0:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1) as resp:
                    targets = json.loads(resp.read())
                    pages = [t for t in targets if t.get("type") == "page"]
                    if pages and pages[0].get("webSocketDebuggerUrl"):
                        ws_url = pages[0]["webSocketDebuggerUrl"]
                        break
            except Exception:
                time.sleep(0.08)
        if not ws_url:
            return False

        ws = SimpleWebSocket(ws_url, timeout=max(15.0, wait_ms / 1000.0 + 5.0))
        ws.call("Page.enable")
        ws.call("Runtime.enable")

        wait_sec = max(0.5, wait_ms / 1000.0)
        poll_start = time.time()
        is_settled = False
        while time.time() - poll_start < wait_sec:
            try:
                res = ws.call("Runtime.evaluate", {
                    "expression": '(function(){ return document.documentElement.dataset.kitStatus || (document.documentElement.dataset.courseReady === "true" ? "settled" : ""); })()'
                })
                val = res.get("result", {}).get("value")
                if val == "settled":
                    is_settled = True
                    break
            except Exception:
                pass
            time.sleep(0.08)

        dom_res = ws.call("Runtime.evaluate", {"expression": "document.documentElement.outerHTML"})
        dom_text = dom_res.get("result", {}).get("value", "")

        check_dom_failures(dom_text, is_settled, allow_failed, wait_ms)

        # Print PDF from the exact same live page session (retains WebGL canvas, layout and state)
        pdf_res = ws.call("Page.printToPDF", {"printBackground": True, "displayHeaderFooter": False})
        pdf_bytes = base64.b64decode(pdf_res.get("data", ""))
        if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
            raise SystemExit("Browser returned without a usable PDF")
        output.write_bytes(pdf_bytes)
        return True
    except (ConnectionError, RuntimeError, OSError):
        return False
    finally:
        if ws:
            ws.close()
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            pass


def export_via_cli(browser: str, source_url: str, output: Path, wait_ms: int, allow_failed: bool):
    """Fallback export using CLI flags when CDP is unavailable."""
    dump_cmd = [
        browser, "--headless=new", "--disable-gpu",
        f"--virtual-time-budget={wait_ms}",
        "--dump-dom", source_url
    ]
    dump_res = subprocess.run(dump_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    dom_text = ""
    if dump_res.returncode != 0 or not (dump_res.stdout and dump_res.stdout.strip()):
        err_msg = (dump_res.stderr or "").strip() or f"Pre-flight exited with code {dump_res.returncode} and produced no DOM output."
        if not allow_failed:
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
        check_dom_failures(dom_text, is_settled, allow_failed, wait_ms)

    command = [
        browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
        f"--virtual-time-budget={wait_ms}",
        f"--print-to-pdf={output}", source_url
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
    if not source.is_file():
        raise SystemExit(f"source HTML does not exist: {source}")
    browser = find_browser(args.browser)
    if not browser:
        raise SystemExit("No Chromium-family browser found. Use a browser PDF tool or pass --browser.")
    output.parent.mkdir(parents=True, exist_ok=True)

    source_url = source.as_uri() + f"?export={args.mode}"

    # First attempt same-page inspection and printing via Chrome DevTools Protocol
    success = export_via_cdp(browser, source_url, output, args.wait_ms, args.allow_failed)
    if not success:
        # Fallback to CLI
        export_via_cli(browser, source_url, output, args.wait_ms, args.allow_failed)

    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
