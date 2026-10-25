#!/usr/bin/env python3
"""Local course server, dashboard and record inbox merge (kit serve/ingest)."""

import sys
from pathlib import Path

_BUILD_DIR = Path(__file__).resolve().parent
for _p in (str(_BUILD_DIR), str(_BUILD_DIR.parents[1] / "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import json
import re
import course_layout
import record_builder
from kit_common import KIT_ROOT

def _detect_lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

DASHBOARD_FILE = KIT_ROOT / "shell" / "dashboard" / "index.html"


def _course_theme(course_dir: Path) -> str:
    config = course_dir / "assets" / "course" / "config.json"
    try:
        return str(json.loads(config.read_text(encoding="utf-8")).get("theme") or "course")
    except Exception:
        return "course"

RECORD_META_KEYS = (
    "record_schema", "assessment_status", "record_id", "attempted_at",
    "independence", "lesson", "evidence_type", "evidence_strength",
)

def list_record_metadata(cpath):
    """Minimal frontmatter scan of records/*.md for the dashboard."""
    items = []
    for path in course_layout.iter_record_files(cpath):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        split = course_layout.split_frontmatter(text)
        if split is None:
            continue
        meta = {"path": path.relative_to(cpath).as_posix()}
        for line in split[0].splitlines():
            key, sep, value = line.partition(":")
            if sep and key.strip() in RECORD_META_KEYS:
                meta[key.strip()] = value.strip().strip("'\"")
        items.append(meta)
    return items

def serve_course(course_dir, host="127.0.0.1", port=8765, lan=False, token=None):
    """Starts a local HTTP server for the course with /api/records inbox and /api/course."""
    import secrets
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import parse_qs, urlparse

    cpath = Path(course_dir).resolve()
    if not cpath.is_dir():
        print(f"Error: Course directory not found: {cpath}", file=sys.stderr)
        return False

    bind_host = "0.0.0.0" if lan else host
    active_token = token or (secrets.token_urlsafe(12) if lan else "")
    inbox_dir = cpath / "records" / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)

    class CourseHandler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(cpath), **kw)

        def log_message(self, fmt, *args):
            sys.stderr.write(f"[kit serve] {self.address_string()} - {fmt % args}\n")

        def _check_token(self, parsed):
            if not active_token:
                return True
            hdr = self.headers.get("X-Kit-Token", "")
            qs = parse_qs(parsed.query).get("t", [""])[0]
            return hdr == active_token or qs == active_token

        def _send_json(self, code, obj):
            data = json.dumps(obj, ensure_ascii=False, indent=2, default=str).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/dashboard" or parsed.path == "/dashboard/":
                if not self._check_token(parsed):
                    return self._send_json(403, {"error": "forbidden"})
                if not DASHBOARD_FILE.is_file():
                    return self._send_json(404, {"error": "dashboard not found"})
                template = DASHBOARD_FILE.read_text(encoding="utf-8")
                body = template.replace("__KIT_THEME__", _course_theme(cpath)).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if parsed.path == "/api/course":
                if not self._check_token(parsed):
                    return self._send_json(403, {"error": "forbidden"})
                cy = cpath / "course.yaml"
                data = {}
                if cy.is_file():
                    try:
                        import yaml
                        data = yaml.safe_load(cy.read_text(encoding="utf-8")) or {}
                    except Exception as e:
                        data = {"error": str(e)}
                return self._send_json(200, data)
            if parsed.path == "/api/records":
                if not self._check_token(parsed):
                    return self._send_json(403, {"error": "forbidden"})
                return self._send_json(200, {"items": list_record_metadata(cpath)})
            if parsed.path == "/api/inbox":
                if not self._check_token(parsed):
                    return self._send_json(403, {"error": "forbidden"})
                items = []
                for f in sorted(inbox_dir.glob("*.json")):
                    try:
                        items.append(json.loads(f.read_text(encoding="utf-8")))
                    except Exception:
                        pass
                return self._send_json(200, {"items": items})
            return super().do_GET()

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path != "/api/records":
                return self._send_json(404, {"error": "not_found"})
            if not self._check_token(parsed):
                return self._send_json(403, {"error": "forbidden"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length).decode("utf-8")
                payload = json.loads(raw)
            except Exception as e:
                return self._send_json(400, {"error": f"bad_json: {e}"})

            lesson = re.sub(r"[^0-9A-Za-z_-]", "", str(payload.get("lesson", "unknown"))) or "unknown"
            dev = re.sub(r"[^0-9A-Za-z_-]", "", str(payload.get("device_id", "local"))) or "local"
            fname = f"lesson-{lesson}-{dev}.json"
            inbox_file = inbox_dir / fname
            inbox_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

            # Real-time merge into records/<NNNN>-feedback.md — the identical
            # code path kit.py ingest uses, so both produce the same record.
            response = {"ok": True, "file": f"records/inbox/{fname}"}
            try:
                outcome = record_builder.merge_inbox_payload(cpath, payload)
            except Exception as merge_err:
                return self._send_json(500, {"ok": False, "error": f"merge_failed: {merge_err}"})
            if outcome.get("record"):
                record_builder.update_last_feedback(cpath, outcome["record"])
                response["record"] = outcome["record"]
            if outcome.get("skipped"):
                response["skipped"] = outcome["skipped"]
            return self._send_json(200, response)

    httpd = ThreadingHTTPServer((bind_host, port), CourseHandler)
    local_url = f"http://127.0.0.1:{port}/"
    print(f"\nCourse Kit server running for: {cpath.name}")
    print(f"  Local: {local_url}" + (f"?t={active_token}" if active_token else ""))
    print(f"  Dashboard: {local_url}dashboard" + (f"?t={active_token}" if active_token else ""))
    if lan:
        lan_ip = _detect_lan_ip()
        print(f"  LAN:   http://{lan_ip}:{port}/?t={active_token}")
        print(f"  Token: {active_token} (其他设备首次带 ?t= 打开后会自动记住)")
    print(f"  Inbox: {inbox_dir}\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
    return True

def ingest_inbox(course_dir):
    """Offline fallback: merges records/inbox/*.json exactly like kit.py serve does."""
    cpath = Path(course_dir).resolve()
    if not cpath.is_dir():
        print(f"Error: Course directory {cpath} does not exist.", file=sys.stderr)
        return False
    record_builder.ingest_inbox(cpath)
    return True
